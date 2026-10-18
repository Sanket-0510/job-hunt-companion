import hashlib
import secrets

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

# argon2id with the library's recommended parameters.
_hasher = PasswordHasher()


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except (VerificationError, InvalidHashError):
        return False


def password_needs_rehash(password_hash: str) -> bool:
    return _hasher.check_needs_rehash(password_hash)


def hash_token(raw: str) -> bytes:
    return hashlib.sha256(raw.encode()).digest()


def new_token() -> tuple[str, bytes]:
    """Return (raw token for the cookie or email link, sha256 to store)."""
    raw = secrets.token_urlsafe(32)
    return raw, hash_token(raw)
