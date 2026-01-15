"""
Voice Verification Service
Handles voice verification with liveness, clone, and coercion detection
"""

import uuid
import json
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from services.liveness import detect_liveness
from services.clone_detection import detect_voice_clone
from services.coercion import detect_coercion
from services.voiceprint import get_voiceprint
from services.matching import match_voice
from services.challenge import get_challenge, verify_challenge_response
from db.connection import get_db_connection
from utils.encryption import encrypt_audio
from utils.storage import store_audio_recording
from utils.logger import get_logger

logger = get_logger(__name__)

class VerificationService:
    """Voice verification service"""
    
    MIN_VERIFICATION_CONFIDENCE = 0.85
    MIN_LIVENESS_SCORE = 0.90
    MAX_CLONE_SCORE = 0.30
    MAX_COERCION_SCORE = 0.25
    
    async def verify_voice(
        self,
        user_id: str,
        challenge_id: str,
        audio_response: Dict[str, Any],
        device_metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Verify voice with challenge-response mechanism
        
        Args:
            user_id: User ID
            challenge_id: Challenge ID
            audio_response: Audio response to challenge
            device_metadata: Device metadata (IP, user agent, etc.)
            
        Returns:
            Verification result with scores and voice proof ID
        """
        logger.info(f"Verifying voice for user {user_id}, challenge {challenge_id}")
        
        # 1. Get challenge
        challenge = await get_challenge(challenge_id)
        if not challenge:
            raise ValueError("Challenge not found")
        
        if datetime.fromisoformat(challenge['expires_at']) < datetime.now():
            raise ValueError("Challenge expired")
        
        # Verify challenge belongs to user
        if challenge['user_id'] != user_id:
            raise ValueError("Challenge user mismatch")
        
        # 2. Liveness detection
        logger.debug("Performing liveness detection")
        liveness_result = await detect_liveness(audio_response)
        
        if not liveness_result['is_live']:
            logger.warning(f"Liveness detection failed: {liveness_result['score']:.2f}")
            return {
                'verified': False,
                'reason': 'LIVENESS_FAILED',
                'liveness_score': liveness_result['score'],
                'details': liveness_result
            }
        
        if liveness_result['score'] < self.MIN_LIVENESS_SCORE:
            logger.warning(f"Liveness score too low: {liveness_result['score']:.2f}")
            return {
                'verified': False,
                'reason': 'LIVENESS_SCORE_INSUFFICIENT',
                'liveness_score': liveness_result['score'],
                'min_required': self.MIN_LIVENESS_SCORE
            }
        
        # 3. Voice clone detection
        logger.debug("Performing clone detection")
        clone_result = await detect_voice_clone(audio_response)
        
        if clone_result['is_clone']:
            logger.warning(f"Voice clone detected: {clone_result['score']:.2f}")
            return {
                'verified': False,
                'reason': 'VOICE_CLONE_DETECTED',
                'clone_score': clone_result['score'],
                'details': clone_result
            }
        
        if clone_result['score'] > self.MAX_CLONE_SCORE:
            logger.warning(f"Clone risk too high: {clone_result['score']:.2f}")
            return {
                'verified': False,
                'reason': 'CLONE_RISK_TOO_HIGH',
                'clone_score': clone_result['score'],
                'max_allowed': self.MAX_CLONE_SCORE
            }
        
        # 4. Coercion detection
        logger.debug("Performing coercion detection")
        coercion_result = await detect_coercion(audio_response)
        
        if coercion_result['is_coerced']:
            logger.warning(f"Coercion detected: {coercion_result['score']:.2f}")
            return {
                'verified': False,
                'reason': 'COERCION_DETECTED',
                'coercion_score': coercion_result['score'],
                'details': coercion_result
            }
        
        if coercion_result['score'] > self.MAX_COERCION_SCORE:
            logger.warning(f"Coercion risk too high: {coercion_result['score']:.2f}")
            return {
                'verified': False,
                'reason': 'COERCION_RISK_TOO_HIGH',
                'coercion_score': coercion_result['score'],
                'max_allowed': self.MAX_COERCION_SCORE
            }
        
        # 5. Get voiceprint
        voiceprint = await get_voiceprint(user_id)
        if not voiceprint:
            raise ValueError("User not enrolled")
        
        # 6. Match voice
        logger.debug("Matching voice against voiceprint")
        match_result = await match_voice(
            audio_response,
            voiceprint,
            challenge
        )
        
        # 7. Verify challenge response
        challenge_match = await verify_challenge_response(
            audio_response,
            challenge
        )
        
        # 8. Store audio recording (encrypted)
        audio_ref = await store_audio_recording(
            user_id,
            challenge_id,
            audio_response
        )
        
        # 9. Create voice proof
        voice_proof_id = str(uuid.uuid4())
        scores = {
            'identity_confidence': match_result['confidence'],
            'liveness_score': liveness_result['score'],
            'spoof_risk_score': clone_result['score'],
            'drift_score': match_result.get('drift', 0.0),
            'coercion_risk_score': coercion_result['score'],
            'challenge_match_score': challenge_match['score']
        }
        
        db = await get_db_connection()
        await db.execute(
            """
            INSERT INTO voice_proofs (
                id, intent_id, challenge_id, user_id, channel,
                transcript, transcript_language, scores_json,
                device_metadata_json, audio_encrypted_ref, audio_hash,
                model_version, created_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW()
            )
            """,
            [
                voice_proof_id,
                challenge.get('intent_id'),
                challenge_id,
                user_id,
                device_metadata.get('channel', 'BROWSER') if device_metadata else 'BROWSER',
                challenge_match.get('transcript', ''),
                challenge_match.get('language'),
                json.dumps(scores),
                json.dumps(device_metadata or {}),
                audio_ref,
                challenge_match.get('audio_hash'),
                'v1.0.0'  # Model version
            ]
        )
        
        verified = (
            match_result['confidence'] >= self.MIN_VERIFICATION_CONFIDENCE and
            challenge_match['score'] >= 0.8
        )
        
        logger.info(
            f"Voice verification {'PASSED' if verified else 'FAILED'} for user {user_id}, "
            f"confidence: {match_result['confidence']:.2f}"
        )
        
        return {
            'verified': verified,
            'voice_proof_id': voice_proof_id,
            'scores': scores,
            'confidence': match_result['confidence'],
            'challenge_match': challenge_match['score']
        }

verification_service = VerificationService()
