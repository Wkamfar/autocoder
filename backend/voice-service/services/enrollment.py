"""
Voice Enrollment Service
Handles voice enrollment with liveness detection and quality checks
"""

import uuid
import json
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import numpy as np
from services.liveness import detect_liveness
from services.quality import check_audio_quality
from services.voiceprint import create_voiceprint, store_voiceprint, get_voiceprint
from services.verification import verify_voice_sample
from db.connection import get_db_connection
from utils.encryption import encrypt_audio
from utils.logger import get_logger

logger = get_logger(__name__)

class EnrollmentService:
    """Voice enrollment service"""
    
    MIN_SAMPLES_REQUIRED = 3
    MIN_ENROLLMENT_CONFIDENCE = 0.8
    
    async def enroll_voice(
        self,
        user_id: str,
        audio_samples: List[Dict[str, Any]],
        org_id: str
    ) -> Dict[str, Any]:
        """
        Enroll user voice with multiple samples
        
        Args:
            user_id: User ID
            audio_samples: List of audio samples (base64 encoded or file paths)
            org_id: Organization ID
            
        Returns:
            Enrollment result with voiceprint ID and confidence
        """
        logger.info(f"Starting voice enrollment for user {user_id}")
        
        # Validate sample count
        if len(audio_samples) < self.MIN_SAMPLES_REQUIRED:
            raise ValueError(
                f"At least {self.MIN_SAMPLES_REQUIRED} audio samples required"
            )
        
        # 1. Liveness detection for each sample
        liveness_results = []
        for i, sample in enumerate(audio_samples):
            logger.debug(f"Checking liveness for sample {i+1}/{len(audio_samples)}")
            liveness_result = await detect_liveness(sample)
            liveness_results.append(liveness_result)
            
            if not liveness_result['is_live']:
                logger.warning(f"Liveness detection failed for sample {i+1}")
                raise ValueError(
                    f"Liveness detection failed for sample {i+1}: "
                    f"{liveness_result.get('reason', 'Unknown')}"
                )
        
        # 2. Quality checks
        quality_result = await check_audio_quality(audio_samples)
        if not quality_result['passed']:
            logger.warning(f"Audio quality check failed: {quality_result['errors']}")
            raise ValueError(
                f"Audio quality insufficient: {', '.join(quality_result['errors'])}"
            )
        
        # 3. Create voiceprint from samples
        logger.info("Creating voiceprint from samples")
        voiceprint = await create_voiceprint(audio_samples)
        
        # 4. Store voiceprint (encrypted)
        voiceprint_id = str(uuid.uuid4())
        await store_voiceprint(user_id, voiceprint_id, voiceprint, org_id)
        
        # 5. Test verification with first sample
        logger.info("Testing verification with enrolled voiceprint")
        test_result = await verify_voice_sample(
            user_id,
            audio_samples[0],
            voiceprint
        )
        
        if test_result['confidence'] < self.MIN_ENROLLMENT_CONFIDENCE:
            # Delete voiceprint if test fails
            await self.delete_enrollment(user_id)
            raise ValueError(
                f"Enrollment quality insufficient. Confidence: {test_result['confidence']:.2f}, "
                f"required: {self.MIN_ENROLLMENT_CONFIDENCE}"
            )
        
        # Update user enrollment status
        db = await get_db_connection()
        await db.execute(
            """
            UPDATE users 
            SET voice_enrolled = TRUE, voice_enrolled_at = NOW()
            WHERE id = $1
            """,
            [user_id]
        )
        
        logger.info(
            f"Voice enrollment completed for user {user_id}, "
            f"confidence: {test_result['confidence']:.2f}"
        )
        
        return {
            'enrolled': True,
            'voiceprint_id': voiceprint_id,
            'confidence': test_result['confidence'],
            'quality_score': quality_result['score'],
            'liveness_scores': [r['score'] for r in liveness_results],
            'samples_count': len(audio_samples)
        }
    
    async def get_enrollment_status(self, user_id: str) -> Dict[str, Any]:
        """Get enrollment status for user"""
        db = await get_db_connection()
        result = await db.fetchrow(
            """
            SELECT voice_enrolled, voice_enrolled_at, 
                   (SELECT COUNT(*) FROM voiceprints WHERE user_id = $1) as voiceprint_count
            FROM users
            WHERE id = $1
            """,
            [user_id]
        )
        
        if not result:
            raise ValueError("User not found")
        
        return {
            'enrolled': result['voice_enrolled'],
            'enrolled_at': result['voice_enrolled_at'].isoformat() if result['voice_enrolled_at'] else None,
            'voiceprint_count': result['voiceprint_count']
        }
    
    async def complete_enrollment(
        self,
        user_id: str,
        final_sample: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Complete enrollment with final verification sample
        """
        # Verify final sample matches enrolled voiceprint
        voiceprint = await get_voiceprint(user_id)
        if not voiceprint:
            raise ValueError("No voiceprint found. Start enrollment first.")
        
        verification_result = await verify_voice_sample(
            user_id,
            final_sample,
            voiceprint
        )
        
        if verification_result['confidence'] < self.MIN_ENROLLMENT_CONFIDENCE:
            raise ValueError(
                f"Final verification failed. Confidence: {verification_result['confidence']:.2f}"
            )
        
        return {
            'completed': True,
            'confidence': verification_result['confidence']
        }
    
    async def delete_enrollment(self, user_id: str) -> None:
        """Delete voice enrollment"""
        db = await get_db_connection()
        
        # Delete voiceprint
        await db.execute(
            "DELETE FROM voiceprints WHERE user_id = $1",
            [user_id]
        )
        
        # Update user status
        await db.execute(
            """
            UPDATE users 
            SET voice_enrolled = FALSE, voice_enrolled_at = NULL
            WHERE id = $1
            """,
            [user_id]
        )
        
        logger.info(f"Voice enrollment deleted for user {user_id}")

enrollment_service = EnrollmentService()
