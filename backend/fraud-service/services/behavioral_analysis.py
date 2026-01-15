"""
Behavioral Analysis Service
Analyzes user behavior patterns
"""

from typing import Dict, Any
from datetime import datetime, timedelta
from db.connection import get_db_connection
from utils.logger import get_logger

logger = get_logger(__name__)

async def analyze_behavior(
    user_id: str,
    intent_data: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Analyze user behavior patterns
    
    Args:
        user_id: User ID
        intent_data: Current intent data
        
    Returns:
        Behavioral analysis result with risk score
    """
    if not user_id:
        return {'risk_score': 0, 'behaviors': []}
    
    db = await get_db_connection()
    
    behaviors = []
    risk_score = 0
    
    # Analyze cancellation rate
    total_intents = await db.fetchval(
        """
        SELECT COUNT(*) FROM intents
        WHERE created_by_user_id = $1
        AND created_at > NOW() - INTERVAL '30 days'
        """,
        [user_id]
    )
    
    cancelled_intents = await db.fetchval(
        """
        SELECT COUNT(*) FROM intents
        WHERE created_by_user_id = $1
        AND status = 'CANCELED'
        AND created_at > NOW() - INTERVAL '30 days'
        """,
        [user_id]
    )
    
    if total_intents > 0:
        cancellation_rate = cancelled_intents / total_intents
        
        if cancellation_rate > 0.5:
            behaviors.append({
                'type': 'HIGH_CANCELLATION_RATE',
                'severity': 10,
                'details': {
                    'cancellation_rate': cancellation_rate,
                    'total_intents': total_intents,
                    'cancelled': cancelled_intents
                }
            })
            risk_score += 10
    
    # Analyze denial rate
    denied_intents = await db.fetchval(
        """
        SELECT COUNT(*) FROM intents
        WHERE created_by_user_id = $1
        AND status = 'DENIED'
        AND created_at > NOW() - INTERVAL '30 days'
        """,
        [user_id]
    )
    
    if total_intents > 0:
        denial_rate = denied_intents / total_intents
        
        if denial_rate > 0.3:
            behaviors.append({
                'type': 'HIGH_DENIAL_RATE',
                'severity': 15,
                'details': {
                    'denial_rate': denial_rate,
                    'total_intents': total_intents,
                    'denied': denied_intents
                }
            })
            risk_score += 15
    
    # Analyze edit frequency
    edited_intents = await db.fetchval(
        """
        SELECT COUNT(*) FROM intents
        WHERE created_by_user_id = $1
        AND updated_at != created_at
        AND created_at > NOW() - INTERVAL '30 days'
        """,
        [user_id]
    )
    
    if total_intents > 0:
        edit_rate = edited_intents / total_intents
        
        if edit_rate > 0.7:
            behaviors.append({
                'type': 'HIGH_EDIT_RATE',
                'severity': 5,
                'details': {
                    'edit_rate': edit_rate,
                    'total_intents': total_intents,
                    'edited': edited_intents
                }
            })
            risk_score += 5
    
    return {
        'risk_score': min(20, risk_score),  # Cap behavior risk
        'behaviors': behaviors,
        'total_intents': total_intents
    }
