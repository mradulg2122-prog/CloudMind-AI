"""Promote key users to admin role in cloudmind.db"""
import sqlite3, os

DB_PATH = os.path.join(os.path.dirname(__file__), "backend", "cloudmind.db")
conn = sqlite3.connect(DB_PATH)
cur  = conn.cursor()

# Promote to admin
ADMINS = ['admin', 'mradul_test', 'mradul_test1']
for u in ADMINS:
    cur.execute("UPDATE users SET role='admin' WHERE username=?", (u,))
    print(f"  Promoted: {u}")

conn.commit()

# Show all admins
cur.execute("SELECT username, email, role FROM users WHERE role='admin'")
rows = cur.fetchall()
print("\n=== ADMIN USERS ===")
for r in rows:
    print(f"  username={r[0]}  email={r[1]}  role={r[2]}")

conn.close()
print("\nDone.")
