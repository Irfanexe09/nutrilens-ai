from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.user import User
from app.core.security import get_current_user
from app.services.weight_service import WeightService
from app.schemas.weight import (
    WeightEntryCreate,
    WeightEntryUpdate,
    WeightEntryResponse,
    WeightHistoryResponse,
)

router = APIRouter(prefix="/weight", tags=["Weight History & Body Measurements"])


@router.post("", response_model=WeightEntryResponse, status_code=status.HTTP_201_CREATED)
def create_weight_entry(
    entry_in: WeightEntryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Record a new weight measurement with date and optional notes.
    If this is the most recent entry, automatically syncs UserProfile.weight_kg
    and recalculates active nutrition targets.
    """
    service = WeightService(db)
    entry = service.create_entry(user_id=current_user.id, entry_in=entry_in)
    return WeightEntryResponse.model_validate(entry)


@router.get("", response_model=WeightHistoryResponse)
def list_weight_entries(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    start_date: Optional[date] = Query(None, description="Filter from start date"),
    end_date: Optional[date] = Query(None, description="Filter to end date"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Retrieve logged weight history for the authenticated user, ordered from newest to oldest,
    along with change calculation and overall trend direction.
    """
    service = WeightService(db)
    entries, total, latest, change_kg, trend = service.list_entries(
        user_id=current_user.id,
        skip=skip,
        limit=limit,
        start_date=start_date,
        end_date=end_date,
    )
    return WeightHistoryResponse(
        entries=[WeightEntryResponse.model_validate(e) for e in entries],
        total=total,
        latest=WeightEntryResponse.model_validate(latest) if latest else None,
        change_kg=change_kg,
        trend=trend,
    )


@router.get("/{entry_id}", response_model=WeightEntryResponse)
def get_weight_entry(
    entry_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve a specific weight entry owned by the authenticated user."""
    service = WeightService(db)
    entry = service.get_entry(user_id=current_user.id, entry_id=entry_id)
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Weight entry with ID '{entry_id}' not found",
        )
    return WeightEntryResponse.model_validate(entry)


@router.put("/{entry_id}", response_model=WeightEntryResponse)
def update_weight_entry(
    entry_id: str,
    update_in: WeightEntryUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update an existing weight measurement owned by the authenticated user."""
    service = WeightService(db)
    entry = service.update_entry(
        user_id=current_user.id, entry_id=entry_id, update_in=update_in
    )
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Weight entry with ID '{entry_id}' not found",
        )
    return WeightEntryResponse.model_validate(entry)


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_weight_entry(
    entry_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a weight measurement owned by the authenticated user."""
    service = WeightService(db)
    deleted = service.delete_entry(user_id=current_user.id, entry_id=entry_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Weight entry with ID '{entry_id}' not found",
        )
    return None
