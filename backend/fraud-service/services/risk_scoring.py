"""
Risk Scoring Service
Calculates comprehensive risk scores for intents
"""

import json
from typing import Dict, Any, List
from datetime import datetime, timedelta
from services.anomaly_detection import detect_anomalies
from services.pattern_analysis import analyze_patterns
from services.behavioral_analysis import analyze_behavior
from db.connection import get_db_connection
from utils.logger import get_logger

logger = get_logger(__name__)

class RiskScoringService:
    """Risk scoring service"""
    
    def __init__(self):
        self.max_score = 100
    
    async def calculate_risk_score(
        self,
        intent_data: Dict[str, Any],
        beneficiary_data: Dict[str, Any],
        user_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Calculate comprehensive risk score for intent
        
        Args:
            intent_data: Intent data
            beneficiary_data: Beneficiary data
            user_data: User data
            
        Returns:
            Risk score with factors and rationale
        """
        logger.info(f"Calculating risk score for intent {intent_data.get('id')}")
        
        factors = []
        score = 0
        
        # 1. Amount risk
        amount_risk = self._calculate_amount_risk(intent_data)
        score += amount_risk['score']
        factors.append({
            'factor': 'amount',
            'score': amount_risk['score'],
            'details': amount_risk
        })
        
        # 2. Beneficiary risk
        beneficiary_risk = await self._calculate_beneficiary_risk(
            beneficiary_data,
            intent_data
        )
        score += beneficiary_risk['score']
        factors.append({
            'factor': 'beneficiary',
            'score': beneficiary_risk['score'],
            'details': beneficiary_risk
        })
        
        # 3. User risk
        user_risk = await self._calculate_user_risk(user_data, intent_data)
        score += user_risk['score']
        factors.append({
            'factor': 'user',
            'score': user_risk['score'],
            'details': user_risk
        })
        
        # 4. Timing risk
        timing_risk = self._calculate_timing_risk(intent_data)
        score += timing_risk['score']
        factors.append({
            'factor': 'timing',
            'score': timing_risk['score'],
            'details': timing_risk
        })
        
        # 5. Relationship risk
        relationship_risk = await self._calculate_relationship_risk(
            intent_data.get('created_by_user_id'),
            intent_data.get('beneficiary_id'),
            intent_data
        )
        score += relationship_risk['score']
        factors.append({
            'factor': 'relationship',
            'score': relationship_risk['score'],
            'details': relationship_risk
        })
        
        # 6. Anomaly detection
        anomalies = await detect_anomalies(intent_data, beneficiary_data, user_data)
        anomaly_score = sum(a.get('severity', 0) for a in anomalies)
        score += anomaly_score
        factors.append({
            'factor': 'anomalies',
            'score': anomaly_score,
            'count': len(anomalies),
            'details': anomalies
        })
        
        # 7. Pattern analysis
        patterns = await analyze_patterns(
            intent_data.get('created_by_user_id'),
            intent_data
        )
        score += patterns.get('risk_score', 0)
        factors.append({
            'factor': 'patterns',
            'score': patterns.get('risk_score', 0),
            'details': patterns
        })
        
        # 8. Behavioral analysis
        behavior = await analyze_behavior(
            intent_data.get('created_by_user_id'),
            intent_data
        )
        score += behavior.get('risk_score', 0)
        factors.append({
            'factor': 'behavior',
            'score': behavior.get('risk_score', 0),
            'details': behavior
        })
        
        # Cap score at maximum
        final_score = min(self.max_score, score)
        
        # Generate rationale
        rationale = self._generate_rationale(factors, final_score)
        
        # Generate recommendations
        recommendations = self._generate_recommendations(final_score, factors)
        
        logger.info(
            f"Risk score calculated: {final_score}/100 for intent {intent_data.get('id')}"
        )
        
        return {
            'score': final_score,
            'factors': factors,
            'rationale': rationale,
            'recommendations': recommendations,
            'calculated_at': datetime.utcnow().isoformat()
        }
    
    def _calculate_amount_risk(self, intent_data: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate amount-based risk"""
        amount_minor = intent_data.get('amount_minor', 0)
        amount_dollars = amount_minor / 100
        
        # Risk tiers
        if amount_dollars >= 1000000:  # $1M+
            risk_score = 30
            risk_level = 'VERY_HIGH'
        elif amount_dollars >= 500000:  # $500K+
            risk_score = 20
            risk_level = 'HIGH'
        elif amount_dollars >= 100000:  # $100K+
            risk_score = 10
            risk_level = 'MEDIUM'
        elif amount_dollars >= 50000:  # $50K+
            risk_score = 5
            risk_level = 'LOW'
        else:
            risk_score = 0
            risk_level = 'VERY_LOW'
        
        return {
            'score': risk_score,
            'amount_dollars': amount_dollars,
            'risk_level': risk_level
        }
    
    async def _calculate_beneficiary_risk(
        self,
        beneficiary_data: Dict[str, Any],
        intent_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Calculate beneficiary-based risk"""
        if not beneficiary_data:
            return {'score': 0, 'reason': 'No beneficiary data'}
        
        risk_score = 0
        risk_factors = []
        
        # New beneficiary (not verified)
        if beneficiary_data.get('verification_status') != 'VERIFIED':
            risk_score += 20
            risk_factors.append('unverified_beneficiary')
        
        # New beneficiary (recently created)
        created_at = beneficiary_data.get('created_at')
        if created_at:
            created_date = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
            days_old = (datetime.utcnow() - created_date.replace(tzinfo=None)).days
            if days_old < 7:
                risk_score += 15
                risk_factors.append('new_beneficiary')
        
        # Locked beneficiary
        if beneficiary_data.get('status') == 'LOCKED':
            risk_score += 50
            risk_factors.append('locked_beneficiary')
        
        # Sanctions check
        if beneficiary_data.get('sanctions_check_status') == 'FLAGGED':
            risk_score += 85
            risk_factors.append('sanctions_flagged')
        
        # No transfer history
        db = await get_db_connection()
        transfer_count = await db.fetchval(
            """
            SELECT COUNT(*) FROM intents
            WHERE beneficiary_id = $1 AND status = 'EXECUTED'
            """,
            [beneficiary_data.get('id')]
        )
        
        if transfer_count == 0:
            risk_score += 10
            risk_factors.append('no_transfer_history')
        
        return {
            'score': min(85, risk_score),  # Cap beneficiary risk
            'risk_factors': risk_factors,
            'beneficiary_id': beneficiary_data.get('id')
        }
    
    async def _calculate_user_risk(
        self,
        user_data: Dict[str, Any],
        intent_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Calculate user-based risk"""
        if not user_data:
            return {'score': 0, 'reason': 'No user data'}
        
        risk_score = 0
        risk_factors = []
        
        # New user
        created_at = user_data.get('created_at')
        if created_at:
            created_date = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
            days_old = (datetime.utcnow() - created_date.replace(tzinfo=None)).days
            if days_old < 30:
                risk_score += 10
                risk_factors.append('new_user')
        
        # User role
        role = user_data.get('role', '')
        if role not in ['TREASURY_INITIATOR', 'ADMIN']:
            risk_score += 5
            risk_factors.append('non_standard_role')
        
        # Recent failed attempts
        db = await get_db_connection()
        recent_failures = await db.fetchval(
            """
            SELECT COUNT(*) FROM intents
            WHERE created_by_user_id = $1
            AND status = 'DENIED'
            AND created_at > NOW() - INTERVAL '7 days'
            """,
            [user_data.get('id')]
        )
        
        if recent_failures > 3:
            risk_score += 15
            risk_factors.append('recent_failures')
        
        return {
            'score': min(20, risk_score),  # Cap user risk
            'risk_factors': risk_factors,
            'user_id': user_data.get('id')
        }
    
    def _calculate_timing_risk(self, intent_data: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate timing-based risk"""
        created_at = intent_data.get('created_at')
        if not created_at:
            return {'score': 0}
        
        created_date = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
        hour = created_date.hour
        day_of_week = created_date.weekday()
        
        risk_score = 0
        risk_factors = []
        
        # Off-hours (outside 9 AM - 5 PM)
        if hour < 9 or hour >= 17:
            risk_score += 5
            risk_factors.append('off_hours')
        
        # Weekend
        if day_of_week >= 5:  # Saturday or Sunday
            risk_score += 5
            risk_factors.append('weekend')
        
        return {
            'score': min(10, risk_score),  # Cap timing risk
            'risk_factors': risk_factors,
            'hour': hour,
            'day_of_week': day_of_week
        }
    
    async def _calculate_relationship_risk(
        self,
        user_id: str,
        beneficiary_id: str,
        intent_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Calculate relationship-based risk"""
        if not user_id or not beneficiary_id:
            return {'score': 0}
        
        db = await get_db_connection()
        
        # Check transfer history between user and beneficiary
        transfer_count = await db.fetchval(
            """
            SELECT COUNT(*) FROM intents
            WHERE created_by_user_id = $1
            AND beneficiary_id = $2
            AND status = 'EXECUTED'
            """,
            [user_id, beneficiary_id]
        )
        
        risk_score = 0
        risk_factors = []
        
        # No previous transfers
        if transfer_count == 0:
            risk_score += 10
            risk_factors.append('no_previous_transfers')
        
        # First transfer in 30 days
        last_transfer = await db.fetchval(
            """
            SELECT MAX(executed_at) FROM intents
            WHERE created_by_user_id = $1
            AND beneficiary_id = $2
            AND status = 'EXECUTED'
            """,
            [user_id, beneficiary_id]
        )
        
        if last_transfer:
            last_date = datetime.fromisoformat(str(last_transfer).replace('Z', '+00:00'))
            days_since = (datetime.utcnow() - last_date.replace(tzinfo=None)).days
            if days_since > 30:
                risk_score += 5
                risk_factors.append('stale_relationship')
        
        return {
            'score': min(10, risk_score),  # Cap relationship risk
            'risk_factors': risk_factors,
            'transfer_count': transfer_count
        }
    
    def _generate_rationale(
        self,
        factors: List[Dict[str, Any]],
        final_score: int
    ) -> str:
        """Generate human-readable rationale"""
        high_risk_factors = [
            f for f in factors
            if f.get('score', 0) >= 10
        ]
        
        if final_score >= 80:
            level = "CRITICAL"
        elif final_score >= 60:
            level = "HIGH"
        elif final_score >= 40:
            level = "MEDIUM"
        elif final_score >= 20:
            level = "LOW"
        else:
            level = "VERY_LOW"
        
        rationale = f"Risk score: {final_score}/100 ({level}). "
        
        if high_risk_factors:
            top_factors = sorted(
                high_risk_factors,
                key=lambda x: x.get('score', 0),
                reverse=True
            )[:3]
            factor_names = [f['factor'] for f in top_factors]
            rationale += f"Primary risk factors: {', '.join(factor_names)}."
        
        return rationale
    
    def _generate_recommendations(
        self,
        score: int,
        factors: List[Dict[str, Any]]
    ) -> List[str]:
        """Generate recommendations based on risk score"""
        recommendations = []
        
        if score >= 80:
            recommendations.append("CRITICAL: Require additional approvals")
            recommendations.append("CRITICAL: Manual review required")
            recommendations.append("CRITICAL: Consider blocking transfer")
        elif score >= 60:
            recommendations.append("HIGH: Require additional approvals")
            recommendations.append("HIGH: Enhanced verification recommended")
        elif score >= 40:
            recommendations.append("MEDIUM: Standard approval process")
        elif score >= 20:
            recommendations.append("LOW: Standard approval process")
        else:
            recommendations.append("VERY_LOW: Standard approval process")
        
        # Factor-specific recommendations
        for factor in factors:
            factor_name = factor.get('factor')
            factor_score = factor.get('score', 0)
            
            if factor_name == 'beneficiary' and factor_score >= 20:
                recommendations.append("Verify beneficiary identity")
            
            if factor_name == 'anomalies' and factor.get('count', 0) > 0:
                recommendations.append("Review detected anomalies")
            
            if factor_name == 'amount' and factor_score >= 20:
                recommendations.append("Verify large amount transfer")
        
        return recommendations

risk_scoring_service = RiskScoringService()
