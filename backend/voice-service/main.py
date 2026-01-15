"""
Voice Verification Service
Real voice biometric verification with liveness detection

This service implements:
- Voice Enrollment
- Voice Verification
- Liveness Detection
- Voice Clone Detection
- Coercion Detection
"""

from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import os
from dotenv import load_dotenv
from services.enrollment import enrollment_service
from services.verification import verification_service
from services.challenge import challenge_service
from db.connection import get_db_connection, close_db_connection
from utils.logger import get_logger

load_dotenv()

logger = get_logger(__name__)

app = FastAPI(title="Voice Verification Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:3001").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request models
class AudioSample(BaseModel):
    audio_data: str  # Base64 encoded or file reference
    duration: Optional[float] = None
    sample_rate: Optional[int] = None
    snr: Optional[float] = None

class EnrollmentRequest(BaseModel):
    user_id: str
    org_id: str
    audio_samples: List[AudioSample]

class VerificationRequest(BaseModel):
    user_id: str
    challenge_id: str
    audio_response: AudioSample
    device_metadata: Optional[Dict[str, Any]] = None

class ChallengeRequest(BaseModel):
    user_id: str
    intent_id: Optional[str] = None
    level: str  # L1, L2, L3
    language: str = "EN"

@app.on_event("startup")
async def startup():
    """Initialize database connection"""
    await get_db_connection()
    logger.info("Voice Verification Service started")

@app.on_event("shutdown")
async def shutdown():
    """Close database connection"""
    await close_db_connection()
    logger.info("Voice Verification Service stopped")

@app.get("/health")
async def health():
    """Health check"""
    try:
        db = await get_db_connection()
        await db.fetchval("SELECT 1")
        return {"status": "ok", "service": "voice-service", "database": "connected"}
    except Exception as e:
        logger.error("Health check failed", exc_info=e)
        return {"status": "degraded", "service": "voice-service", "database": "disconnected"}

@app.post("/api/voice/enroll")
async def enroll_voice(request: EnrollmentRequest):
    """Enroll user voice"""
    try:
        result = await enrollment_service.enroll_voice(
            request.user_id,
            [s.dict() for s in request.audio_samples],
            request.org_id
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Enrollment failed", exc_info=e)
        raise HTTPException(status_code=500, detail="Enrollment failed")

@app.get("/api/voice/enrollment/{user_id}/status")
async def get_enrollment_status(user_id: str):
    """Get enrollment status"""
    try:
        result = await enrollment_service.get_enrollment_status(user_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error("Get enrollment status failed", exc_info=e)
        raise HTTPException(status_code=500, detail="Failed to get enrollment status")

@app.post("/api/voice/enrollment/{user_id}/complete")
async def complete_enrollment(user_id: str, final_sample: AudioSample):
    """Complete enrollment"""
    try:
        result = await enrollment_service.complete_enrollment(user_id, final_sample.dict())
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Complete enrollment failed", exc_info=e)
        raise HTTPException(status_code=500, detail="Failed to complete enrollment")

@app.delete("/api/voice/enrollment/{user_id}")
async def delete_enrollment(user_id: str):
    """Delete enrollment"""
    try:
        await enrollment_service.delete_enrollment(user_id)
        return {"message": "Enrollment deleted successfully"}
    except Exception as e:
        logger.error("Delete enrollment failed", exc_info=e)
        raise HTTPException(status_code=500, detail="Failed to delete enrollment")

@app.post("/api/voice/challenge/generate")
async def generate_challenge(request: ChallengeRequest):
    """Generate voice challenge"""
    try:
        result = await challenge_service.generate_challenge(
            request.user_id,
            request.intent_id,
            request.level,
            request.language
        )
        return result
    except Exception as e:
        logger.error("Generate challenge failed", exc_info=e)
        raise HTTPException(status_code=500, detail="Failed to generate challenge")

@app.post("/api/voice/challenge/verify")
async def verify_challenge(
    challenge_id: str = Form(...),
    audio_response: AudioSample = Form(...)
):
    """Verify challenge response"""
    try:
        challenge = await challenge_service.get_challenge(challenge_id)
        if not challenge:
            raise HTTPException(status_code=404, detail="Challenge not found")
        
        result = await challenge_service.verify_challenge_response(
            audio_response.dict(),
            challenge
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Verify challenge failed", exc_info=e)
        raise HTTPException(status_code=500, detail="Failed to verify challenge")

@app.post("/api/voice/verify")
async def verify_voice(request: VerificationRequest):
    """Verify voice"""
    try:
        result = await verification_service.verify_voice(
            request.user_id,
            request.challenge_id,
            request.audio_response.dict(),
            request.device_metadata
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Voice verification failed", exc_info=e)
        raise HTTPException(status_code=500, detail="Voice verification failed")

@app.get("/api/voice/proof/{proof_id}")
async def get_voice_proof(proof_id: str):
    """Get voice proof by ID"""
    try:
        db = await get_db_connection()
        result = await db.fetchrow(
            """
            SELECT * FROM voice_proofs WHERE id = $1
            """,
            [proof_id]
        )
        
        if not result:
            raise HTTPException(status_code=404, detail="Voice proof not found")
        
        return dict(result)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Get voice proof failed", exc_info=e)
        raise HTTPException(status_code=500, detail="Failed to get voice proof")

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8001"))
    uvicorn.run(app, host="0.0.0.0", port=port)
