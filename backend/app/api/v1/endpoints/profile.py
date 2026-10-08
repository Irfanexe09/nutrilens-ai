from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.user import User, UserProfile, DailyNutritionTarget
from app.schemas.profile import (
    ProfileCreate,
    ProfileUpdate,
    ProfileResponse,
    DailyTargetResponse,
    ProfileWithTargetResponse,
)
from app.core.security import get_current_user
from app.personalization.target_service import TargetCalculator

router = APIRouter(prefix="/profile", tags=["Personalization & Profile"])


@router.get("", response_model=ProfileWithTargetResponse)
def get_user_profile(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Retrieve current authenticated user's profile and active daily targets.
    """
    profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User profile not configured yet. Please complete onboarding.",
        )

    target = (
        db.query(DailyNutritionTarget)
        .filter(
            DailyNutritionTarget.user_id == user.id,
            DailyNutritionTarget.is_active.is_(True),
        )
        .order_by(DailyNutritionTarget.created_at.desc())
        .first()
    )
    if not target:
        # Compute targets from profile
        calc = TargetCalculator.calculate(
            weight_kg=profile.weight_kg,
            height_cm=profile.height_cm,
            age=profile.age,
            sex=profile.sex,
            activity_level=profile.activity_level,
            goal=profile.goal,
        )
        target = DailyNutritionTarget(
            user_id=user.id,
            bmr=calc.bmr,
            tdee=calc.tdee,
            calorie_target=calc.calorie_target,
            protein_target_g=calc.protein_target_g,
            carbohydrates_target_g=calc.carbohydrates_target_g,
            fat_target_g=calc.fat_target_g,
            fiber_target_g=calc.fiber_target_g,
            safety_warning=calc.safety_warning,
            disclaimer=calc.disclaimer,
            is_active=True,
        )
        db.add(target)
        db.commit()
        db.refresh(target)

    return ProfileWithTargetResponse(
        profile=ProfileResponse.model_validate(profile),
        targets=DailyTargetResponse.model_validate(target),
    )


@router.post("", response_model=ProfileWithTargetResponse, status_code=status.HTTP_200_OK)
@router.put("", response_model=ProfileWithTargetResponse)
def upsert_user_profile(
    profile_in: ProfileCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Create or update user profile metrics, and deterministically recalculate
    BMR, TDEE, and daily macro/fiber targets with safety safeguards.
    """
    # 1. Deterministic target calculation
    calc = TargetCalculator.calculate(
        weight_kg=profile_in.weight_kg,
        height_cm=profile_in.height_cm,
        age=profile_in.age,
        sex=profile_in.sex,
        activity_level=profile_in.activity_level,
        goal=profile_in.goal,
    )

    # 2. Upsert profile
    profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
    if profile:
        profile.name = profile_in.name or user.name
        profile.age = profile_in.age
        profile.sex = profile_in.sex.value
        profile.height_cm = profile_in.height_cm
        profile.weight_kg = profile_in.weight_kg
        profile.activity_level = profile_in.activity_level.value
        profile.goal = profile_in.goal.value
    else:
        profile = UserProfile(
            user_id=user.id,
            name=profile_in.name or user.name,
            age=profile_in.age,
            sex=profile_in.sex.value,
            height_cm=profile_in.height_cm,
            weight_kg=profile_in.weight_kg,
            activity_level=profile_in.activity_level.value,
            goal=profile_in.goal.value,
        )
        db.add(profile)

    # 3. Deactivate existing active targets
    db.query(DailyNutritionTarget).filter(
        DailyNutritionTarget.user_id == user.id,
        DailyNutritionTarget.is_active.is_(True),
    ).update({"is_active": False})

    # 4. Create new active target record
    new_target = DailyNutritionTarget(
        user_id=user.id,
        bmr=calc.bmr,
        tdee=calc.tdee,
        calorie_target=calc.calorie_target,
        protein_target_g=calc.protein_target_g,
        carbohydrates_target_g=calc.carbohydrates_target_g,
        fat_target_g=calc.fat_target_g,
        fiber_target_g=calc.fiber_target_g,
        safety_warning=calc.safety_warning,
        disclaimer=calc.disclaimer,
        is_active=True,
    )
    db.add(new_target)

    db.commit()
    db.refresh(profile)
    db.refresh(new_target)

    return ProfileWithTargetResponse(
        profile=ProfileResponse.model_validate(profile),
        targets=DailyTargetResponse.model_validate(new_target),
    )


@router.get("/targets", response_model=DailyTargetResponse)
def get_user_targets(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get user's current active daily nutrition targets and safety disclaimers.
    """
    target = (
        db.query(DailyNutritionTarget)
        .filter(
            DailyNutritionTarget.user_id == user.id,
            DailyNutritionTarget.is_active.is_(True),
        )
        .order_by(DailyNutritionTarget.created_at.desc())
        .first()
    )
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No daily targets found. Please set up your profile first.",
        )
    return DailyTargetResponse.model_validate(target)
