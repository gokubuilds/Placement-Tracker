import os
import json
import string
from backend.database import get_db
from backend.agent import get_student_applications_db, get_drive_status_db, get_all_drives_db, query_placement_database
from google import genai
from google.genai import types

# Sync wrappers for schema generation in google-genai
def get_student_applications(student_id: str) -> list:
    """Retrieve all college placement applications for a given student ID from the database.
    
    Args:
        student_id: The unique identifier of the student (e.g. 'STU_101').
    """
    pass

def get_drive_status(company: str) -> list:
    """Retrieve campus placement drive details, requirements, and status for a specific company from the database.
    
    Args:
        company: The name of the company (e.g. 'Google', 'Microsoft').
    """
    pass

def get_all_drives() -> list:
    """Retrieve details of all campus placement drives from the database."""
    pass

def query_placement_database_sql(sql_query: str) -> list:
    """Execute a read-only SQL SELECT query on the college placement database to gather analytics and statistics.
    Only SELECT queries are permitted.
    
    Args:
        sql_query: The SQL SELECT statement to execute.
    """
    pass

async def handle_chat(query: str, x_student_id: str) -> str:
    """Handles chatbot logic for both Student and Placement Officer using standard google-genai client.
    Automatically tries multiple models as fallbacks to ensure maximum availability.
    """
    # 1. Normalize query
    normalized_query = query.strip().lower().translate(str.maketrans("", "", string.punctuation))
    print(f"Chat prompt: '{query}' -> Normalized: '{normalized_query}'")

    # 2. Fetch SQLite DB state as LLM knowledge source
    db_dump_str = ""
    student_profile = ""
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # Fetch all drives
        cursor.execute("SELECT company, date, role, status, package, min_cgpa, branches, openings, hr_contact, description FROM drives")
        d_rows = cursor.fetchall()
        drives_list = [dict(r) for r in d_rows]
        
        if x_student_id == "OFFICER":
            # Officer gets the complete candidate application ledger
            cursor.execute("SELECT student_id, student_name, branch, batch, cgpa, company, stage, offer_status, package, email, phone, role FROM applications")
            a_rows = cursor.fetchall()
            apps_list = [dict(r) for r in a_rows]
            db_dump_str = json.dumps({"drives": drives_list, "applications": apps_list}, indent=2)
        else:
            # Student gets only their own application ledger
            cursor.execute("SELECT student_id, student_name, branch, batch, cgpa, company, stage, offer_status, package, email, phone, role FROM applications WHERE student_id = ?", (x_student_id,))
            a_rows = cursor.fetchall()
            apps_list = [dict(r) for r in a_rows]
            db_dump_str = json.dumps({"drives": drives_list, "my_applications": apps_list}, indent=2)
            
            # Fetch profile details for prompt
            cursor.execute("SELECT student_name, branch, batch, cgpa, email, phone FROM applications WHERE student_id = ? LIMIT 1", (x_student_id,))
            row = cursor.fetchone()
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
        conn.close()
    except Exception as e:
        print(f"Error fetching DB dump: {e}")
        db_dump_str = "{}"

    # Initialize standard GenAI Client
    client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
    
    # Configure tools list & instructions
    api_tools = []
    if x_student_id == "OFFICER":
        api_tools = [get_student_applications, get_drive_status, get_all_drives, query_placement_database_sql]
        system_instruction = (
            "You are a College Placement Assistant helping the Placement Officer.\n"
            "You have access to the COMPLETE and live state of the college placement database below as your primary knowledge source:\n\n"
            "=== LIVE DATABASE KNOWLEDGE SOURCE ===\n"
            f"{db_dump_str}\n"
            "======================================\n\n"
            "Format your query results clearly as markdown tables when presenting lists or statistics.\n"
            "You also have database tools (e.g. `query_placement_database_sql`, `get_student_applications`, `get_drive_status`, `get_all_drives`) which you can call if you need more details."
        )
    else:
        api_tools = [get_student_applications, get_drive_status, get_all_drives]
        system_instruction = (
            "You are a College Placement Assistant helping a student.\n"
            "You have access to the current state of your own applications and company drives below as your knowledge source:\n\n"
            "=== LIVE DATABASE KNOWLEDGE SOURCE ===\n"
            f"{db_dump_str}\n"
            "======================================\n\n"
            f"{student_profile}"
            "You can ONLY help the student check their own application stages, upcoming drives, offer status, and eligibility.\n"
            "If the query is out of scope or is not related to the data in the knowledge source, you MUST reply with exactly:\n"
            "'I am not sure about that. Please contact the placement office.'"
        )

    config = types.GenerateContentConfig(
        system_instruction=system_instruction,
        tools=api_tools if api_tools else None,
    )

    # Models to try in order of preference to handle rate limits and availability
    models_to_try = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-2.5-flash", "gemini-3.5-flash"]
    last_error = None

    for model_name in models_to_try:
        try:
            print(f"Trying chat generation with model: {model_name}")
            contents = [normalized_query]
            text_reply = ""
            
            # Allow up to 5 tool-calls per generation request
            for _ in range(5):
                response = client.models.generate_content(
                    model=model_name,
                    contents=contents,
                    config=config
                )

                if not response.function_calls:
                    text_reply = response.text
                    break

                # Append assistant call to contents
                contents.append(response.candidates[0].content)

                tool_parts = []
                for call in response.function_calls:
                    name = call.name
                    args = call.args
                    print(f"Function call requested: {name} with args: {args}")

                    # Enforce student isolation checks
                    if x_student_id != "OFFICER":
                        if name == "get_student_applications":
                            student_id_arg = args.get("student_id")
                            if student_id_arg != x_student_id:
                                raise Exception("Access Denied: Record isolation policy violation.")
                        elif name == "query_placement_database_sql":
                            raise Exception("Access Denied: SQL queries are restricted to officers.")

                    # Run database tool
                    if name == "get_student_applications":
                        res = await get_student_applications_db(args.get("student_id"))
                    elif name == "get_drive_status":
                        res = await get_drive_status_db(args.get("company"))
                    elif name == "get_all_drives":
                        res = await get_all_drives_db()
                    elif name == "query_placement_database_sql":
                        res = await query_placement_database(args.get("sql_query"))
                    else:
                        res = {"error": f"Tool {name} not found"}

                    tool_parts.append(
                        types.Part.from_function_response(
                            name=name,
                            response={"result": res}
                        )
                    )

                contents.append(types.Content(role="tool", parts=tool_parts))
            
            # If we successfully got a reply, return it
            if text_reply:
                return text_reply
                
        except Exception as e:
            print(f"Model {model_name} failed: {e}")
            last_error = e
            continue

    # If all models failed, raise the final exception
    if last_error:
        raise last_error
    return "I am not sure about that. Please contact the placement office."
