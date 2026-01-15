"""
Logger Utility
Structured logging for voice service
"""

import logging
import os
import json
from datetime import datetime

def get_logger(name: str) -> logging.Logger:
    """Get logger instance"""
    logger = logging.getLogger(name)
    
    if not logger.handlers:
        handler = logging.StreamHandler()
        
        log_level = os.getenv('LOG_LEVEL', 'INFO').upper()
        logger.setLevel(getattr(logging, log_level, logging.INFO))
        
        # Structured JSON logging in production
        if os.getenv('ENV') == 'production':
            class JSONFormatter(logging.Formatter):
                def format(self, record):
                    log_entry = {
                        'timestamp': datetime.utcnow().isoformat(),
                        'level': record.levelname,
                        'logger': record.name,
                        'message': record.getMessage(),
                    }
                    if record.exc_info:
                        log_entry['exception'] = self.formatException(record.exc_info)
                    return json.dumps(log_entry)
            
            handler.setFormatter(JSONFormatter())
        else:
            formatter = logging.Formatter(
                '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
            )
            handler.setFormatter(formatter)
        
        logger.addHandler(handler)
    
    return logger
