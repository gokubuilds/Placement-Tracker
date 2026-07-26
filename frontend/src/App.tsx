import { useState, useRef, useEffect } from 'react'
import Login from './pages/Login'
import OfficerDashboard from './pages/OfficerDashboard'

// ─── Types ──────────────────────────────────────────────────────────────────

type AuthRole = 'student' | 'officer'
type Stage = 'Applied' | 'Shortlisted' | 'Interviewed' | 'Selected' | 'Rejected'

interface AuthState {
  role: AuthRole
  id: string
  name: string
}

interface Application {
  id: string
  company: string
  logo: string
  driveDate: string
  stage: Stage
  package: string
  role: string
}

interface ChatMessage {
  id: string
  from: 'student' | 'assistant'
  text: string
  time: string
}

// ─── Data ───────────────────────────────────────────────────────────────────

const applications: Application[] = [
  { id: '1', company: 'TCS', logo: 'T', driveDate: '28 Jul 2026', stage: 'Shortlisted', package: '₹7.0 LPA', role: 'Digital Specialist' },
  { id: '2', company: 'Infosys', logo: 'I', driveDate: '02 Aug 2026', stage: 'Applied', package: '₹6.5 LPA', role: 'Power Programmer' },
  { id: '3', company: 'Hexaware', logo: 'H', driveDate: '10 Aug 2026', stage: 'Interviewed', package: '₹6.0 LPA', role: 'Graduate Engineer Trainee' },
  { id: '4', company: 'Wipro', logo: 'W', driveDate: '15 Jul 2026', stage: 'Selected', package: '₹6.5 LPA', role: 'Turbo Developer' },
  { id: '5', company: 'Cognizant', logo: 'C', driveDate: '20 Jul 2026', stage: 'Rejected', package: '₹6.8 LPA', role: 'GenC Next Engineer' },
  { id: '6', company: 'Accenture', logo: 'A', driveDate: '05 Sep 2026', stage: 'Applied', package: '₹4.5 LPA', role: 'Associate Software Engineer' },
]

const initialMessages: ChatMessage[] = [
  { id: '1', from: 'assistant', text: "Hi Aryan! 👋 I'm your Placement Assistant. I can help you track applications, check drive schedules, and get package insights. How can I help you today?", time: '10:02 AM' },
  { id: '2', from: 'student', text: "What's my current TCS status?", time: '10:03 AM' },
  { id: '3', from: 'assistant', text: 'Your TCS Digital Specialist application is currently at the **Shortlisted** stage. The campus drive is scheduled for 28 Jul 2026. Make sure to prepare for the technical interview round. You got this! 🚀', time: '10:03 AM' },
]

const stageConfig: Record<Stage, { bg: string; text: string; dot: string }> = {
  Applied:     { bg: '#EFF6FF', text: '#2563EB', dot: '#3B82F6' },
  Shortlisted: { bg: '#FFF7ED', text: '#C2410C', dot: '#F97316' },
  Interviewed: { bg: '#F5F3FF', text: '#6D28D9', dot: '#8B5CF6' },
  Selected:    { bg: '#F0FDF4', text: '#15803D', dot: '#22C55E' },
  Rejected:    { bg: '#FFF1F2', text: '#BE123C', dot: '#F43F5E' },
}

const logoColors: Record<string, string> = {
  G: '#4285F4', M: '#00A4EF', A: '#0052CC', Z: '#FF3366', R: '#3395FF', S: '#635BFF',
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StageBadge({ stage }: { stage: Stage }) {
  const cfg = stageConfig[stage]
  return (
    <span className="mono inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-500 rounded" style={{ background: cfg.bg, color: cfg.text }}>
      <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: cfg.dot }} />
      {stage}
    </span>
  )
}

// CompanyLogo component uses inline styles
function CompanyLogo({ letter, company }: { letter: string; company: string }) {
  const color = logoColors[letter] ?? '#4F46E5'
  return (
    <div className="w-8 h-8 rounded flex items-center justify-center text-white text-sm font-700 flex-shrink-0" style={{ background: color }} aria-label={company}>
      {letter}
    </div>
  )
}

function SummaryCard({ label, value, sub, accent }: { label: string; value: number; sub: string; accent: string }) {
  return (
    <div className="bg-white rounded-md border border-[#E2E8F0] p-5 flex flex-col gap-3 hover:shadow-sm transition-shadow duration-200">
      <div className="flex items-start justify-between">
        <p className="text-xs font-600 uppercase tracking-widest text-[#64748B]">{label}</p>
        <span className="w-2 h-2 rounded-full mt-0.5" style={{ background: accent }} />
      </div>
      <p className="text-3xl font-800 text-[#0F172A] leading-none">{value}</p>
      <p className="text-xs text-[#64748B]">{sub}</p>
    </div>
  )
}

// ─── Chat Widget ─────────────────────────────────────────────────────────────

function ChatWidget({ studentId, studentName, applications }: { studentId: string; studentName: string; applications: Application[] }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const feedRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const firstName = studentName.split(' ')[0]
    const initialList: ChatMessage[] = [
      {
        id: '1',
        from: 'assistant',
        text: `Hi ${firstName}! 👋 I'm your Placement Assistant. I can help you track applications, check drive schedules, and get package insights. How can I help you today?`,
        time: '10:02 AM'
      }
    ]

    if (applications.length > 0) {
      const firstApp = applications[0]
      initialList.push(
        {
          id: '2',
          from: 'student',
          text: `What's my current ${firstApp.company} status?`,
          time: '10:03 AM'
        },
        {
          id: '3',
          from: 'assistant',
          text: `Your ${firstApp.company} ${firstApp.role} application is currently at the **${firstApp.stage}** stage. The campus drive is scheduled for ${firstApp.driveDate}. Make sure to prepare. You got this! 🚀`,
          time: '10:03 AM'
        }
      )
    } else {
      initialList.push(
        {
          id: '2',
          from: 'student',
          text: "What drives are upcoming?",
          time: '10:03 AM'
        },
        {
          id: '3',
          from: 'assistant',
          text: "Currently, Wipro is scheduled for 15 Jul 2026 and TCS is scheduled for 28 Jul 2026. Let me know if you'd like details on any of these!",
          time: '10:03 AM'
        }
      )
    }
    setMessages(initialList)
  }, [studentId, studentName, applications])

  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight
  }, [messages, open])

  const now = () => new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

  const sendMessage = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    setMessages(prev => [...prev, { id: Date.now().toString(), from: 'student', text: trimmed, time: now() }])
    setInput('')
    
    try {
      const res = await fetch("http://localhost:8000/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Student-Id": studentId
        },
        body: JSON.stringify({ query: trimmed })
      })
      if (res.ok) {
        const data = await res.json()
        setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), from: 'assistant', text: data.reply, time: now() }])
      } else {
        setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), from: 'assistant', text: "I am not confident about that request. I can only help you check: 1. Application Stages, 2. Drive Dates, 3. Offer Status.", time: now() }])
      }
    } catch (e) {
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), from: 'assistant', text: "Error: Could not connect to assistant backend.", time: now() }])
    }
  }

  const chips = ['My TCS Status', 'Upcoming Drives', 'My Package Details']

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="w-80 sm:w-96 bg-white rounded-md border border-[#E2E8F0] shadow-xl flex flex-col overflow-hidden" style={{ height: '520px' }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#E2E8F0] bg-[#4F46E5]">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded bg-white/20 flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <div>
                <p className="text-white text-sm font-600 leading-none">Placement Assistant</p>
                <p className="text-indigo-200 text-[10px] mt-0.5">AI · Always here to help</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white transition-colors p-1 rounded" aria-label="Close">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>
          <div ref={feedRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 bg-[#F8F9FC]">
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.from === 'student' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] flex flex-col gap-0.5 ${msg.from === 'student' ? 'items-end' : 'items-start'}`}>
                  <div className="px-3 py-2 rounded-md text-sm leading-relaxed"
                    style={msg.from === 'student'
                      ? { background: '#4F46E5', color: 'white' }
                      : { background: 'white', color: '#0F172A', border: '1px solid #E2E8F0' }
                    }
                  >
                    {msg.text.split(/\*\*(.*?)\*\*/g).map((part, i) =>
                      i % 2 === 1 ? <strong key={i}>{part}</strong> : <span key={i}>{part}</span>
                    )}
                  </div>
                  <span className="mono text-[10px] text-[#94A3B8]">{msg.time}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="px-3 pt-2.5 pb-0 flex gap-1.5 flex-wrap border-t border-[#E2E8F0] bg-white">
            {chips.map(chip => (
              <button key={chip} onClick={() => sendMessage(chip)} className="text-[11px] px-2.5 py-1 rounded border border-[#E2E8F0] text-[#4F46E5] hover:bg-[#EEF2FF] hover:border-[#4F46E5] transition-colors font-500 whitespace-nowrap mb-2">
                {chip}
              </button>
            ))}
          </div>
          <div className="px-3 pb-3 bg-white flex gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage(input)}
              placeholder="Ask about your placements…"
              className="flex-1 text-sm px-3 py-2 rounded border border-[#E2E8F0] bg-[#F8F9FC] text-[#0F172A] placeholder-[#94A3B8] outline-none focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5] transition-colors"
            />
            <button onClick={() => sendMessage(input)} className="px-3 py-2 rounded bg-[#4F46E5] text-white hover:bg-[#4338CA] transition-colors flex-shrink-0" aria-label="Send">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen(o => !o)}
        className="rounded-full bg-[#4F46E5] text-white shadow-lg hover:bg-[#4338CA] hover:shadow-xl transition-all duration-200 flex items-center justify-center relative"
        style={{ width: 52, height: 52 }}
        aria-label="Toggle Placement Assistant"
      >
        {open ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
        {!open && <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-green-400 border-2 border-white" />}
      </button>
    </div>
  )
}

// ─── Student Dashboard ────────────────────────────────────────────────────────

function StudentDashboard({ auth, onLogout }: { auth: AuthState; onLogout: () => void }) {
  const [apps, setApps] = useState<Application[]>([])
  const [filterStage, setFilterStage] = useState<Stage | 'All'>('All')
  const [searchFocused, setSearchFocused] = useState(false)

  const fetchApps = async () => {
    try {
      const res = await fetch(`http://localhost:8000/api/applications?student_id=${auth.id}`)
      if (res.ok) {
        const data = await res.json()
        setApps(data)
      }
    } catch (e) {
      console.error("Error fetching applications:", e)
    }
  }

  useEffect(() => {
    fetchApps()
    
    // Connect to WebSocket for real-time updates
    const ws = new WebSocket("ws://localhost:8000/ws")
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        if (msg.type === "refresh") {
          fetchApps()
        }
      } catch (e) {
        console.error("WebSocket message parse error:", e)
      }
    }
    ws.onerror = (err) => console.error("WebSocket error:", err)
    return () => ws.close()
  }, [auth.id])

  const filtered = filterStage === 'All' ? apps : apps.filter(a => a.stage === filterStage)
  const stages: (Stage | 'All')[] = ['All', 'Applied', 'Shortlisted', 'Interviewed', 'Selected', 'Rejected']

  const appSent = apps.length
  const shortlisted = apps.filter(a => ['Shortlisted', 'Interviewed', 'Selected'].includes(a.stage)).length
  const offers = apps.filter(a => a.stage === 'Selected').length

  const studentName = apps.length > 0 ? apps[0].name : auth.name
  const studentBranch = apps.length > 0 ? apps[0].branch : "CSE"
  const studentCgpa = apps.length > 0 ? apps[0].cgpa : "7.80"
  const initials = studentName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  const bestOffer = (() => {
    const placedApps = apps.filter(a => a.stage === 'Selected')
    if (placedApps.length === 0) return "No offers received yet"
    let maxVal = 0
    let maxApp = placedApps[0]
    placedApps.forEach(a => {
      const match = a.package.match(/(\d+)/)
      if (match) {
        const val = parseInt(match[1])
        if (val > maxVal) { maxVal = val; maxApp = a }
      }
    })
    return `Best: ${maxApp.company} ${maxApp.package}`
  })()

  return (
    <div className="min-h-screen bg-[#F8F9FC]">
      {/* Nav */}
      <header className="bg-white border-b border-[#E2E8F0] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-4">
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-7 h-7 rounded bg-[#4F46E5] flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" />
              </svg>
            </div>
            <span className="text-sm font-700 text-[#0F172A] hidden sm:block">PlaceTrack</span>
            <span className="text-[#E2E8F0] hidden sm:block">|</span>
            <span className="text-xs text-[#64748B] hidden sm:block font-500">NIT Surathkal</span>
          </div>

          <div className="flex-1 max-w-sm relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search companies, drives…"
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              className="w-full pl-9 pr-3 py-1.5 text-sm bg-[#F8F9FC] border rounded outline-none transition-all duration-150 placeholder-[#94A3B8]"
              style={{ borderColor: searchFocused ? '#4F46E5' : '#E2E8F0', boxShadow: searchFocused ? '0 0 0 2px rgba(79,70,229,0.12)' : 'none' }}
            />
          </div>

          <div className="flex items-center gap-3 ml-auto">
            <button className="relative w-8 h-8 flex items-center justify-center text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] rounded transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#F97316]" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#4F46E5] flex items-center justify-center text-white text-xs font-700">{initials}</div>
              <div className="hidden sm:block">
                <p className="text-xs font-600 text-[#0F172A] leading-none">{studentName}</p>
                <p className="mono text-[10px] text-[#64748B] mt-0.5">{auth.id}</p>
              </div>
            </div>
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 text-xs text-[#64748B] hover:text-[#EF4444] border border-[#E2E8F0] hover:border-red-200 px-3 py-1.5 rounded transition-colors font-500"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Page header */}
        <div className="mb-7">
          <div className="flex items-center gap-2 mb-1">
            <p className="mono text-[11px] text-[#64748B] uppercase tracking-widest">Dashboard</p>
            <span className="w-1 h-1 rounded-full bg-[#CBD5E1]" />
            <p className="mono text-[11px] text-[#4F46E5] uppercase tracking-widest">Student View</p>
          </div>
          <h1 className="text-2xl font-800 text-[#0F172A]">Good morning, {studentName.split(' ')[0]} 👋</h1>
          <p className="text-sm text-[#64748B] mt-1">Placement season 2026 · {studentBranch} Batch · {studentCgpa} CGPA</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <SummaryCard label="Applications Sent" value={appSent} sub={`Across ${apps.length} companies this season`} accent="#3B82F6" />
          <SummaryCard label="Shortlisted Drives" value={shortlisted} sub="Interviews scheduled or ongoing" accent="#F97316" />
          <SummaryCard label="Offers Received" value={offers} sub={bestOffer} accent="#22C55E" />
        </div>

        {/* Applications Table */}
        <div className="bg-white rounded-md border border-[#E2E8F0] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E2E8F0] flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-700 text-[#0F172A]">Active Applications</h2>
              <p className="text-xs text-[#64748B] mt-0.5">{filtered.length} of {apps.length} records</p>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {stages.map(s => (
                <button
                  key={s}
                  onClick={() => setFilterStage(s)}
                  className="text-xs px-3 py-1 rounded border transition-colors duration-150 font-500"
                  style={filterStage === s
                    ? { background: '#4F46E5', color: 'white', borderColor: '#4F46E5' }
                    : { background: 'white', color: '#64748B', borderColor: '#E2E8F0' }
                  }
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F8F9FC] border-b border-[#E2E8F0]">
                  <th className="text-left px-5 py-3 text-[11px] font-600 uppercase tracking-widest text-[#64748B]">Company</th>
                  <th className="text-left px-4 py-3 text-[11px] font-600 uppercase tracking-widest text-[#64748B]">Role</th>
                  <th className="text-left px-4 py-3 text-[11px] font-600 uppercase tracking-widest text-[#64748B]">Drive Date</th>
                  <th className="text-left px-4 py-3 text-[11px] font-600 uppercase tracking-widest text-[#64748B]">Stage</th>
                  <th className="text-right px-5 py-3 text-[11px] font-600 uppercase tracking-widest text-[#64748B]">Package</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(app => (
                  <tr key={app.id} className="border-b border-[#F1F5F9] hover:bg-[#F8F9FC] transition-colors duration-100 cursor-pointer">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <CompanyLogo letter={app.logo} company={app.company} />
                        <span className="font-600 text-[#0F172A]">{app.company}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-[#64748B] text-xs">{app.role}</td>
                    <td className="px-4 py-3.5"><span className="mono text-xs text-[#64748B]">{app.driveDate}</span></td>
                    <td className="px-4 py-3.5"><StageBadge stage={app.stage} /></td>
                    <td className="px-5 py-3.5 text-right"><span className="mono text-sm font-600 text-[#0F172A]">{app.package}</span></td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-12 text-[#94A3B8] text-sm">No applications match this filter.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 flex items-center justify-between bg-[#F8F9FC]">
            <p className="mono text-[11px] text-[#94A3B8]">Showing {filtered.length} results · Last synced just now</p>
            <button className="text-[11px] text-[#4F46E5] font-600 hover:underline">View All Drives →</button>
          </div>
        </div>

        {/* Info strip */}
        <div className="mt-6 bg-[#EEF2FF] border border-[#C7D2FE] rounded-md px-5 py-4 flex items-start gap-3">
          <div className="w-6 h-6 rounded bg-[#4F46E5] flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-600 text-[#4338CA]">3 new drives opening soon</p>
            <p className="text-xs text-[#6366F1] mt-0.5">Amazon, Flipkart, and PhonePe have posted new campus drives. Eligibility: 7.5+ CGPA, CSE/ECE batch. <span className="underline cursor-pointer">Browse Drives</span></p>
          </div>
        </div>
      </main>

      <ChatWidget studentId={auth.id} studentName={studentName} applications={apps} />
    </div>
  )
}

// ─── Root App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [auth, setAuth] = useState<AuthState | null>(null)

  const handleLogin = (role: AuthRole, id: string, name: string) => {
    setAuth({ role, id, name })
  }

  const handleLogout = () => setAuth(null)

  if (!auth) return <Login onLogin={handleLogin} />

  if (auth.role === 'officer') {
    return <OfficerDashboard officerName={auth.name} officerId={auth.id} onLogout={handleLogout} />
  }

  return <StudentDashboard auth={auth} onLogout={handleLogout} />
}
