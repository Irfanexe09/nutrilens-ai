from abc import ABC, abstractmethod
from typing import List, Optional, Dict, Any
from dataclasses import dataclass, field


@dataclass
class DetectedItemCandidate:
    name: str
    confidence: float
    matched_food_id: Optional[int] = None
    suggested_serving_size: Optional[float] = None
    suggested_serving_unit: Optional[str] = None
    bounding_box: Optional[List[float]] = None  # [ymin, xmin, ymax, xmax]


@dataclass
class AIRecommendation:
    category: str  # e.g., "portion_adjustment", "protein_boost", "fiber_addition"
    suggestion: str
    rationale: str
    estimated_calorie_delta: Optional[float] = None
    estimated_protein_delta: Optional[float] = None


@dataclass
class AIAnalysisResult:
    status: str  # "pending", "completed", "unsupported"
    detected_foods: List[DetectedItemCandidate] = field(default_factory=list)
    overall_confidence: Optional[float] = None
    recommendations: List[AIRecommendation] = field(default_factory=list)
    phase_notice: str = ""
    processing_metadata: Dict[str, Any] = field(default_factory=dict)


class AIProvider(ABC):
    """
    Abstract Vision & Nutrition AI Provider.
    Enables swapping between multimodal providers (Gemini, OpenAI, Claude, YOLO, custom PyTorch)
    without touching core business logic or route handlers.
    """

    @abstractmethod
    async def analyze_food_image(
        self, image_bytes: bytes, filename: str
    ) -> AIAnalysisResult:
        """Process image and return identified food items and recommendations."""
        pass

    @abstractmethod
    async def identify_food_items(
        self, image_bytes: bytes
    ) -> List[DetectedItemCandidate]:
        """Detect and classify food items from image."""
        pass

    @abstractmethod
    async def generate_meal_recommendations(
        self, meal_summary: Dict[str, Any], user_goal: str = "balanced"
    ) -> List[AIRecommendation]:
        """Generate personalized improvement suggestions according to user goal."""
        pass
