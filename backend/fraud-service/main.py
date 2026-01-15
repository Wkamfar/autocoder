"""
Fraud Detection Service
Real-time fraud detection and risk scoring
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
import os
from dotenv import load_dotenv
from services.risk_scoring import risk_scoring_service
from services.anomaly_detection import detect_anomalies
from services.pattern_analysis import analyze_patterns
from services.behavioral_analysis import analyze_behavior
from services.alert_service import alert_service
from db.connection import get_db_connection, close_db_connection
from utils.logger import get_logger

load_dotenv()

logger = get_logger(__name__)

app = FastAPI(title="Fraud Detection Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:3001").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request models
class RiskScoreRequest(BaseModel):
    intent_id: str
    intent_data: Dict[str, Any]
    beneficiary_data: Optional[Dict[str, Any]] = None
    user_data: Optional[Dict[str, Any]] = None

class AnomalyDetectionRequest(BaseModel):
    intent_data: Dict[str, Any]
    beneficiary_data: Optional[Dict[str, Any]] = None
    user_data: Optional[Dict[str, Any]] = None

@app.on_event("startup")
async def startup():
    """Initialize database connection"""
    await get_db_connection()
    logger.info("Fraud Detection Service started")

@app.on_event("shutdown")
async def shutdown():
    """Close database connection"""
    await close_db_connection()
    logger.info("Fraud Detection Service stopped")

@app.get("/health")
async def health():
    """Health check"""
    try:
        db = await get_db_connection()
        await db.fetchval("SELECT 1")
        return {"status": "ok", "service": "fraud-service", "database": "connected"}
    except Exception as e:
        logger.error("Health check failed", exc_info=e)
        return {"status": "degraded", "service": "fraud-service", "database": "disconnected"}

@app.post("/api/fraud/risk-score")
async def calculate_risk_score(request: RiskScoreRequest):
    """Calculate risk score for intent"""
    try:
        result = await risk_scoring_service.calculate_risk_score(
            request.intent_data,
            request.beneficiary_data or {},
            request.user_data or {}
        )
        
        # Create alert if risk score is high
        if result['score'] >= 60:
            await alert_service.create_alert(
                request.intent_id,
                'HIGH_RISK_SCORE',
                'HIGH' if result['score'] >= 80 else 'MEDIUM',
                {'risk_score': result['score'], 'factors': result['factors']},
                result['score']
            )
        
        return result
    except Exception as e:
        logger.error("Risk score calculation failed", exc_info=e)
        raise HTTPException(status_code=500, detail="Risk score calculation failed")

@app.post("/api/fraud/anomaly-detection")
async def detect_anomalies_endpoint(request: AnomalyDetectionRequest):
    """Detect anomalies"""
    try:
        anomalies = await detect_anomalies(
            request.intent_data,
            request.beneficiary_data or {},
            request.user_data or {}
        )
        
        return {
            'anomalies': anomalies,
            'count': len(anomalies),
            'total_severity': sum(a.get('severity', 0) for a in anomalies)
        }
    except Exception as e:
        logger.error("Anomaly detection failed", exc_info=e)
        raise HTTPException(status_code=500, detail="Anomaly detection failed")

@app.get("/api/fraud/patterns/{user_id}")
async def get_user_patterns(user_id: str):
    """Get fraud patterns for user"""
    try:
        patterns = await alert_service.get_user_patterns(user_id)
        return patterns
    except Exception as e:
        logger.error("Get user patterns failed", exc_info=e)
        raise HTTPException(status_code=500, detail="Failed to get user patterns")

@app.get("/api/fraud/alerts")
async def get_alerts(
    status: Optional[str] = None,
    severity: Optional[str] = None,
    intent_id: Optional[str] = None
):
    """Get fraud alerts"""
    try:
        filters = {}
        if status:
            filters['status'] = status
        if severity:
            filters['severity'] = severity
        if intent_id:
            filters['intent_id'] = intent_id
        
        alerts = await alert_service.get_alerts(filters)
        return {'alerts': alerts, 'count': len(alerts)}
    except Exception as e:
        logger.error("Get alerts failed", exc_info=e)
        raise HTTPException(status_code=500, detail="Failed to get alerts")

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8002"))
    uvicorn.run(app, host="0.0.0.0", port=port)
