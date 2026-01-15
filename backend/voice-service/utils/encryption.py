"""
Encryption Utilities
Encrypts voiceprints and audio recordings
"""

import os
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.backends import default_backend
import base64

def get_encryption_key() -> bytes:
    """Get encryption key from environment"""
    key_str = os.getenv('ENCRYPTION_KEY', 'change-me-in-production-use-strong-random-key')
    
    # Derive key using PBKDF2
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=b'wire2_voice_salt',
        iterations=100000,
        backend=default_backend()
    )
    
    key = base64.urlsafe_b64encode(kdf.derive(key_str.encode()))
    return key

async def encrypt_voiceprint(voiceprint_data: str) -> str:
    """Encrypt voiceprint"""
    key = get_encryption_key()
    f = Fernet(key)
    encrypted = f.encrypt(voiceprint_data.encode())
    return base64.b64encode(encrypted).decode()

async def decrypt_voiceprint(encrypted_data: str) -> str:
    """Decrypt voiceprint"""
    key = get_encryption_key()
    f = Fernet(key)
    decrypted = f.decrypt(base64.b64decode(encrypted_data))
    return decrypted.decode()

async def encrypt_audio(audio_data: bytes) -> bytes:
    """Encrypt audio recording"""
    key = get_encryption_key()
    f = Fernet(key)
    return f.encrypt(audio_data)

async def decrypt_audio(encrypted_data: bytes) -> bytes:
    """Decrypt audio recording"""
    key = get_encryption_key()
    f = Fernet(key)
    return f.decrypt(encrypted_data)
