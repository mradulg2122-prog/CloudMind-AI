"""Reset admin password and fix any corrupted hashes."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from passlib.context import CryptContext
from database import SessionLocal, User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

NEW_PASSWORD = "Adm!n_Secure99"
ADMIN_USERS  = ["admin", "mradul_test", "mradul_test1"]

db = SessionLocal()
try:
    new_hash = pwd_context.hash(NEW_PASSWORD)
    print(f"New hash: {new_hash[:30]}...")

    for username in ADMIN_USERS:
        user = db.query(User).filter(User.username == username).first()
        if user:
            user.hashed_pw = new_hash
            user.role      = "admin"
            db.add(user)
            print(f"  [OK] Reset password + admin role for: {username}")
        else:
            print(f"  [SKIP] Not found: {username}")

    db.commit()
    print("\nAll done. Now verify:")

    for username in ADMIN_USERS:
        u = db.query(User).filter(User.username == username).first()
        if u:
            ok = pwd_context.verify(NEW_PASSWORD, u.hashed_pw)
            print(f"  {username} | role={u.role} | password_ok={ok}")
finally:
    db.close()
