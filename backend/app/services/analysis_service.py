import os
import uuid
from typing import Tuple, Dict, Any
from fastapi import UploadFile, HTTPException, status
from PIL import Image
import io

from app.core.config import settings
from app.ai.factory import get_ai_provider
from app.schemas.analyze import FoodAnalysisResponse, DetectedFoodItemSchema


class AnalysisService:
    @staticmethod
    def validate_image_file(file: UploadFile, content: bytes) -> Tuple[int, int]:
        """
        Validates content type, file size, and verifies image integrity using PIL.
        Returns (width, height).
        """
        if len(content) > settings.MAX_UPLOAD_SIZE_BYTES:
            max_mb = settings.MAX_UPLOAD_SIZE_BYTES // (1024 * 1024)
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"Image file exceeds maximum allowable size of {max_mb}MB.",
            )

        # Check content type header
        if file.content_type not in settings.ALLOWED_IMAGE_TYPES:
            allowed = ", ".join(settings.ALLOWED_IMAGE_TYPES)
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail=f"Unsupported image format: {file.content_type}. Allowed types: {allowed}",
            )

        # Verify image integrity
        try:
            image = Image.open(io.BytesIO(content))
            image.verify()  # Verifies file header and structure
            # Reopen to get dimensions (verify() closes/invalidates the image stream)
            image = Image.open(io.BytesIO(content))
            width, height = image.size
            return width, height
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file is corrupted or not a valid image.",
            )

    @classmethod
    async def process_food_image(
        cls, file: UploadFile
    ) -> FoodAnalysisResponse:
        content = await file.read()
        if not content:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Empty image file received.",
            )

        # Validate file
        width, height = cls.validate_image_file(file, content)

        # Generate unique identifier and store file
        session_id = str(uuid.uuid4())
        ext = os.path.splitext(file.filename or "")[1].lower()
        if not ext:
            ext = ".jpg"
        
        stored_filename = f"{session_id}{ext}"
        os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
        file_path = os.path.join(settings.UPLOAD_DIR, stored_filename)

        with open(file_path, "wb") as f:
            f.write(content)

        # Invoke AI Provider abstraction
        provider = get_ai_provider()
        ai_result = await provider.analyze_food_image(
            image_bytes=content, filename=file.filename or stored_filename
        )

        detected_schemas = [
            DetectedFoodItemSchema(
                name=item.name,
                confidence=item.confidence,
                matched_food_id=item.matched_food_id,
                suggested_serving_size=item.suggested_serving_size,
                suggested_serving_unit=item.suggested_serving_unit,
                bounding_box=item.bounding_box,
            )
            for item in ai_result.detected_foods
        ]

        image_metadata: Dict[str, Any] = {
            "original_filename": file.filename,
            "stored_filename": stored_filename,
            "size_bytes": len(content),
            "dimensions": f"{width}x{height}",
            "content_type": file.content_type,
            "relative_url": f"/uploads/{stored_filename}",
        }

        return FoodAnalysisResponse(
            meal_id=session_id,
            status=ai_result.status,
            foods=detected_schemas,
            nutrition=None,
            confidence=ai_result.overall_confidence,
            recommendations=[r.suggestion for r in ai_result.recommendations],
            notice=ai_result.phase_notice,
            image_metadata=image_metadata,
        )
