import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import asyncio
import string
import json
from fastapi import FastAPI, Header, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from backend.database import get_db
from dotenv import load_dotenv

# Load env variables
load_dotenv()

# =====================================================================
# 1. FastAPI App Initialization & CORS
# =====================================================================

app = FastAPI(title="PlaceTrack API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =====================================================================
# 2. WebSocket Connection Manager (Real-time Broadcast)
# =====================================================================

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"WebSocket client connected. Total: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            print(f"WebSocket client disconnected. Total: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        message_str = json.dumps(message)
        for connection in self.active_connections:
            try:
                await connection.send_text(message_str)
            except Exception as e:
                print(f"Error broadcasting message: {e}")

manager = ConnectionManager()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Maintain connection alive
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# =====================================================================
# 3. REST API Endpoints
# =====================================================================

class ApplicationCreate(BaseModel):
    studentId: str
    name: str
    branch: str
    batch: str
    cgpa: str
    companies: str
    stage: str
    offerLetter: str
    package: str
    email: str
    phone: str
    role: str = "SWE Intern"

class ApplicationBulkCreate(BaseModel):
    records: list[ApplicationCreate]

class ApplicationUpdate(BaseModel):
    studentId: str = None
    name: str = None
    branch: str = None
    batch: str = None
    cgpa: str = None
    companies: str = None
    stage: str = None
    offerLetter: str = None
    package: str = None
    email: str = None
    phone: str = None
    role: str = None

class DriveCreate(BaseModel):
    company: str
    logo: str
    logoColor: str
    date: str
    role: str
    status: str
    eligible: int
    applied: int
    offers: int
    package: str
    minCgpa: str = ""
    branches: str = ""
    openings: str = ""
    hrContact: str = ""
    description: str = ""

@app.get("/api/applications")
def get_applications(student_id: str = None):
    conn = get_db()
    cursor = conn.cursor()
    if student_id:
        cursor.execute("""
            SELECT a.id, a.student_id, a.student_name, a.branch, a.batch, a.cgpa, a.company, a.stage, a.offer_status, a.package, a.email, a.phone, a.role, d.date AS drive_date, d.logo
            FROM applications a
            LEFT JOIN drives d ON a.company = d.company
            WHERE a.student_id = ?
        """, (student_id,))
    else:
        cursor.execute("""
            SELECT a.id, a.student_id, a.student_name, a.branch, a.batch, a.cgpa, a.company, a.stage, a.offer_status, a.package, a.email, a.phone, a.role, d.date AS drive_date, d.logo
            FROM applications a
            LEFT JOIN drives d ON a.company = d.company
        """)
    rows = cursor.fetchall()
    conn.close()
    
    result = []
    for r in rows:
        result.append({
            "id": str(r["id"]),
            "studentId": r["student_id"],
            "name": r["student_name"],
            "branch": r["branch"],
            "batch": r["batch"],
            "cgpa": r["cgpa"],
            "companies": r["company"],
            "company": r["company"],
            "stage": r["stage"],
            "offerLetter": r["offer_status"],
            "package": r["package"],
            "email": r["email"],
            "phone": r["phone"],
            "role": r["role"] or "SWE Intern",
            "driveDate": r["drive_date"] or "N/A",
            "logo": r["logo"] or "?"
        })
    return result

@app.post("/api/applications")
async def create_application(app_in: ApplicationCreate):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO applications (student_id, student_name, branch, batch, cgpa, company, stage, offer_status, package, email, phone, role)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (app_in.studentId, app_in.name, app_in.branch, app_in.batch, app_in.cgpa, app_in.companies, app_in.stage, app_in.offerLetter, app_in.package, app_in.email, app_in.phone, app_in.role))
    row_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    # Broadcast database update
    await manager.broadcast({"type": "refresh"})
    return {"id": str(row_id), "status": "created"}

@app.post("/api/applications/bulk")
async def create_applications_bulk(bulk_in: ApplicationBulkCreate):
    conn = get_db()
    cursor = conn.cursor()
    try:
        for app_in in bulk_in.records:
            cursor.execute("""
                INSERT INTO applications (student_id, student_name, branch, batch, cgpa, company, stage, offer_status, package, email, phone, role)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (app_in.studentId, app_in.name, app_in.branch, app_in.batch, app_in.cgpa, app_in.companies, app_in.stage, app_in.offerLetter, app_in.package, app_in.email, app_in.phone, app_in.role))
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()
        
    await manager.broadcast({"type": "refresh"})
    return {"status": "success", "count": len(bulk_in.records)}

@app.put("/api/applications/{id}")
async def update_application(id: int, app_in: ApplicationUpdate):
    conn = get_db()
    cursor = conn.cursor()
    
    # Verify existence
    cursor.execute("SELECT id FROM applications WHERE id = ?", (id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Application record not found")
        
    field_mapping = {
        "studentId": "student_id",
        "name": "student_name",
        "branch": "branch",
        "batch": "batch",
        "cgpa": "cgpa",
        "companies": "company",
        "stage": "stage",
        "offerLetter": "offer_status",
        "package": "package",
        "email": "email",
        "phone": "phone",
        "role": "role"
    }
    
    sql_parts = []
    params = []
    for key, db_col in field_mapping.items():
        val = getattr(app_in, key)
        if val is not None:
            sql_parts.append(f"{db_col} = ?")
            params.append(val)
            
    if sql_parts:
        params.append(id)
        query_str = f"UPDATE applications SET {', '.join(sql_parts)} WHERE id = ?"
        cursor.execute(query_str, tuple(params))
        conn.commit()
        
    conn.close()
    # Broadcast database update
    await manager.broadcast({"type": "refresh"})
    return {"status": "updated"}

@app.delete("/api/applications/{id}")
async def delete_application(id: int):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM applications WHERE id = ?", (id,))
    conn.commit()
    conn.close()
    
    # Broadcast database update
    await manager.broadcast({"type": "refresh"})
    return {"status": "deleted"}

@app.get("/api/drives")
def get_drives():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM drives ORDER BY id DESC")
    rows = cursor.fetchall()
    conn.close()
    
    result = []
    for r in rows:
        result.append({
            "id": str(r["id"]),
            "company": r["company"],
            "logo": r["logo"],
            "logoColor": r["logo_color"],
            "date": r["date"],
            "role": r["role"],
            "status": r["status"],
            "eligible": r["eligible"],
            "applied": r["applied"],
            "offers": r["offers"],
            "package": r["package"],
            "minCgpa": r["min_cgpa"] or "",
            "branches": r["branches"] or "",
            "openings": r["openings"] or "",
            "hrContact": r["hr_contact"] or "",
            "description": r["description"] or ""
        })
    return result

@app.post("/api/drives")
async def create_drive(drive_in: DriveCreate):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO drives (company, logo, logo_color, date, role, status, eligible, applied, offers, package, min_cgpa, branches, openings, hr_contact, description)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (drive_in.company, drive_in.logo, drive_in.logoColor, drive_in.date, drive_in.role, drive_in.status, drive_in.eligible, drive_in.applied, drive_in.offers, drive_in.package, drive_in.minCgpa, drive_in.branches, drive_in.openings, drive_in.hrContact, drive_in.description))
    row_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    # Broadcast database update
    await manager.broadcast({"type": "refresh"})
    return {"id": str(row_id), "status": "created"}

# =====================================================================
# 4. Google Antigravity Agent & Refusal Chat Handler
# =====================================================================

from backend.agent import get_student_applications_db, get_drive_status_db, get_all_drives_db, RecordIsolationHook
from google.antigravity import Agent, LocalAgentConfig

class ChatRequest(BaseModel):
    query: str

class ChatResponse(BaseModel):
    reply: str

@app.post("/api/chat", response_model=ChatResponse)
async def chat_handler(request: ChatRequest, x_student_id: str = Header(None, alias="X-Student-Id")):
    if not x_student_id:
        raise HTTPException(status_code=400, detail="X-Student-Id header is required for authentication.")

    # 1. Intent-normalization middleware (trim, lowercase, strip punctuation)
    normalized_query = request.query.strip().lower().translate(str.maketrans("", "", string.punctuation))
    print(f"Agent prompt: '{request.query}' -> Normalized: '{normalized_query}'")

    # 2. Setup Google Antigravity Agent Configuration & Run inside try-except
    try:
        # Fetch student profile details from SQLite first to inject into system instruction
        student_profile = ""
        if x_student_id != "OFFICER":
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("SELECT student_name, branch, batch, cgpa, email, phone FROM applications WHERE student_id = ? LIMIT 1", (x_student_id,))
            row = cursor.fetchone()
            conn.close()
            if row:
                student_profile = (
                    f"You are chatting with {row['student_name']} (Student ID: {x_student_id}).\n"
                    f"Student Profile:\n"
                    f"- Branch: {row['branch']}\n"
                    f"- Batch: {row['batch']}\n"
                    f"- CGPA: {row['cgpa']}\n"
                    f"- Email: {row['email']}\n"
                    f"- Phone: {row['phone']}\n\n"
                )

        config = LocalAgentConfig()
        
        # Register custom SQLite tools on config
        if x_student_id == "OFFICER":
            config.tools.append(get_student_applications_db)
        else:
            # For students, register a helper tool that queries their own records dynamically
            async def get_my_placement_status():
                """
                Retrieve all of your own placement application records from the database.
                Includes company, stage, offer status, package, role, and drive date.
                Use this to answer questions about your own application stages or offer status.
                """
                return await get_student_applications_db(x_student_id)
            
            config.tools.append(get_my_placement_status)

        config.tools.append(get_drive_status_db)
        config.tools.append(get_all_drives_db)

        # Register safety record isolation hook only for students, not for officer
        if x_student_id != "OFFICER":
            config.hooks.append(RecordIsolationHook(authenticated_user_id=x_student_id))

        if x_student_id == "OFFICER":
            identity_info = "Note: You are chatting with the Placement Officer. You can query data for any and all students without isolation restrictions.\n"
        else:
            identity_info = f"Note: You are chatting with student ID {x_student_id}. Never query data for any other student ID.\n"

        config.system_instructions = (
            "You are a College Placement Assistant. You have access to tools for retrieving student applications "
            "and company drive status from a local SQLite database.\n"
            "You can ONLY help users check:\n"
            "1. Application Stages\n"
            "2. Drive Dates / Upcoming Drives\n"
            "3. Offer Status\n\n"
            f"{student_profile}"
            f"{identity_info}"
            "If the query is out of scope or you cannot retrieve the information using your tools, "
            "or you are not confident, you MUST reply with exactly: "
            "'I am not confident about that request. I can only help you check: 1. Application Stages, 2. Drive Dates, 3. Offer Status.'"
        )

        async with Agent(config) as agent:
            agent_response = await agent.chat(normalized_query)
            text_reply = await agent_response.text()
            
            # Post-check fallback (if agent output is empty)
            if not text_reply:
                text_reply = "I am not confident about that request. I can only help you check: 1. Application Stages, 2. Drive Dates, 3. Offer Status."
                
            return ChatResponse(reply=text_reply)
            
    except Exception as e:
        error_msg = str(e)
        if "Access Denied" in error_msg:
            return ChatResponse(reply="Access Denied: You are not authorized to query other students' application records.")
        
        print(f"Agent Execution Error: {e}")
        return ChatResponse(reply="I am not confident about that request. I can only help you check: 1. Application Stages, 2. Drive Dates, 3. Offer Status.")

if __name__ == "__main__":
    import uvicorn
    # Run FastAPI app locally on port 8000
    uvicorn.run(app, host="0.0.0.0", port=8000)
