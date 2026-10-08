import uuid
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.meal import Meal
from app.models.meal_item import MealItem
from app.models.user import UserProfile, DailyNutritionTarget
from app.nutrition.provider import DatabaseNutritionProvider, NutritionDataProvider
from app.nutrition.calculation_service import (
    NutritionCalculationService,
    ConfirmedFoodItemInput,
    MealNutritionCalculationResult,
)
from app.nutrition.engine import NutritionEngine, ItemNutritionalInput
from app.ai.base import AIProvider
from app.ai.factory import get_ai_provider
from app.personalization.daily_tracking_service import DailyTrackingService
from app.optimizer.enums import MealIssueEnum
from app.optimizer.rules import MealIssueAnalyzer
from app.optimizer.scoring import CandidateScorer
from app.optimizer.candidate_generator import CandidateGenerator
from app.schemas.optimization import (
    MealOptimizationResponse,
    OptimizationRecommendation,
    NutritionSnapshot,
    CandidateItemSchema,
    MealModification,
    ApplyOptimizationRequest,
)


class MealOptimizationService:
    """
    Core orchestrator for Phase 5 'Optimize My Meal'.
    Adheres strictly to the architectural rule:
    - NO LLM nutrition arithmetic.
    - All candidate metrics are computed deterministically by the Nutrition Engine.
    - AI provider serves solely as an explanation layer over structured facts.
    """

    def __init__(self, db: Session, ai_provider: Optional[AIProvider] = None):
        self.db = db
        self.provider: NutritionDataProvider = DatabaseNutritionProvider(db)
        self.calc_service = NutritionCalculationService(self.provider)
        self.generator = CandidateGenerator(self.provider)
        self.ai_provider: AIProvider = ai_provider or get_ai_provider()

    async def optimize_meal(
        self,
        meal_id: str,
        current_user_id: Optional[str] = None,
        override_goal: Optional[str] = None,
    ) -> MealOptimizationResponse:
        """
        Analyzes an existing meal, detects imbalances, generates candidates,
        recalculates macros deterministically, scores, and produces AI explanations.
        """
        # 1. Fetch meal and validate existence
        meal = self.db.query(Meal).filter(Meal.id == meal_id).first()
        if not meal:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Meal with ID '{meal_id}' not found",
            )

        # 2. User ownership validation (isolation)
        if current_user_id and meal.user_id and meal.user_id != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to access or optimize this meal",
            )

        # 3. Resolve user profile, goal, and daily targets
        effective_user_id = meal.user_id or current_user_id
        user_profile: Optional[UserProfile] = None
        user_goal = override_goal or "WEIGHT_LOSS"
        target_calories = 2000.0
        remaining_calories = 1200.0

        if effective_user_id:
            user_profile = (
                self.db.query(UserProfile)
                .filter(UserProfile.user_id == effective_user_id)
                .first()
            )
            if user_profile and not override_goal:
                user_goal = user_profile.goal

            # Query daily tracking service for remaining calories
            try:
                tracking_service = DailyTrackingService(self.db)
                daily_summary = tracking_service.get_daily_nutrition(effective_user_id)
                target_calories = daily_summary["target"]["calorie_target"]
                remaining_calories = daily_summary["remaining"]["calories"]
            except Exception:
                pass

        # 4. Convert existing meal items into confirmed inputs for recalculation
        current_inputs: List[ConfirmedFoodItemInput] = []
        for it in meal.items:
            # Determine appropriate portion value in grams or reference unit
            p_val = it.gram_weight or (it.serving_size * it.serving_count) or 100.0
            p_unit = it.serving_unit or "g"
            current_inputs.append(
                ConfirmedFoodItemInput(
                    food_id=it.food_id,
                    food_name=it.food_name,
                    portion_value=p_val,
                    portion_unit=p_unit,
                    is_exact_weight=bool(it.confidence_score and it.confidence_score >= 0.85),
                    confidence_score=it.confidence_score,
                )
            )

        # 5. Deterministic baseline meal recalculation
        orig_calc = self.calc_service.calculate_meal(current_inputs)
        orig_snapshot = NutritionSnapshot(
            calories=orig_calc.total_calories or meal.total_calories,
            protein=orig_calc.total_protein or meal.total_protein,
            carbohydrates=orig_calc.total_carbohydrates or meal.total_carbohydrates,
            fat=orig_calc.total_fat or meal.total_fat,
            fiber=orig_calc.total_fiber or meal.total_fiber,
            sugar=orig_calc.total_sugar or meal.total_sugar,
            sodium=orig_calc.total_sodium or meal.total_sodium,
            calorie_min=orig_calc.calorie_min,
            calorie_max=orig_calc.calorie_max,
            uncertainty_calories=orig_calc.uncertainty_calories or meal.uncertainty_calories,
            confidence_level=orig_calc.confidence_level or meal.confidence_level or "MEDIUM",
            formatted_estimate=orig_calc.formatted_estimate,
        )

        # 6. Identify nutritional imbalances
        issues = MealIssueAnalyzer.identify_issues(
            meal_calories=orig_snapshot.calories,
            meal_protein=orig_snapshot.protein,
            meal_carbs=orig_snapshot.carbohydrates,
            meal_fat=orig_snapshot.fat,
            meal_fiber=orig_snapshot.fiber,
            meal_sodium=orig_snapshot.sodium,
            meal_sugar=orig_snapshot.sugar,
            daily_target_calories=target_calories,
            remaining_calories=remaining_calories,
            goal=user_goal,
        )

        # 7. Generate candidate modifications
        raw_candidates = self.generator.generate_candidates(
            current_items=current_inputs,
            issues=issues,
            goal=user_goal,
            remaining_calories=remaining_calories,
        )

        status_summary = (
            f"Identified {len(issues)} nutritional focus areas for {user_goal.replace('_', ' ').title()}."
            if issues
            else "This meal is already reasonably aligned with your current target."
        )

        # 8. Recalculate each candidate deterministically and attach score + explanation
        recommendations: List[OptimizationRecommendation] = []
        for cand in raw_candidates:
            # Deterministic recalculation through NutritionCalculationService
            cand_calc = self.calc_service.calculate_meal(cand["modified_inputs"])

            opt_snapshot = NutritionSnapshot(
                calories=cand_calc.total_calories,
                protein=cand_calc.total_protein,
                carbohydrates=cand_calc.total_carbohydrates,
                fat=cand_calc.total_fat,
                fiber=cand_calc.total_fiber,
                sugar=cand_calc.total_sugar,
                sodium=cand_calc.total_sodium,
                calorie_min=cand_calc.calorie_min,
                calorie_max=cand_calc.calorie_max,
                uncertainty_calories=cand_calc.uncertainty_calories,
                confidence_level=cand_calc.confidence_level,
                formatted_estimate=cand_calc.formatted_estimate,
            )

            # Deterministic score
            score = CandidateScorer.score_candidate(
                goal=user_goal,
                original_nutrition={
                    "calories": orig_snapshot.calories,
                    "protein": orig_snapshot.protein,
                    "carbohydrates": orig_snapshot.carbohydrates,
                    "fat": orig_snapshot.fat,
                    "fiber": orig_snapshot.fiber,
                },
                optimized_nutrition={
                    "calories": opt_snapshot.calories,
                    "protein": opt_snapshot.protein,
                    "carbohydrates": opt_snapshot.carbohydrates,
                    "fat": opt_snapshot.fat,
                    "fiber": opt_snapshot.fiber,
                },
                remaining_calories=remaining_calories,
                daily_target_calories=target_calories,
            )

            # AI explanation layer over structured facts
            try:
                explanation = await self.ai_provider.explain_meal_optimization(
                    goal=user_goal,
                    original_nutrition={
                        "calories": orig_snapshot.calories,
                        "protein": orig_snapshot.protein,
                        "fiber": orig_snapshot.fiber,
                    },
                    optimized_nutrition={
                        "calories": opt_snapshot.calories,
                        "protein": opt_snapshot.protein,
                        "fiber": opt_snapshot.fiber,
                    },
                    changes=cand["changes"],
                )
            except Exception:
                explanation = "This modification refines the meal's macronutrient balance to better support your current goal."

            # Map candidate items to schema
            candidate_item_schemas = [
                CandidateItemSchema(
                    food_id=item_res.food_id,
                    food_name=item_res.food_name,
                    portion_value=item_res.portion_value,
                    portion_unit=item_res.portion_unit,
                    calories=item_res.calories,
                    protein=item_res.protein,
                    carbohydrates=item_res.carbohydrates,
                    fat=item_res.fat,
                    fiber=item_res.fiber,
                    sugar=item_res.sugar,
                    sodium=item_res.sodium,
                    confidence_score=0.9 if item_res.confidence_level == "HIGH" else 0.75,
                    uncertainty_pct=item_res.uncertainty_pct,
                )
                for item_res in cand_calc.items
            ]

            recommendations.append(
                OptimizationRecommendation(
                    title=cand["title"],
                    description=cand["description"],
                    changes=cand["changes"],
                    modifications=[MealModification(**m) for m in cand["modifications"]],
                    original_nutrition=orig_snapshot,
                    optimized_nutrition=opt_snapshot,
                    calorie_delta=round(opt_snapshot.calories - orig_snapshot.calories, 1),
                    protein_delta=round(opt_snapshot.protein - orig_snapshot.protein, 1),
                    fiber_delta=round(opt_snapshot.fiber - orig_snapshot.fiber, 1),
                    score=score,
                    confidence=opt_snapshot.confidence_level,
                    explanation=explanation,
                    items=candidate_item_schemas,
                )
            )

        # 9. Sort recommendations by score descending
        recommendations.sort(key=lambda r: r.score, reverse=True)

        return MealOptimizationResponse(
            meal_id=meal.id,
            goal=user_goal,
            issues=issues,
            status_summary=status_summary,
            recommendations=recommendations,
        )

    def apply_optimization(
        self,
        meal_id: str,
        request: ApplyOptimizationRequest,
        current_user_id: Optional[str] = None,
    ) -> Meal:
        """
        Applies a candidate recommendation by creating a NEW meal record with
        a parent link to the original meal. The original meal is preserved untouched.
        """
        # 1. Fetch original meal
        orig_meal = self.db.query(Meal).filter(Meal.id == meal_id).first()
        if not orig_meal:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Original meal with ID '{meal_id}' not found",
            )

        # 2. Ownership check
        if current_user_id and orig_meal.user_id and orig_meal.user_id != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to modify or optimize this meal",
            )

        if not request.items:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No items provided in optimization request",
            )

        # 3. Recalculate complete meal deterministically via NutritionCalculationService
        inputs = [
            ConfirmedFoodItemInput(
                food_id=item.food_id,
                food_name=item.food_name,
                portion_value=item.portion_value,
                portion_unit=item.portion_unit,
                is_exact_weight=True,
                confidence_score=item.confidence_score or 0.9,
            )
            for item in request.items
        ]
        calc_result = self.calc_service.calculate_meal(inputs)

        # 4. Create new versioned meal record
        new_meal = Meal(
            id=str(uuid.uuid4()),
            user_id=orig_meal.user_id or current_user_id,
            image_url=orig_meal.image_url,
            status="confirmed",
            meal_type=orig_meal.meal_type,
            parent_meal_id=orig_meal.id,
            is_optimized_version=True,
            optimization_notes=request.notes or f"Optimized version of meal '{orig_meal.id}'",
            total_calories=calc_result.total_calories,
            total_protein=calc_result.total_protein,
            total_carbohydrates=calc_result.total_carbohydrates,
            total_fat=calc_result.total_fat,
            total_fiber=calc_result.total_fiber,
            total_sugar=calc_result.total_sugar,
            total_sodium=calc_result.total_sodium,
            uncertainty_calories=calc_result.uncertainty_calories,
            confidence_level=calc_result.confidence_level,
            notes=orig_meal.notes,
        )
        self.db.add(new_meal)
        self.db.flush()

        # 5. Persist meal items
        for item_data, calc_item in zip(request.items, calc_result.items):
            db_item = MealItem(
                meal_id=new_meal.id,
                food_id=calc_item.food_id,
                food_name=calc_item.food_name,
                serving_count=calc_item.scaling_factor,
                serving_size=calc_item.portion_value,
                serving_unit=calc_item.portion_unit,
                gram_weight=calc_item.gram_weight,
                calories=calc_item.calories,
                protein=calc_item.protein,
                carbohydrates=calc_item.carbohydrates,
                fat=calc_item.fat,
                fiber=calc_item.fiber,
                sugar=calc_item.sugar,
                sodium=calc_item.sodium,
                confidence_score=item_data.confidence_score or 0.9,
                uncertainty_pct=calc_item.uncertainty_pct,
            )
            self.db.add(db_item)

        self.db.commit()
        self.db.refresh(new_meal)
        return new_meal
