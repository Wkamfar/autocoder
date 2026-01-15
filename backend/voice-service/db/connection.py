"""
Database Connection
PostgreSQL connection for voice service
"""

import os
import asyncpg
from typing import Optional
from utils.logger import get_logger

logger = get_logger(__name__)

_pool: Optional[asyncpg.Pool] = None

async def get_db_connection() -> asyncpg.Pool:
    """Get database connection pool"""
    global _pool
    
    if _pool is None:
        db_config = {
            'host': os.getenv('DB_HOST', 'localhost'),
            'port': int(os.getenv('DB_PORT', '5432')),
            'database': os.getenv('DB_NAME', 'wire2'),
            'user': os.getenv('DB_USER', 'wire2_user'),
            'password': os.getenv('DB_PASSWORD', 'wire2_password'),
        }
        
        _pool = await asyncpg.create_pool(**db_config, min_size=5, max_size=20)
        logger.info("Database connection pool created")
    
    return _pool

async def close_db_connection():
    """Close database connection pool"""
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
        logger.info("Database connection pool closed")
