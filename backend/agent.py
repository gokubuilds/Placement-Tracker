import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import sqlite3
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
    """Retrieve campus placement drive details, requirements, and status for a specific company from the local SQLite database.
    
    Args:
        company: The name of the company (e.g. 'Google', 'Microsoft').
    """
    print(f"Tool executing: get_drive_status_db for company: {company}")
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT company, date, role, status, package, min_cgpa, branches, hr_contact, description FROM drives WHERE company = ?", (company,))
    rows = cursor.fetchall()
    results = []
    for r in rows:
        results.append({
            "company": r["company"],
            "date": r["date"],
            "role": r["role"],
            "status": r["status"],
            "package": r["package"],
            "min_cgpa": r["min_cgpa"] or "",
            "branches": r["branches"] or "",
            "hr_contact": r["hr_contact"] or "",
            "description": r["description"] or ""
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

async def query_placement_database(sql_query: str):
    """Execute a read-only SQL SELECT query on the college placement database to gather analytics and statistics.
    Use this tool to answer complex questions about placed/unplaced students, averages, counts, etc.
    Only SELECT queries are permitted.
    
    Args:
        sql_query: The SQL SELECT statement to execute.
    """
    print(f"Tool executing: query_placement_database with query: {sql_query}")
    query_stripped = sql_query.strip().lower()
    if not query_stripped.startswith("select"):
        return {"error": "Access Denied: Only read-only SELECT queries are permitted."}
    if "update" in query_stripped or "delete" in query_stripped or "insert" in query_stripped or "drop" in query_stripped or "alter" in query_stripped:
        return {"error": "Access Denied: Writing/mutating database operations are prohibited."}

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    try:
        cursor.execute(sql_query)
        rows = cursor.fetchall()
        return [dict(r) for r in rows]
    except Exception as e:
        return {"error": str(e)}
    finally:
        conn.close()

# --- SQLite Tools End ---
