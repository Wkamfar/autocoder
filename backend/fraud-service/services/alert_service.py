"""
Alert Service
Generates and manages fraud alerts
"""

import json
from typing import Dict, Any, List
from datetime import datetime
from db.connection import get_db_connection
from utils.logger import get_logger

logger = get_logger(__name__)

class AlertService:
    """Fraud alert service"""
    
    async def create_alert(
        self,
        intent_id: str,
        alert_type: str,
        severity: str,
        details: Dict[str, Any],
        risk_score: int
    ) -> Dict[str, Any]:
        """
        Create fraud alert
        
        Args:
            intent_id: Intent ID
            alert_type: Alert type
            severity: Severity level (LOW, MEDIUM, HIGH, CRITICAL)
            details: Alert details
            risk_score: Risk score
            
        Returns:
            Created alert
        """
        db = await get_db_connection()
        
        alert_id = await db.fetchval(
            """
            INSERT INTO fraud_alerts (
                id, intent_id, alert_type, severity, details_json,
                risk_score, status, created_at
            ) VALUES (
                gen_random_uuid(), $1, $2, $3, $4, $5, 'ACTIVE', NOW()
            ) RETURNING id
            """,
            [
                intent_id,
                alert_type,
                severity,
                json.dumps(details),
                risk_score
            ]
        )
        
        logger.info(f"Fraud alert created: {alert_id} for intent {intent_id}")
        
        return {
            'id': alert_id,
            'intent_id': intent_id,
            'alert_type': alert_type,
            'severity': severity,
            'risk_score': risk_score,
            'status': 'ACTIVE',
            'created_at': datetime.utcnow().isoformat()
        }
    
    async def get_alerts(
        self,
        filters: Dict[str, Any] = None
    ) -> List[Dict[str, Any]]:
        """
        Get fraud alerts with optional filters
        
        Args:
            filters: Filter criteria
            
        Returns:
            List of alerts
        """
        db = await get_db_connection()
        
        conditions = []
        params = []
        param_index = 1
        
        if filters:
            if filters.get('status'):
                conditions.append(f"status = ${param_index}")
                params.append(filters['status'])
                param_index += 1
            
            if filters.get('severity'):
                conditions.append(f"severity = ${param_index}")
                params.append(filters['severity'])
                param_index += 1
            
            if filters.get('intent_id'):
                conditions.append(f"intent_id = ${param_index}")
                params.append(filters['intent_id'])
                param_index += 1
        
        where_clause = " AND ".join(conditions) if conditions else "1=1"
        
        results = await db.fetch(
            f"""
            SELECT * FROM fraud_alerts
            WHERE {where_clause}
            ORDER BY created_at DESC
            LIMIT 100
            """,
            params
        )
        
        alerts = []
        for row in results:
            alerts.append({
                'id': str(row['id']),
                'intent_id': str(row['intent_id']),
                'alert_type': row['alert_type'],
                'severity': row['severity'],
                'details': json.loads(row['details_json']),
                'risk_score': row['risk_score'],
                'status': row['status'],
                'created_at': row['created_at'].isoformat()
            })
        
        return alerts
    
    async def get_user_patterns(self, user_id: str) -> Dict[str, Any]:
        """
        Get fraud patterns for user
        
        Args:
            user_id: User ID
            
        Returns:
            User patterns
        """
        db = await get_db_connection()
        
        # Get user's intents
        intents = await db.fetch(
            """
            SELECT i.*, a.risk_score
            FROM intents i
            LEFT JOIN risk_scores a ON i.id = a.intent_id
            WHERE i.created_by_user_id = $1
            ORDER BY i.created_at DESC
            LIMIT 50
            """,
            [user_id]
        )
        
        # Analyze patterns
        patterns = {
            'total_intents': len(intents),
            'average_risk_score': 0,
            'high_risk_count': 0,
            'alert_count': 0
        }
        
        if intents:
            risk_scores = [r['risk_score'] for r in intents if r['risk_score']]
            if risk_scores:
                patterns['average_risk_score'] = sum(risk_scores) / len(risk_scores)
                patterns['high_risk_count'] = len([r for r in risk_scores if r >= 60])
        
        # Get alerts
        alerts = await db.fetch(
            """
            SELECT COUNT(*) as count FROM fraud_alerts
            WHERE intent_id IN (
                SELECT id FROM intents WHERE created_by_user_id = $1
            )
            """,
            [user_id]
        )
        
        if alerts:
            patterns['alert_count'] = alerts[0]['count']
        
        return patterns

alert_service = AlertService()
