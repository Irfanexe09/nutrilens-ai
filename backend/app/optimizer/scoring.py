from typing import Dict, Any, List
import math


class CandidateScorer:
    """
    Deterministic scoring engine for candidate meal optimizations.
    
    Formula:
      Score = (0.40 * Goal_Alignment) + (0.30 * Budget_Alignment) + (0.30 * Practicality)
    
    Ensures normalized score [0.0, 1.0] and avoids extreme, unsustainable modifications.
    """

    @classmethod
    def score_candidate(
        cls,
        goal: str,
        original_nutrition: Dict[str, float],
        optimized_nutrition: Dict[str, float],
        remaining_calories: float,
        daily_target_calories: float,
    ) -> float:
        goal_upper = str(goal).upper()
        orig_cal = max(1.0, original_nutrition.get("calories", 0.0))
        opt_cal = max(1.0, optimized_nutrition.get("calories", 0.0))
        orig_pro = original_nutrition.get("protein", 0.0)
        opt_pro = optimized_nutrition.get("protein", 0.0)
        orig_fib = original_nutrition.get("fiber", 0.0)
        opt_fib = optimized_nutrition.get("fiber", 0.0)
        orig_fat = original_nutrition.get("fat", 0.0)
        opt_fat = optimized_nutrition.get("fat", 0.0)

        # -------------------------------------------------------------
        # 1. Goal Alignment Component (0.0 to 1.0, weight: 40%)
        # -------------------------------------------------------------
        goal_score = 0.5  # Neutral baseline

        if goal_upper == "WEIGHT_LOSS":
            # Rewards 15-30% sensible calorie deficit + protein preservation + fiber boost
            cal_ratio = opt_cal / orig_cal
            if 0.70 <= cal_ratio <= 0.85:
                cal_subscore = 1.0
            elif 0.60 <= cal_ratio < 0.70 or 0.85 < cal_ratio <= 0.95:
                cal_subscore = 0.8
            elif cal_ratio < 0.60:
                cal_subscore = 0.5  # Too steep a drop
            else:
                cal_subscore = 0.4  # Minimal or no calorie drop

            # Protein preservation
            pro_subscore = 1.0 if opt_pro >= orig_pro else max(0.5, opt_pro / max(1.0, orig_pro))
            # Fiber improvement bonus
            fib_subscore = 1.0 if opt_fib >= orig_fib + 2.0 else (0.8 if opt_fib >= orig_fib else 0.6)

            goal_score = (0.50 * cal_subscore) + (0.35 * pro_subscore) + (0.15 * fib_subscore)

        elif goal_upper == "MUSCLE_GAIN":
            # Rewards protein boost (+15g to +35g) and moderate calorie support
            pro_gain = opt_pro - orig_pro
            if pro_gain >= 20.0:
                pro_subscore = 1.0
            elif pro_gain >= 10.0:
                pro_subscore = 0.8
            elif pro_gain >= 0:
                pro_subscore = 0.6
            else:
                pro_subscore = 0.3

            # Calorie support (surplus or maintenance, not heavy reduction)
            cal_subscore = 1.0 if opt_cal >= orig_cal * 0.95 else 0.5
            goal_score = (0.65 * pro_subscore) + (0.35 * cal_subscore)

        elif goal_upper == "WEIGHT_GAIN":
            # Rewards healthy caloric surplus (+150 to +400 kcal) with high protein
            cal_gain = opt_cal - orig_cal
            if 150.0 <= cal_gain <= 450.0:
                cal_subscore = 1.0
            elif cal_gain > 0:
                cal_subscore = 0.8
            else:
                cal_subscore = 0.4
            pro_subscore = 1.0 if opt_pro >= orig_pro else 0.6
            goal_score = (0.60 * cal_subscore) + (0.40 * pro_subscore)

        else:
            # MAINTENANCE / GENERAL_HEALTH: Rewards macro balance and fiber
            macro_tot = (opt_pro * 4) + (opt_fat * 9) + (optimized_nutrition.get("carbohydrates", 0) * 4)
            if macro_tot > 0:
                pro_pct = (opt_pro * 4) / macro_tot
                fib_bonus = 1.0 if opt_fib >= 5.0 else 0.7
                pro_rating = 1.0 if 0.18 <= pro_pct <= 0.30 else 0.7
                goal_score = (0.60 * pro_rating) + (0.40 * fib_bonus)
            else:
                goal_score = 0.7

        # -------------------------------------------------------------
        # 2. Daily Budget Alignment Component (0.0 to 1.0, weight: 30%)
        # -------------------------------------------------------------
        if remaining_calories <= 0:
            # Already exceeded daily target; favor candidates with lower calories
            budget_score = max(0.2, min(1.0, 1.0 - (opt_cal / 800.0)))
        elif opt_cal <= remaining_calories:
            # Comfortably within budget
            budget_score = 1.0
        else:
            # Exceeds remaining budget: score decays based on excess magnitude
            overage = opt_cal - remaining_calories
            decay = overage / max(200.0, remaining_calories)
            budget_score = max(0.2, 1.0 - decay)

        # -------------------------------------------------------------
        # 3. Practicality & Magnitude of Change (0.0 to 1.0, weight: 30%)
        # -------------------------------------------------------------
        # Penalizes drastic changes (>50% calorie jump or drop) that are unsustainable
        cal_delta_pct = abs(opt_cal - orig_cal) / orig_cal
        if cal_delta_pct <= 0.35:
            # Realistic, practical, easily manageable change
            practicality_score = 1.0
        elif cal_delta_pct <= 0.50:
            practicality_score = 0.8
        else:
            # Drastic reduction or addition (e.g. cutting 850 kcal to 250 kcal)
            practicality_score = max(0.3, 1.0 - (cal_delta_pct - 0.50) * 1.5)

        # -------------------------------------------------------------
        # Final Weighted Score Calculation
        # -------------------------------------------------------------
        final_score = (
            (0.40 * goal_score) +
            (0.30 * budget_score) +
            (0.30 * practicality_score)
        )
        return round(max(0.0, min(1.0, final_score)), 2)
