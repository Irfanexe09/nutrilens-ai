from typing import List, Dict, Any, Optional, Tuple
from app.models.food import FoodItem
from app.nutrition.provider import NutritionDataProvider
from app.nutrition.calculation_service import (
    NutritionCalculationService,
    ConfirmedFoodItemInput,
    MealNutritionCalculationResult,
)
from app.optimizer.enums import MealIssueEnum, ModificationTypeEnum


class CandidateGenerator:
    """
    Deterministic candidate generator creating realistic, practical meal adjustments
    backed by verified foods from the application nutrition database.
    """

    GRAIN_KEYWORDS = (
        "rice", "biryani", "pulao", "naan", "paratha", "roti",
        "chapati", "dosa", "idli", "poha", "upma", "pongal", "puri", "bhatura",
    )
    PROTEIN_KEYWORDS = (
        "chicken", "mutton", "fish", "egg", "paneer", "dal",
        "chole", "rajma", "soya", "tofu",
    )

    def __init__(self, provider: NutritionDataProvider):
        self.provider = provider
        self.calc_service = NutritionCalculationService(provider)

    def _is_grain_or_base(self, food_name: str) -> bool:
        low = food_name.lower()
        return any(k in low for k in self.GRAIN_KEYWORDS)

    def _is_non_veg(self, meal_items: List[ConfirmedFoodItemInput]) -> bool:
        for item in meal_items:
            low = item.food_name.lower()
            if any(k in low for k in ("chicken", "mutton", "fish", "egg", "meat", "prawn")):
                return True
        return False

    def generate_candidates(
        self,
        current_items: List[ConfirmedFoodItemInput],
        issues: List[MealIssueEnum],
        goal: str = "WEIGHT_LOSS",
        remaining_calories: float = 1200.0,
    ) -> List[Dict[str, Any]]:
        """
        Generates 2 to 4 distinct, practical optimization candidates.
        Each candidate contains:
        - title
        - description
        - changes (human-readable list of changes)
        - modifications (structured modification objects)
        - modified_inputs (List[ConfirmedFoodItemInput]) for deterministic recalculation
        """
        if not current_items:
            return []

        candidates: List[Dict[str, Any]] = []
        goal_upper = str(goal).upper()
        is_non_veg = self._is_non_veg(current_items)

        # -------------------------------------------------------------
        # CANDIDATE 1: Grain / Base Portion Moderation (e.g. -25% rice)
        # -------------------------------------------------------------
        # Find primary carb/grain base item
        base_item_idx = -1
        for idx, item in enumerate(current_items):
            if self._is_grain_or_base(item.food_name):
                base_item_idx = idx
                break

        # Fallback to largest calorie/portion item if no grain keyword found
        if base_item_idx == -1 and len(current_items) > 0:
            base_item_idx = 0

        if base_item_idx != -1 and (MealIssueEnum.HIGH_CALORIE in issues or goal_upper in ("WEIGHT_LOSS", "MAINTENANCE", "GENERAL_HEALTH")):
            target_item = current_items[base_item_idx]
            orig_portion = target_item.portion_value
            # Realistic 25% reduction
            reduced_portion = round(orig_portion * 0.75, 1)

            modified_list = [
                ConfirmedFoodItemInput(
                    food_id=item.food_id,
                    food_name=item.food_name,
                    portion_value=item.portion_value,
                    portion_unit=item.portion_unit,
                    is_exact_weight=item.is_exact_weight,
                    confidence_score=item.confidence_score,
                )
                for item in current_items
            ]
            modified_list[base_item_idx].portion_value = reduced_portion

            candidates.append({
                "candidate_key": "reduce_base",
                "title": f"Moderate {target_item.food_name} Portion",
                "description": f"Reduce the {target_item.food_name} serving by ~25% to manage calorie density without altering dish flavor.",
                "changes": [
                    f"Reduced {target_item.food_name} from {int(orig_portion)}{target_item.portion_unit} to {int(round(reduced_portion))}{target_item.portion_unit} (-25%)"
                ],
                "modifications": [
                    {
                        "type": ModificationTypeEnum.REDUCE_PORTION.value,
                        "food_id": target_item.food_id,
                        "food_name": target_item.food_name,
                        "original_portion": orig_portion,
                        "new_portion": reduced_portion,
                        "unit": target_item.portion_unit,
                        "percentage": 25.0,
                        "reason": "Lower calorie density while preserving meal identity",
                    }
                ],
                "modified_inputs": modified_list,
            })

        # -------------------------------------------------------------
        # CANDIDATE 2: Lean Protein Addition (e.g. +100g Chicken / Paneer / Dal)
        # -------------------------------------------------------------
        protein_food: Optional[FoodItem] = None
        protein_portion = 100.0
        protein_unit = "g"

        if is_non_veg:
            # Non-veg: prefer Grilled Chicken Breast or Boiled Egg
            protein_food = (
                self.provider.get_food_by_name("Grilled Chicken Breast")
                or self.provider.get_food_by_name("Chicken Curry")
                or self.provider.get_food_by_name("Boiled Egg")
            )
        else:
            # Vegetarian: prefer Paneer, Dal Tadka, or Boiled Egg/Curd
            protein_food = (
                self.provider.get_food_by_name("Paneer")
                or self.provider.get_food_by_name("Dal Tadka")
                or self.provider.get_food_by_name("Curd / Dahi")
            )

        if protein_food:
            modified_list_pro = [
                ConfirmedFoodItemInput(
                    food_id=item.food_id,
                    food_name=item.food_name,
                    portion_value=item.portion_value,
                    portion_unit=item.portion_unit,
                    is_exact_weight=item.is_exact_weight,
                    confidence_score=item.confidence_score,
                )
                for item in current_items
            ]
            modified_list_pro.append(
                ConfirmedFoodItemInput(
                    food_id=protein_food.id,
                    food_name=protein_food.name,
                    portion_value=protein_portion,
                    portion_unit=protein_unit,
                    is_exact_weight=True,
                    confidence_score=0.95,
                )
            )

            candidates.append({
                "candidate_key": "add_protein",
                "title": f"Pair with {protein_food.name}",
                "description": f"Add {int(protein_portion)}{protein_unit} of verified {protein_food.name} to boost meal protein density and prolong satiety.",
                "changes": [
                    f"Added {int(protein_portion)}{protein_unit} {protein_food.name} (+{round(protein_food.protein, 1)}g protein)"
                ],
                "modifications": [
                    {
                        "type": ModificationTypeEnum.ADD_FOOD.value,
                        "food_id": protein_food.id,
                        "food_name": protein_food.name,
                        "original_portion": None,
                        "new_portion": protein_portion,
                        "unit": protein_unit,
                        "percentage": None,
                        "reason": "Enhance amino acid availability and muscle preservation",
                    }
                ],
                "modified_inputs": modified_list_pro,
            })

        # -------------------------------------------------------------
        # CANDIDATE 3: Balanced Composite (Reduce Base -20% + Add Veggie / Fiber / Raita)
        # -------------------------------------------------------------
        fiber_food: Optional[FoodItem] = (
            self.provider.get_food_by_name("Cucumber Raita")
            or self.provider.get_food_by_name("Sambar")
            or self.provider.get_food_by_name("Mixed Vegetable Sabzi")
            or self.provider.get_food_by_name("Cucumber Salad")
        )

        if fiber_food:
            modified_list_bal = [
                ConfirmedFoodItemInput(
                    food_id=item.food_id,
                    food_name=item.food_name,
                    portion_value=item.portion_value,
                    portion_unit=item.portion_unit,
                    is_exact_weight=item.is_exact_weight,
                    confidence_score=item.confidence_score,
                )
                for item in current_items
            ]

            bal_changes = []
            bal_mods = []

            # Reduce base slightly if grain item exists
            if base_item_idx != -1:
                t_item = current_items[base_item_idx]
                mod_val = round(t_item.portion_value * 0.80, 1)  # -20%
                modified_list_bal[base_item_idx].portion_value = mod_val
                bal_changes.append(
                    f"Moderated {t_item.food_name} from {int(t_item.portion_value)}{t_item.portion_unit} to {int(round(mod_val))}{t_item.portion_unit} (-20%)"
                )
                bal_mods.append({
                    "type": ModificationTypeEnum.REDUCE_PORTION.value,
                    "food_id": t_item.food_id,
                    "food_name": t_item.food_name,
                    "original_portion": t_item.portion_value,
                    "new_portion": mod_val,
                    "unit": t_item.portion_unit,
                    "percentage": 20.0,
                    "reason": "Calorie offset for nutrient-dense side",
                })

            # Add fiber/probiotic side
            fib_portion = 120.0 if "raita" in fiber_food.name.lower() or "sambar" in fiber_food.name.lower() else 100.0
            modified_list_bal.append(
                ConfirmedFoodItemInput(
                    food_id=fiber_food.id,
                    food_name=fiber_food.name,
                    portion_value=fib_portion,
                    portion_unit="g",
                    is_exact_weight=True,
                    confidence_score=0.90,
                )
            )
            bal_changes.append(f"Added {int(fib_portion)}g {fiber_food.name} for dietary fiber and micronutrients")
            bal_mods.append({
                "type": ModificationTypeEnum.ADD_FOOD.value,
                "food_id": fiber_food.id,
                "food_name": fiber_food.name,
                "original_portion": None,
                "new_portion": fib_portion,
                "unit": "g",
                "percentage": None,
                "reason": "Promote digestive health and glycemic control",
            })

            candidates.append({
                "candidate_key": "balanced_combo",
                "title": f"Balanced Option: Pair with {fiber_food.name}",
                "description": f"Balance the carbohydrate base by moderating portion slightly and adding fresh {fiber_food.name} for dietary fiber and satiety.",
                "changes": bal_changes,
                "modifications": bal_mods,
                "modified_inputs": modified_list_bal,
            })

        # -------------------------------------------------------------
        # CANDIDATE 4: Weight Gain / Muscle Surplus (if goal is WEIGHT_GAIN)
        # -------------------------------------------------------------
        if goal_upper == "WEIGHT_GAIN" and base_item_idx != -1:
            t_item = current_items[base_item_idx]
            increased_val = round(t_item.portion_value * 1.25, 1)  # +25%
            modified_list_gain = [
                ConfirmedFoodItemInput(
                    food_id=item.food_id,
                    food_name=item.food_name,
                    portion_value=item.portion_value,
                    portion_unit=item.portion_unit,
                    is_exact_weight=item.is_exact_weight,
                    confidence_score=item.confidence_score,
                )
                for item in current_items
            ]
            modified_list_gain[base_item_idx].portion_value = increased_val

            candidates.append({
                "candidate_key": "increase_energy",
                "title": f"Increase {t_item.food_name} Portion (+25%)",
                "description": f"Increase {t_item.food_name} serving by ~25% to support a healthy, sustainable caloric surplus.",
                "changes": [
                    f"Increased {t_item.food_name} from {int(t_item.portion_value)}{t_item.portion_unit} to {int(round(increased_val))}{t_item.portion_unit} (+25%)"
                ],
                "modifications": [
                    {
                        "type": ModificationTypeEnum.INCREASE_PORTION.value,
                        "food_id": t_item.food_id,
                        "food_name": t_item.food_name,
                        "original_portion": t_item.portion_value,
                        "new_portion": increased_val,
                        "unit": t_item.portion_unit,
                        "percentage": 25.0,
                        "reason": "Progressive caloric surplus support",
                    }
                ],
                "modified_inputs": modified_list_gain,
            })

        return candidates
