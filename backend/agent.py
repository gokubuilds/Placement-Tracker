import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import sqlite3
import google.antigravity
from google.antigravity import Agent, LocalAgentConfig, types
from google.antigravity.hooks.hooks import PreToolCallDecideHook, HookContext, HookResult
from backend.database import DB_PATH

# --- SQLite Tools ---

async def get_student_applications_db(student_id: str):
    """Retrieve all college placement applications for a given student ID from the local SQLite database.
    
    Args:
        student_id: The unique identifier of the student (e.g. 'STU_101').
    """
    print(f"Tool executing: get_student_applications_db for student_id: {student_id}")
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    # Join with drives to retrieve drive date
    cursor.execute("""
        SELECT a.company, d.date AS drive_date, a.stage, a.offer_status, a.package, a.role 
        FROM applications a 
        LEFT JOIN drives d ON a.company = d.company 
        WHERE a.student_id = ?
    """, (student_id,))
    rows = cursor.fetchall()
    apps = []
    for r in rows:
        apps.append({
            "company": r["company"],
            "drive_date": r["drive_date"] or "N/A",
            "stage": r["stage"],
            "offer_status": r["offer_status"],
            "package": r["package"],
            "role": r["role"]
        })
    conn.close()
    return apps

async def get_drive_status_db(company: str):
    """Retrieve campus placement drive details and status for a specific company from the local SQLite database.
    
    Args:
        company: The name of the company (e.g. 'Google', 'Microsoft').
    """
    print(f"Tool executing: get_drive_status_db for company: {company}")
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT company, date, role, status, package FROM drives WHERE company = ?", (company,))
    rows = cursor.fetchall()
    results = []
    for r in rows:
        results.append({
            "company": r["company"],
            "date": r["date"],
            "role": r["role"],
            "status": r["status"],
            "package": r["package"]
        })
    conn.close()
    return results

async def get_all_drives_db():
    """Retrieve details of all campus placement drives from the local SQLite database.
    Use this tool when the user asks about upcoming, live, or completed drives.
    """
    print("Tool executing: get_all_drives_db")
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT company, date, role, status, package, min_cgpa, branches FROM drives")
    rows = cursor.fetchall()
    conn.close()
    return [{
        "company": r["company"],
        "date": r["date"],
        "role": r["role"],
        "status": r["status"],
        "package": r["package"],
        "min_cgpa": r["min_cgpa"],
        "branches": r["branches"]
    } for r in rows]

# --- Safety & Policies Hooks ---

class RecordIsolationHook(PreToolCallDecideHook):
    """Enforces that an agent only queries data belonging to the authenticated user."""
    def __init__(self, authenticated_user_id: str):
        self.authenticated_user_id = authenticated_user_id

    async def run(self, context: HookContext, data: types.ToolCall) -> HookResult:
        if data.name == "get_student_applications_db":
            student_id = data.args.get("student_id")
            if student_id != self.authenticated_user_id:
                return HookResult(
                    allow=False,
                    message=f"Access Denied: Record isolation policy violation. Authenticated user {self.authenticated_user_id} is not permitted to read records for student {student_id}."
                )
        return HookResult(allow=True)
