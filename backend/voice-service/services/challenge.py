"""
Voice Challenge Service
Generates and manages voice challenges for verification
"""

import uuid
import json
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from db.connection import get_db_connection
from utils.logger import get_logger

logger = get_logger(__name__)

class ChallengeService:
    """Voice challenge service"""
    
    CHALLENGE_EXPIRY_MINUTES = 5
    
    async def generate_challenge(
        self,
        user_id: str,
        intent_id: Optional[str],
        level: str,  # L1, L2, L3
        language: str = 'EN'
    ) -> Dict[str, Any]:
        """
        Generate voice challenge
        
        Args:
            user_id: User ID
            intent_id: Intent ID (if for approval)
            level: Challenge level (L1, L2, L3)
            language: Language (EN, ES)
            
        Returns:
            Challenge object with challenge text and expected slots
        """
        logger.info(f"Generating voice challenge for user {user_id}, level {level}")
        
        # Generate challenge based on level
        challenge_data = self._generate_challenge_content(level, language)
        
        challenge_id = str(uuid.uuid4())
        challenge_nonce = str(uuid.uuid4())
        expires_at = datetime.now() + timedelta(minutes=self.CHALLENGE_EXPIRY_MINUTES)
        
        # Store challenge
        db = await get_db_connection()
        await db.execute(
            """
            INSERT INTO voice_challenges (
                id, intent_id, user_id, language, level,
                grammar_version, challenge_nonce, challenge_text,
                expected_slots_json, expires_at, created_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW()
            )
            """,
            [
                challenge_id,
                intent_id,
                user_id,
                language,
                level,
                'v1.0.0',  # Grammar version
                challenge_nonce,
                challenge_data['text'],
                json.dumps(challenge_data['expected_slots']),
                expires_at
            ]
        )
        
        logger.info(f"Challenge generated: {challenge_id}")
        
        return {
            'id': challenge_id,
            'intent_id': intent_id,
            'user_id': user_id,
            'language': language,
            'level': level,
            'challenge_text': challenge_data['text'],
            'expected_slots': challenge_data['expected_slots'],
            'expires_at': expires_at.isoformat()
        }
    
    def _generate_challenge_content(
        self,
        level: str,
        language: str
    ) -> Dict[str, Any]:
        """Generate challenge content based on level"""
        
        if level == 'L1':
            # Simple confirmation
            if language == 'ES':
                text = "Por favor confirme la aprobación"
                expected_slots = {
                    'slots': [
                        {
                            'name': 'confirmation',
                            'type': 'words',
                            'value': 'confirmar',
                            'spoken': ['confirmar', 'sí', 'aprobado'],
                            'position': 0
                        }
                    ]
                }
            else:
                text = "Please confirm approval"
                expected_slots = {
                    'slots': [
                        {
                            'name': 'confirmation',
                            'type': 'words',
                            'value': 'confirm',
                            'spoken': ['confirm', 'yes', 'approved'],
                            'position': 0
                        }
                    ]
                }
        
        elif level == 'L2':
            # Amount confirmation
            if language == 'ES':
                text = "Confirme el monto de diez mil dólares"
                expected_slots = {
                    'slots': [
                        {
                            'name': 'amount',
                            'type': 'amount',
                            'value': '10000',
                            'spoken': ['diez mil', '10000'],
                            'position': 0
                        }
                    ]
                }
            else:
                text = "Confirm the amount of ten thousand dollars"
                expected_slots = {
                    'slots': [
                        {
                            'name': 'amount',
                            'type': 'amount',
                            'value': '10000',
                            'spoken': ['ten thousand', '10000'],
                            'position': 0
                        }
                    ]
                }
        
        else:  # L3
            # Complex challenge with multiple elements
            if language == 'ES':
                text = "Confirme la transferencia de diez mil dólares al beneficiario"
                expected_slots = {
                    'slots': [
                        {
                            'name': 'action',
                            'type': 'words',
                            'value': 'transferencia',
                            'spoken': ['transferencia', 'transferir'],
                            'position': 0
                        },
                        {
                            'name': 'amount',
                            'type': 'amount',
                            'value': '10000',
                            'spoken': ['diez mil'],
                            'position': 1
                        }
                    ],
                    'prosody_modifier': {
                        'type': 'speed',
                        'target': 'amount',
                        'instruction': 'Say amount slowly'
                    }
                }
            else:
                text = "Confirm the transfer of ten thousand dollars to the beneficiary"
                expected_slots = {
                    'slots': [
                        {
                            'name': 'action',
                            'type': 'words',
                            'value': 'transfer',
                            'spoken': ['transfer', 'send'],
                            'position': 0
                        },
                        {
                            'name': 'amount',
                            'type': 'amount',
                            'value': '10000',
                            'spoken': ['ten thousand'],
                            'position': 1
                        }
                    ],
                    'prosody_modifier': {
                        'type': 'speed',
                        'target': 'amount',
                        'instruction': 'Say amount slowly'
                    }
                }
        
        return {
            'text': text,
            'expected_slots': expected_slots
        }
    
    async def get_challenge(self, challenge_id: str) -> Optional[Dict[str, Any]]:
        """Get challenge by ID"""
        db = await get_db_connection()
        result = await db.fetchrow(
            """
            SELECT * FROM voice_challenges WHERE id = $1
            """,
            [challenge_id]
        )
        
        if not result:
            return None
        
        return dict(result)
    
    async def verify_challenge_response(
        self,
        audio_response: Dict[str, Any],
        challenge: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Verify challenge response matches expected slots
        
        Args:
            audio_response: Audio response with transcript
            challenge: Challenge object
            
        Returns:
            Verification result with match score
        """
        # TODO: Implement actual speech recognition and slot matching
        # For now, simulate verification
        
        expected_slots = json.loads(challenge['expected_slots_json'])
        transcript = audio_response.get('transcript', '').lower()
        
        # Simple keyword matching (replace with actual ASR + NLU)
        match_count = 0
        total_slots = len(expected_slots.get('slots', []))
        
        for slot in expected_slots.get('slots', []):
            slot_value = slot.get('value', '').lower()
            spoken_variants = [v.lower() for v in slot.get('spoken', [])]
            
            if slot_value in transcript or any(v in transcript for v in spoken_variants):
                match_count += 1
        
        match_score = match_count / total_slots if total_slots > 0 else 0.0
        
        # Generate audio hash
        import hashlib
        audio_hash = hashlib.sha256(
            str(audio_response.get('audio_data', '')).encode()
        ).hexdigest()
        
        return {
            'verified': match_score >= 0.8,
            'score': match_score,
            'transcript': transcript,
            'language': 'en',  # TODO: Detect language
            'audio_hash': audio_hash,
            'matches': match_count,
            'total_slots': total_slots
        }

challenge_service = ChallengeService()
