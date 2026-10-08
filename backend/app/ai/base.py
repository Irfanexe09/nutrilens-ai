from abc import ABC, abstractmethod
from typing import List, Optional, Dict, Any
from dataclasses import dataclass, field


class AIProviderError(Exception):
    """Base exception for AI provider errors."""
    pass


class AIProviderConfigError(AIProviderError):
    """Raised when an AI provider is missing required configuration (e.g. API keys)."""
    pass


class AIProviderTimeoutError(AIProviderError):
    """Raised when an AI provider call times out."""
    pass


class AIProviderResponseError(AIProviderError):
    """Raised when an AI provider returns an unparseable or invalid response."""
    pass


@dataclass
class EstimatedPortion:
    value: float
    unit: str
    display_text: Optional[str] = None

    def __post_init__(self):
        if not self.display_text:
            rounded_val = int(round(self.value)) if self.value == int(self.value) else round(self.value, 1)
            self.display_text = f"~{rounded_val} {self.unit}"


@dataclass
class DetectedItemCandidate:
    name: str
    confidence: float
    estimated_portion: EstimatedPortion = field(default_factory=lambda: EstimatedPortion(value=100.0, unit="g"))
    description: Optional[str] = None
    ingredients: List[str] = field(default_factory=list)
    uncertainties: List[str] = field(default_factory=list)
    matched_food_id: Optional[int] = None
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
    status: str  # "success", "pending", "error"
    detected_foods: List[DetectedItemCandidate] = field(default_factory=list)
    overall_confidence: float = 0.0
    uncertainties: List[str] = field(default_factory=list)
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
        """Process image and return identified food items, portions, confidence, and uncertainties."""
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
