import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "placement.db")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()

    # Create drives table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS drives (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company TEXT NOT NULL,
        logo TEXT NOT NULL,
        logo_color TEXT NOT NULL,
        date TEXT NOT NULL,
        role TEXT NOT NULL,
        status TEXT NOT NULL,
        eligible INTEGER NOT NULL,
        applied INTEGER NOT NULL,
        offers INTEGER NOT NULL,
        package TEXT NOT NULL,
        min_cgpa TEXT,
        branches TEXT,
        openings TEXT,
        hr_contact TEXT,
        description TEXT
    )
    """)

    # Create applications table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS applications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id TEXT NOT NULL,
        student_name TEXT NOT NULL,
        branch TEXT NOT NULL,
        batch TEXT NOT NULL,
        cgpa TEXT NOT NULL,
        company TEXT NOT NULL,
        stage TEXT NOT NULL,
        offer_status TEXT NOT NULL,
        package TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT NOT NULL,
        role TEXT
    )
    """)

    conn.commit()

    # Seed drives if empty
    cursor.execute("SELECT COUNT(*) FROM drives")
    if cursor.fetchone()[0] == 0:
        print("Seeding initial drives...")
        mock_drives = [
            ("TCS", "T", "#006699", "2026-07-28", "Digital Specialist", "Live", 85, 72, 3, "₹7.0 LPA", "6.0", "CSE, ECE, IT", "15", "campus.tcs@tcs.com", "Specialist software developer role under TCS Digital."),
            ("Infosys", "I", "#FF9900", "2026-08-02", "Power Programmer", "Upcoming", 90, 54, 0, "₹6.5 LPA", "6.5", "CSE, IT", "10", "recruitment@infosys.com", "High-performance coding and cloud orchestration projects."),
            ("Hexaware", "H", "#004B87", "2026-08-10", "Graduate Engineer Trainee", "Upcoming", 78, 41, 0, "₹6.0 LPA", "6.0", "CSE, ECE, EEE", "12", "hr@hexaware.com", "GET program for technology and service enablement."),
            ("Wipro", "W", "#8A2BE2", "2026-07-15", "Turbo Developer", "Completed", 95, 88, 12, "₹6.5 LPA", "6.0", "CSE, ECE, EEE", "25", "turbo.wipro@wipro.com", None),
            ("Cognizant", "C", "#0033A0", "2026-07-20", "GenC Next Engineer", "Completed", 82, 67, 8, "₹6.8 LPA", "6.0", "CSE, IT", "20", "genc.next@cognizant.com", None),
            ("Accenture", "A", "#A100FF", "2026-09-05", "Associate Software Engineer", "Upcoming", 70, 38, 0, "₹4.5 LPA", "6.5", "CSE, ECE, IT, EEE, Mech", "30", "campus@accenture.com", None)
        ]
        cursor.executemany("""
        INSERT INTO drives (company, logo, logo_color, date, role, status, eligible, applied, offers, package, min_cgpa, branches, openings, hr_contact, description)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, mock_drives)
        conn.commit()

    # Seed applications
    cursor.execute("SELECT COUNT(*) FROM applications")
    if cursor.fetchone()[0] == 0:
        print("Generating 2-3 applications for 30 students...")
        students = [
            ("STU_101", "Aryan Sharma", "CSE", "2026", "7.80", "aryan.sharma@nitk.edu", "9876543210"),
            ("STU_102", "Riya Sen", "CSE", "2026", "9.40", "riya.sen@nitk.edu", "9812345670"),
            ("STU_103", "Rohan Gupta", "IT", "2026", "8.20", "rohan.gupta@nitk.edu", "9723456781"),
            ("STU_104", "Dev Patel", "ECE", "2026", "7.20", "dev.patel@nitk.edu", "9634567892"),
            ("STU_105", "Priya Mehta", "CSE", "2026", "8.65", "priya.mehta@nitk.edu", "9545678903"),
            ("STU_106", "Kabir Nair", "CSE", "2026", "8.10", "kabir.nair@nitk.edu", "9456789014"),
            ("STU_107", "Sneha Nair", "IT", "2026", "7.90", "sneha.nair@nitk.edu", "9367890125"),
            ("STU_108", "Sahil Kumar", "ECE", "2026", "7.50", "sahil.kumar@nitk.edu", "9278901236"),
            ("STU_109", "Neha Iyer", "CSE", "2026", "9.10", "neha.iyer@nitk.edu", "9189012347"),
            ("STU_110", "Vivek Roy", "CSE", "2026", "8.80", "vivek.roy@nitk.edu", "9090123458"),
            ("STU_111", "Pooja Verma", "IT", "2026", "8.00", "pooja.verma@nitk.edu", "8901234569"),
            ("STU_112", "Amit Mishra", "EEE", "2026", "7.40", "amit.mishra@nitk.edu", "8812345670"),
            ("STU_113", "Ananya Das", "CSE", "2026", "8.35", "ananya.das@nitk.edu", "8723456781"),
            ("STU_114", "Vikram Rao", "CSE", "2026", "7.60", "vikram.rao@nitk.edu", "8634567892"),
            ("STU_115", "Diya Saxena", "IT", "2026", "8.50", "diya.saxena@nitk.edu", "8545678903"),
            ("STU_116", "Arjun Chawla", "ECE", "2026", "7.15", "arjun.chawla@nitk.edu", "8456789014"),
            ("STU_117", "Sandeep Gill", "CSE", "2026", "8.90", "sandeep.gill@nitk.edu", "8367890125"),
            ("STU_118", "Meera Kapoor", "CSE", "2026", "8.05", "meera.kapoor@nitk.edu", "8278901236"),
            ("STU_119", "Kunal Grover", "EEE", "2026", "7.30", "kunal.grover@nitk.edu", "8189012347"),
            ("STU_120", "Tanvi Bahl", "IT", "2026", "8.70", "tanvi.bahl@nitk.edu", "8090123458"),
            ("STU_121", "Akash Sethi", "CSE", "2026", "9.25", "akash.sethi@nitk.edu", "7989012349"),
            ("STU_122", "Kriti Pandey", "ECE", "2026", "7.75", "kriti.pandey@nitk.edu", "7878901230"),
            ("STU_123", "Varun Hegde", "CSE", "2026", "8.55", "varun.hegde@nitk.edu", "7767890121"),
            ("STU_124", "Shreya Chawla", "IT", "2026", "8.12", "shreya.chawla@nitk.edu", "7656789012"),
            ("STU_125", "Pranav Seth", "CSE", "2026", "9.02", "pranav.seth@nitk.edu", "7545678903"),
            ("STU_126", "Divya Dutta", "ECE", "2026", "7.68", "divya.dutta@nitk.edu", "7434567894"),
            ("STU_127", "Gaurav Trivedi", "CSE", "2026", "8.40", "gaurav.trivedi@nitk.edu", "7323456785"),
            ("STU_128", "Nisha Malhotra", "IT", "2026", "8.18", "nisha.malhotra@nitk.edu", "7212345676"),
            ("STU_129", "Abhishek Saxena", "CSE", "2026", "7.95", "abhishek.saxena@nitk.edu", "7101234567"),
            ("STU_130", "Ritu Chawla", "IT", "2026", "8.24", "ritu.chawla@nitk.edu", "7090123458")
        ]

        companies_info = [
            ("TCS", "₹7.0 LPA", "Digital Specialist"),
            ("Infosys", "₹6.5 LPA", "Power Programmer"),
            ("Hexaware", "₹6.0 LPA", "Graduate Engineer Trainee"),
            ("Wipro", "₹6.5 LPA", "Turbo Developer"),
            ("Cognizant", "₹6.8 LPA", "GenC Next Engineer"),
            ("Accenture", "₹4.5 LPA", "Associate Software Engineer")
        ]
        
        stages = ["Applied", "Shortlisted", "Interviewed", "Selected", "Rejected"]
        
        mock_apps = []
        import random
        random.seed(10) # Deterministic generation
        
        for student in students:
            student_id, name, branch, batch, cgpa, email, phone = student
            num_companies = random.choice([2, 3])
            selected_companies = random.sample(companies_info, num_companies)
            
            for idx, comp_info in enumerate(selected_companies):
                comp, package, role = comp_info
                
                # Check if this student is already Selected at a company
                has_selected = any(app[6] == "Selected" for app in mock_apps if app[0] == student_id)
                if has_selected:
                    stage = random.choice(["Applied", "Shortlisted", "Interviewed", "Rejected"])
                else:
                    stage = random.choice(stages)
                    
                offer_status = "Issued" if stage == "Selected" else ("Pending" if stage in ["Shortlisted", "Interviewed"] else "N/A")
                pkg = package if stage == "Selected" else ""
                
                mock_apps.append((
                    student_id, name, branch, batch, cgpa, comp, stage, offer_status, pkg, email, phone, role
                ))
                
        cursor.executemany("""
        INSERT INTO applications (student_id, student_name, branch, batch, cgpa, company, stage, offer_status, package, email, phone, role)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, mock_apps)
        conn.commit()

    conn.close()

if __name__ == "__main__":
    init_db()
