"""
Pattern Analysis Service
Analyzes user transfer patterns
"""

from typing import Dict, Any
from datetime import datetime, timedelta
from db.connection import get_db_connection
from utils.logger import get_logger

logger = get_logger(__name__)

async def analyze_patterns(
    user_id: str,
    intent_data: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Analyze user transfer patterns
    
    Args:
        user_id: User ID
        intent_data: Current intent data
        
    Returns:
        Pattern analysis result with risk score
    """
    if not user_id:
        return {'risk_score': 0, 'patterns': []}
    
    db = await get_db_connection()
    
    # Get user's transfer history
    history = await db.fetch(
        """
        SELECT amount_minor, created_at, status, beneficiary_id
        FROM intents
        WHERE created_by_user_id = $1
        AND created_at > NOW() - INTERVAL '90 days'
        ORDER BY created_at DESC
        LIMIT 100
        """,
        [user_id]
    )
    
    if not history:
        return {'risk_score': 0, 'patterns': []}
    
    patterns = []
    risk_score = 0
    
    # Analyze amount patterns
    amounts = [float(row['amount_minor']) for row in history]
    avg_amount = sum(amounts) / len(amounts) if amounts else 0
    current_amount = intent_data.get('amount_minor', 0)
    
    if current_amount > avg_amount * 2:
        patterns.append({
            'type': 'AMOUNT_PATTERN_DEVIATION',
            'severity': 5,
            'details': {
                'current': current_amount,
                'average': avg_amount,
                'deviation': ((current_amount - avg_amount) / avg_amount) * 100
            }
        })
        risk_score += 5
    
    # Analyze frequency patterns
    if len(history) > 10:
        # Check for unusual frequency
        recent_count = len([h for h in history[:10]])
        if recent_count >= 8:
            patterns.append({
                'type': 'HIGH_FREQUENCY_PATTERN',
                'severity': 5,
                'details': {
                    'recent_transfers': recent_count,
                    'timeframe': 'recent'
                }
            })
            risk_score += 5
    
    # Analyze beneficiary diversity
    unique_beneficiaries = len(set(row['beneficiary_id'] for row in history))
    total_transfers = len(history)
    
    if total_transfers > 0:
        diversity_ratio = unique_beneficiaries / total_transfers
        
        if diversity_ratio < 0.3 and total_transfers > 20:
            # Low diversity - same beneficiaries repeatedly
            patterns.append({
                'type': 'LOW_BENEFICIARY_DIVERSITY',
                'severity': 3,
                'details': {
                    'unique_beneficiaries': unique_beneficiaries,
                    'total_transfers': total_transfers,
                    'diversity_ratio': diversity_ratio
                }
            })
            risk_score += 3
    
    return {
        'risk_score': min(15, risk_score),  # Cap pattern risk
        'patterns': patterns,
        'total_transfers': total_transfers,
        'unique_beneficiaries': unique_beneficiaries
    }
