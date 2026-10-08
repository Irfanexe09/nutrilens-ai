"""
NutriLens Deterministic Portion Converter.

Converts diverse user and vision-estimated units (grams, ml, pieces, servings)
into normalized reference grams, validating unit compatibility against food metadata.
"""

from dataclasses import dataclass
from typing import Optional, Set
from app.models.food import FoodItem


class UnsupportedUnitError(ValueError):
    """Raised when a unit is unsupported or incompatible with the food item."""
    pass


class InvalidPortionError(ValueError):
    """Raised when portion value is zero, negative, or invalid."""
    pass


@dataclass
class ConvertedPortion:
    original_value: float
    original_unit: str
    gram_weight: float
    scaling_factor: float  # Multiplier relative to food.serving_size
    conversion_notes: str


class PortionConverter:
    """Portion normalization service with strict unit validation."""

    GRAM_UNITS: Set[str] = {"g", "gram", "grams", "gm", "gms"}
    ML_UNITS: Set[str] = {"ml", "milliliter", "milliliters", "milli", "cc"}
    PIECE_UNITS: Set[str] = {
        "piece", "pieces", "pc", "pcs", "slice", "slices", "item", "items",
        "roti", "rotis", "chapati", "chapatis", "dosa", "dosas", "idli", "idlis",
        "vada", "vadas", "samosa", "samosas", "egg", "eggs", "banana", "bananas",
        "apple", "apples", "cube", "cubes"
    }
    SERVING_UNITS: Set[str] = {
        "serving", "servings", "plate", "plates", "bowl", "bowls",
        "cup", "cups", "glass", "glasses", "portion", "portions"
    }

    @classmethod
    def convert_to_grams(
        cls,
        food: FoodItem,
        value: float,
        unit: str,
    ) -> ConvertedPortion:
        """
        Converts given quantity and unit to grams based on food reference specifications.
        
        Args:
            food: Verified FoodItem model
            value: Numerical quantity (must be > 0)
            unit: String unit name (e.g. 'g', 'ml', 'piece', 'serving')
            
        Returns:
            ConvertedPortion containing normalized gram_weight and scaling_factor.
        """
        if value is None or value <= 0:
            raise InvalidPortionError(f"Portion amount must be greater than zero. Received: {value}")

        clean_unit = unit.strip().lower() if unit else "g"

        # Check allowed_units if configured on food
        allowed_list = [u.strip().lower() for u in (food.allowed_units or "g,serving").split(",")]

        # 1. GRAM CONVERSION
        if clean_unit in cls.GRAM_UNITS:
            gram_weight = round(float(value), 2)
            scaling = gram_weight / food.serving_size if food.serving_size > 0 else 1.0
            return ConvertedPortion(
                original_value=value,
                original_unit=unit,
                gram_weight=gram_weight,
                scaling_factor=scaling,
                conversion_notes=f"Direct metric measurement: {gram_weight}g",
            )

        # 2. MILLILITER CONVERSION
        if clean_unit in cls.ML_UNITS:
            # Check if food allows ml or has a density factor
            density = food.density_g_per_ml
            is_liquid_cat = food.category in ["Beverages", "Dairy", "Indian Main Course", "Vegetables"]
            
            if density is None and not is_liquid_cat and "ml" not in allowed_list:
                raise UnsupportedUnitError(
                    f"Milliliter measurement ('{unit}') is not applicable for solid food '{food.name}'. Allowed units: {food.allowed_units}"
                )
            
            effective_density = density if (density and density > 0) else 1.0
            gram_weight = round(float(value) * effective_density, 2)
            scaling = gram_weight / food.serving_size if food.serving_size > 0 else 1.0
            return ConvertedPortion(
                original_value=value,
                original_unit=unit,
                gram_weight=gram_weight,
                scaling_factor=scaling,
                conversion_notes=f"Converted {value} ml to {gram_weight}g using density {effective_density} g/ml",
            )

        # 3. PIECE / COUNT CONVERSION
        if clean_unit in cls.PIECE_UNITS:
            if not food.piece_weight_g or food.piece_weight_g <= 0:
                raise UnsupportedUnitError(
                    f"Piece-based measurement ('{unit}') is not supported for '{food.name}'. Please specify portion in grams (g) or ml."
                )
            
            gram_weight = round(float(value) * food.piece_weight_g, 2)
            scaling = gram_weight / food.serving_size if food.serving_size > 0 else 1.0
            return ConvertedPortion(
                original_value=value,
                original_unit=unit,
                gram_weight=gram_weight,
                scaling_factor=scaling,
                conversion_notes=f"Converted {value} piece(s) to {gram_weight}g (1 piece ≈ {food.piece_weight_g}g)",
            )

        # 4. SERVING / PLATE / BOWL CONVERSION
        if clean_unit in cls.SERVING_UNITS:
            # Default reference serving is food.serving_size
            gram_weight = round(float(value) * food.serving_size, 2)
            scaling = float(value)
            return ConvertedPortion(
                original_value=value,
                original_unit=unit,
                gram_weight=gram_weight,
                scaling_factor=scaling,
                conversion_notes=f"Converted {value} standard {unit}(s) to {gram_weight}g",
            )

        # 5. UNKNOWN / UNSUPPORTED UNIT
        raise UnsupportedUnitError(
            f"Unsupported unit '{unit}' for food '{food.name}'. Allowed units: {food.allowed_units or 'g, serving'}"
        )
