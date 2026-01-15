"""
Anomaly Detection Service
Detects anomalies in transfer patterns
"""

import json
from typing import Dict, Any, List
from datetime import datetime, timedelta
from db.connection import get_db_connection
from utils.logger import get_logger

logger = get_logger(__name__)

async def detect_anomalies(
    intent_data: Dict[str, Any],
    beneficiary_data: Dict[str, Any],
    user_data: Dict[str, Any]
) -> List[Dict[str, Any]]:
    """
    Detect anomalies in transfer patterns
    
    Args:
        intent_data: Intent data
        beneficiary_data: Beneficiary data
        user_data: User data
        
    Returns:
        List of detected anomalies
    """
    anomalies = []
    
    # 1. Unusual transfer amount
    amount_anomaly = await _detect_amount_anomaly(intent_data, user_data)
    if amount_anomaly:
        anomalies.append(amount_anomaly)
    
    # 2. Unusual transfer time
    timing_anomaly = await _detect_timing_anomaly(intent_data, user_data)
    if timing_anomaly:
        anomalies.append(timing_anomaly)
    
    # 3. New beneficiary pattern
    beneficiary_anomaly = await _detect_beneficiary_anomaly(
        intent_data,
        beneficiary_data,
        user_data
    )
    if beneficiary_anomaly:
        anomalies.append(beneficiary_anomaly)
    
    # 4. Rapid-fire transfers
    rapid_fire_anomaly = await _detect_rapid_fire_anomaly(intent_data, user_data)
    if rapid_fire_anomaly:
        anomalies.append(rapid_fire_anomaly)
    
    # 5. Geographic anomalies
    geo_anomaly = await _detect_geographic_anomaly(intent_data, user_data)
    if geo_anomaly:
        anomalies.append(geo_anomaly)
    
    # 6. Device anomalies
    device_anomaly = await _detect_device_anomaly(intent_data, user_data)
    if device_anomaly:
        anomalies.append(device_anomaly)
    
    # 7. IP address anomalies
    ip_anomaly = await _detect_ip_anomaly(intent_data, user_data)
    if ip_anomaly:
        anomalies.append(ip_anomaly)
    
    return anomalies

async def _detect_amount_anomaly(
    intent_data: Dict[str, Any],
    user_data: Dict[str, Any]
) -> Dict[str, Any] | None:
    """Detect unusual transfer amounts"""
    amount_minor = intent_data.get('amount_minor', 0)
    user_id = intent_data.get('created_by_user_id')
    
    if not user_id:
        return None
    
    db = await get_db_connection()
    
    # Get user's average transfer amount
    avg_result = await db.fetchrow(
        """
        SELECT AVG(amount_minor) as avg_amount, MAX(amount_minor) as max_amount
        FROM intents
        WHERE created_by_user_id = $1
        AND status = 'EXECUTED'
        AND created_at > NOW() - INTERVAL '90 days'
        """,
        [user_id]
    )
    
    if not avg_result or not avg_result['avg_amount']:
        # First transfer - not necessarily anomalous
        return None
    
    avg_amount = float(avg_result['avg_amount'])
    max_amount = float(avg_result['max_amount'] or avg_amount)
    
    # Check if amount is significantly higher than average
    if amount_minor > avg_amount * 3:
        return {
            'type': 'UNUSUAL_AMOUNT',
            'severity': 15,
            'details': {
                'current_amount': amount_minor,
                'average_amount': avg_amount,
                'max_amount': max_amount,
                'deviation': (amount_minor / avg_amount) * 100
            }
        }
    
    # Check if amount exceeds historical maximum
    if amount_minor > max_amount * 1.5:
        return {
            'type': 'AMOUNT_EXCEEDS_HISTORICAL_MAX',
            'severity': 20,
            'details': {
                'current_amount': amount_minor,
                'historical_max': max_amount,
                'deviation': ((amount_minor - max_amount) / max_amount) * 100
            }
        }
    
    return None

async def _detect_timing_anomaly(
    intent_data: Dict[str, Any],
    user_data: Dict[str, Any]
) -> Dict[str, Any] | None:
    """Detect unusual transfer times"""
    created_at = intent_data.get('created_at')
    user_id = intent_data.get('created_by_user_id')
    
    if not created_at or not user_id:
        return None
    
    created_date = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
    hour = created_date.hour
    
    db = await get_db_connection()
    
    # Get user's typical transfer hours
    typical_hours = await db.fetch(
        """
        SELECT EXTRACT(HOUR FROM created_at) as hour, COUNT(*) as count
        FROM intents
        WHERE created_by_user_id = $1
        AND status = 'EXECUTED'
        AND created_at > NOW() - INTERVAL '90 days'
        GROUP BY EXTRACT(HOUR FROM created_at)
        ORDER BY count DESC
        LIMIT 3
        """,
        [user_id]
    )
    
    if not typical_hours:
        return None
    
    typical_hour_list = [int(row['hour']) for row in typical_hours]
    
    # Check if current hour is unusual
    if hour not in typical_hour_list:
        # Check if it's significantly different
        min_typical = min(typical_hour_list)
        max_typical = max(typical_hour_list)
        
        if hour < min_typical - 2 or hour > max_typical + 2:
            return {
                'type': 'UNUSUAL_TIME',
                'severity': 10,
                'details': {
                    'current_hour': hour,
                    'typical_hours': typical_hour_list
                }
            }
    
    return None

async def _detect_beneficiary_anomaly(
    intent_data: Dict[str, Any],
    beneficiary_data: Dict[str, Any],
    user_data: Dict[str, Any]
) -> Dict[str, Any] | None:
    """Detect new beneficiary patterns"""
    user_id = intent_data.get('created_by_user_id')
    beneficiary_id = intent_data.get('beneficiary_id')
    
    if not user_id or not beneficiary_id:
        return None
    
    db = await get_db_connection()
    
    # Check if user has used this beneficiary before
    previous_count = await db.fetchval(
        """
        SELECT COUNT(*) FROM intents
        WHERE created_by_user_id = $1
        AND beneficiary_id = $2
        AND status IN ('EXECUTED', 'APPROVED', 'PENDING_APPROVALS')
        """,
        [user_id, beneficiary_id]
    )
    
    if previous_count == 0:
        # Check how many new beneficiaries user has added recently
        new_beneficiaries = await db.fetchval(
            """
            SELECT COUNT(DISTINCT beneficiary_id) FROM intents
            WHERE created_by_user_id = $1
            AND created_at > NOW() - INTERVAL '7 days'
            AND beneficiary_id NOT IN (
                SELECT DISTINCT beneficiary_id FROM intents
                WHERE created_by_user_id = $1
                AND created_at <= NOW() - INTERVAL '7 days'
            )
            """,
            [user_id]
        )
        
        if new_beneficiaries >= 3:
            return {
                'type': 'MULTIPLE_NEW_BENEFICIARIES',
                'severity': 20,
                'details': {
                    'new_beneficiaries_count': new_beneficiaries,
                    'timeframe_days': 7
                }
            }
        else:
            return {
                'type': 'NEW_BENEFICIARY',
                'severity': 5,
                'details': {
                    'beneficiary_id': beneficiary_id
                }
            }
    
    return None

async def _detect_rapid_fire_anomaly(
    intent_data: Dict[str, Any],
    user_data: Dict[str, Any]
) -> Dict[str, Any] | None:
    """Detect rapid-fire transfer patterns"""
    user_id = intent_data.get('created_by_user_id')
    created_at = intent_data.get('created_at')
    
    if not user_id or not created_at:
        return None
    
    created_date = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
    
    db = await get_db_connection()
    
    # Count transfers in last hour
    recent_count = await db.fetchval(
        """
        SELECT COUNT(*) FROM intents
        WHERE created_by_user_id = $1
        AND created_at > $2 - INTERVAL '1 hour'
        AND created_at <= $2
        """,
        [user_id, created_date]
    )
    
    if recent_count > 5:
        return {
            'type': 'RAPID_FIRE_TRANSFERS',
            'severity': 15,
            'details': {
                'transfers_in_hour': recent_count,
                'threshold': 5
            }
        }
    
    # Count transfers in last 24 hours
    daily_count = await db.fetchval(
        """
        SELECT COUNT(*) FROM intents
        WHERE created_by_user_id = $1
        AND created_at > $2 - INTERVAL '24 hours'
        AND created_at <= $2
        """,
        [user_id, created_date]
    )
    
    if daily_count > 20:
        return {
            'type': 'HIGH_VOLUME_TRANSFERS',
            'severity': 10,
            'details': {
                'transfers_in_day': daily_count,
                'threshold': 20
            }
        }
    
    return None

async def _detect_geographic_anomaly(
    intent_data: Dict[str, Any],
    user_data: Dict[str, Any]
) -> Dict[str, Any] | None:
    """Detect geographic anomalies"""
    # TODO: Implement geographic detection when IP geolocation is available
    # For now, return None
    return None

async def _detect_device_anomaly(
    intent_data: Dict[str, Any],
    user_data: Dict[str, Any]
) -> Dict[str, Any] | None:
    """Detect device anomalies"""
    # TODO: Implement device fingerprinting detection
    # For now, return None
    return None

async def _detect_ip_anomaly(
    intent_data: Dict[str, Any],
    user_data: Dict[str, Any]
) -> Dict[str, Any] | None:
    """Detect IP address anomalies"""
    # TODO: Implement IP address anomaly detection
    # For now, return None
    return None
