import { useState, useEffect, useRef, useCallback } from 'react'
import * as XLSX from 'xlsx'

// ─── Types ────────────────────────────────────────────────────────────────────

type DriveStatus = 'Upcoming' | 'Live' | 'Completed' | 'Cancelled'
type PipelineStage = 'Applied' | 'Shortlisted' | 'Interviewed' | 'Selected' | 'Rejected'

interface Drive {
  id: string
  company: string
  logo: string
  logoColor: string
  date: string
  role: string
  status: DriveStatus
  eligible: number
  applied: number
  offers: number
  package: string
  minCgpa?: string
  branches?: string
  openings?: string
  hrContact?: string
  description?: string
}

interface ActivityItem {
  id: string
  student: string
  studentId: string
  action: string
  company: string
  time: string
  type: 'selected' | 'shortlisted' | 'applied' | 'rejected'
}

interface PipelineRow {
  company: string
  logo: string
  logoColor: string
  applied: number
  shortlisted: number
  interviewed: number
  selected: number
  rejected: number
}

// Student record used in the spreadsheet
interface StudentRow {
  id: string           // row key
  studentId: string
  name: string
  branch: string
  batch: string
  cgpa: string
  companies: string    // comma-separated
  stage: string
  offerLetter: 'Issued' | 'Pending' | 'N/A'
  package: string
  email: string
  phone: string
}

interface POChatMessage {
  id: string
  from: 'officer' | 'assistant'
  text: string
  time: string
}

// ─── Initial Data ─────────────────────────────────────────────────────────────

const initialDrives: Drive[] = []
const initialPipeline: PipelineRow[] = []
const seedActivity: ActivityItem[] = []
const liveUpdates: any[] = []
const initialStudents: StudentRow[] = []

const logoColorOptions = [
  '#4285F4', '#00A4EF', '#0052CC', '#FF3366', '#3395FF',
  '#635BFF', '#F97316', '#22C55E', '#EF4444', '#8B5CF6',
  '#14B8A6', '#F59E0B', '#0F172A', '#EC4899', '#10B981',
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

const driveStatusStyle: Record<DriveStatus, { bg: string; text: string; dot: string }> = {
  Live:      { bg: '#F0FDF4', text: '#15803D', dot: '#22C55E' },
  Upcoming:  { bg: '#EFF6FF', text: '#1D4ED8', dot: '#3B82F6' },
  Completed: { bg: '#F8FAFC', text: '#64748B', dot: '#94A3B8' },
  Cancelled: { bg: '#FFF1F2', text: '#BE123C', dot: '#F43F5E' },
}

const activityTypeStyle: Record<string, string> = {
  selected: '#22C55E', shortlisted: '#F97316', applied: '#3B82F6', rejected: '#F43F5E',
}

function tsNow() {
  return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function chatNow() {
  return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}



// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color, icon }: { label: string; value: string | number; sub: string; color: string; icon: React.ReactNode }) {
  return (
    <div className="bg-white rounded-md border border-[#E2E8F0] p-5 flex flex-col gap-3 hover:shadow-sm transition-shadow">
      <div className="flex items-center justify-between">
        <p className="text-xs font-600 uppercase tracking-widest text-[#64748B]">{label}</p>
        <div className="w-8 h-8 rounded flex items-center justify-center" style={{ background: color + '18' }}>
          <span style={{ color }}>{icon}</span>
        </div>
      </div>
      <p className="text-3xl font-800 text-[#0F172A] leading-none">{value}</p>
      <p className="text-xs text-[#64748B]">{sub}</p>
    </div>
  )
}

// ─── Field helper (must live outside AddDriveModal to keep stable identity) ───

function Field({ label, id, required, error, children }: { label: string; id: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-600 text-[#374151] mb-1 uppercase tracking-wide">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}

// ─── Add Drive Modal ──────────────────────────────────────────────────────────

interface AddDriveModalProps {
  onClose: () => void
  onAdd: (drive: Drive) => void
}

const emptyForm = {
  company: '', logo: '', logoColor: '#4285F4', role: '', date: '',
  package: '', status: 'Upcoming' as DriveStatus, eligible: '',
  openings: '', minCgpa: '', branches: '', hrContact: '', description: '',
}

function AddDriveModal({ onClose, onAdd }: AddDriveModalProps) {
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState<Partial<typeof emptyForm>>({})
  const [submitting, setSubmitting] = useState(false)

  const set = (key: keyof typeof emptyForm, val: string) =>
    setForm(f => ({ ...f, [key]: val }))

  const validate = () => {
    const e: Partial<typeof emptyForm> = {}
    if (!form.company.trim()) e.company = 'Required'
    if (!form.logo.trim()) e.logo = 'Required (1 letter)'
    if (!form.role.trim()) e.role = 'Required'
    if (!form.date.trim()) e.date = 'Required'
    if (!form.package.trim()) e.package = 'Required'
    if (!form.eligible.trim() || isNaN(Number(form.eligible))) e.eligible = 'Enter a valid number'
    return e
  }

  const submit = () => {
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setSubmitting(true)
    setTimeout(() => {
      const newDrive: Drive = {
        id: Date.now().toString(),
        company: form.company.trim(),
        logo: form.logo.trim().charAt(0).toUpperCase(),
        logoColor: form.logoColor,
        date: form.date,
        role: form.role.trim(),
        status: form.status,
        eligible: Number(form.eligible),
        applied: 0,
        offers: 0,
        package: form.package.trim().startsWith('₹') ? form.package.trim() : `₹${form.package.trim()}`,
        minCgpa: form.minCgpa,
        branches: form.branches,
        openings: form.openings,
        hrContact: form.hrContact,
        description: form.description,
      }
      onAdd(newDrive)
      onClose()
    }, 700)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    submit()
  }

  const inputCls = (err?: string) =>
    `w-full px-3 py-2 text-sm border rounded outline-none transition-all ${err ? 'border-red-400 focus:border-red-500' : 'border-[#E2E8F0] focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5]/20'} bg-white placeholder-[#94A3B8]`

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(2px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-md border border-[#E2E8F0] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-base font-700 text-[#0F172A]">Add New Drive</h2>
            <p className="text-xs text-[#64748B] mt-0.5">Fill in the drive details to publish it to the portal</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#0F172A] transition-colors">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Company row */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Company Name" id="company" required error={errors.company}>
              <input id="company" value={form.company} onChange={e => { set('company', e.target.value); if (e.target.value) set('logo', e.target.value[0]) }} placeholder="e.g. Amazon" className={inputCls(errors.company)} />
            </Field>
            <Field label="Logo Letter" id="logo" required error={errors.logo}>
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded flex items-center justify-center text-white font-700 text-sm flex-shrink-0" style={{ background: form.logoColor }}>
                  {form.logo.charAt(0).toUpperCase() || '?'}
                </div>
                <input id="logo" value={form.logo} maxLength={1} onChange={e => set('logo', e.target.value)} placeholder="A" className={`${inputCls(errors.logo)} w-14 text-center font-700 uppercase`} />
              </div>
            </Field>
          </div>

          {/* Color picker */}
          <Field label="Logo Color" id="logoColor">
            <div className="flex flex-wrap gap-2 mt-1">
              {logoColorOptions.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => set('logoColor', c)}
                  className="w-6 h-6 rounded transition-transform hover:scale-110"
                  style={{ background: c, outline: form.logoColor === c ? `2px solid ${c}` : '2px solid transparent', outlineOffset: 2 }}
                />
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Role / Position" id="role" required error={errors.role}>
              <input id="role" value={form.role} onChange={e => set('role', e.target.value)} placeholder="e.g. SDE – I" className={inputCls(errors.role)} />
            </Field>
            <Field label="Drive Date" id="date" required error={errors.date}>
              <input id="date" type="date" value={form.date} onChange={e => set('date', e.target.value)} className={inputCls(errors.date)} />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Field label="Package (CTC)" id="package" required error={errors.package}>
              <input id="package" value={form.package} onChange={e => set('package', e.target.value)} placeholder="e.g. ₹30 LPA" className={inputCls(errors.package)} />
            </Field>
            <Field label="No. of Openings" id="openings">
              <input id="openings" value={form.openings} onChange={e => set('openings', e.target.value)} placeholder="e.g. 10" className={inputCls()} />
            </Field>
            <Field label="Drive Status" id="status">
              <select id="status" value={form.status} onChange={e => set('status', e.target.value as DriveStatus)} className={inputCls()}>
                <option>Upcoming</option>
                <option>Live</option>
                <option>Completed</option>
                <option>Cancelled</option>
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Eligible Students" id="eligible" required error={errors.eligible}>
              <input id="eligible" value={form.eligible} onChange={e => set('eligible', e.target.value)} placeholder="e.g. 80" className={inputCls(errors.eligible)} />
            </Field>
            <Field label="Min CGPA" id="minCgpa">
              <input id="minCgpa" value={form.minCgpa} onChange={e => set('minCgpa', e.target.value)} placeholder="e.g. 7.5" className={inputCls()} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Eligible Branches" id="branches">
              <input id="branches" value={form.branches} onChange={e => set('branches', e.target.value)} placeholder="e.g. CSE, ECE, IT" className={inputCls()} />
            </Field>
            <Field label="HR / Recruiter Contact" id="hrContact">
              <input id="hrContact" value={form.hrContact} onChange={e => set('hrContact', e.target.value)} placeholder="recruiter@company.com" className={inputCls()} />
            </Field>
          </div>

          <Field label="Job Description" id="description">
            <textarea
              id="description"
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="Brief description of the role, responsibilities, and selection process…"
              rows={3}
              className={`${inputCls()} resize-none`}
            />
          </Field>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#E2E8F0] flex items-center justify-between gap-3 flex-shrink-0 bg-[#F8F9FC]">
          <p className="text-[11px] text-[#94A3B8]">Fields marked <span className="text-red-500">*</span> are required. Drive will be saved and reflected in all views.</p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-600 text-[#64748B] border border-[#E2E8F0] rounded hover:bg-[#F1F5F9] transition-colors">
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={submitting}
              className="px-5 py-2 text-sm font-600 text-white rounded transition-colors flex items-center gap-2"
              style={{ background: submitting ? '#818CF8' : '#4F46E5' }}
            >
              {submitting ? (
                <>
                  <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                  Saving…
                </>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                  Add Drive
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── PO Chatbot Widget ────────────────────────────────────────────────────────

const poInitialMessages: POChatMessage[] = [
  {
    id: '1', from: 'assistant',
    text: "Hello! I'm your Admin Intelligence Assistant. I can answer queries about student registrations, offer letter status, drive pipelines, eligibility, branch-wise stats, and more. How can I help you today?",
    time: chatNow(),
  },
]

const poChips = [
  'Total placed students',
  'Pending offer letters',
  'Registration stats',
  'Unplaced students',
  'Stripe drive details',
  'CGPA & eligibility',
]

function POChatWidget({ drives }: { drives: Drive[] }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<POChatMessage[]>(poInitialMessages)
  const [input, setInput] = useState('')
  const feedRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight
  }, [messages, open])

  const send = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    const userMsg: POChatMessage = { id: Date.now().toString(), from: 'officer', text: trimmed, time: chatNow() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    
    try {
      const res = await fetch("http://localhost:8000/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Student-Id": "OFFICER"
        },
        body: JSON.stringify({ query: trimmed })
      })
      if (res.ok) {
        const data = await res.json()
        setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), from: 'assistant', text: data.reply, time: chatNow() }])
      } else {
        setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), from: 'assistant', text: "I am not confident about that request. I can only help you check student applications, drive dates, and offer status.", time: chatNow() }])
      }
    } catch (e) {
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), from: 'assistant', text: "Error: Could not connect to assistant backend.", time: chatNow() }])
    }
  }

  const renderText = (text: string) =>
    text.split(/\*\*(.*?)\*\*/g).map((part, i) =>
      i % 2 === 1 ? <strong key={i}>{part}</strong> : <span key={i}>{part}</span>
    )

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {open && (
        <div
          className="w-80 sm:w-[400px] bg-white rounded-md border border-[#E2E8F0] shadow-2xl flex flex-col overflow-hidden"
          style={{ height: '560px' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#E2E8F0]" style={{ background: '#0F172A' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded bg-white/10 flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <div>
                <p className="text-white text-sm font-600 leading-none">Admin Intelligence</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  <p className="text-slate-400 text-[10px]">PO Assistant · Online</p>
                </div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-white transition-colors p-1 rounded">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>

          {/* Messages */}
          <div ref={feedRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 bg-[#F8F9FC]">
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.from === 'officer' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[84%] flex flex-col gap-0.5 ${msg.from === 'officer' ? 'items-end' : 'items-start'}`}>
                  {msg.from === 'assistant' && (
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <div className="w-4 h-4 rounded-full bg-[#0F172A] flex items-center justify-center">
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /></svg>
                      </div>
                      <span className="text-[10px] text-[#94A3B8] font-500">Admin Assistant</span>
                    </div>
                  )}
                  <div
                    className="px-3 py-2.5 rounded-md text-sm leading-relaxed whitespace-pre-line"
                    style={msg.from === 'officer'
                      ? { background: '#4F46E5', color: 'white' }
                      : { background: 'white', color: '#0F172A', border: '1px solid #E2E8F0' }
                    }
                  >
                    {renderText(msg.text)}
                  </div>
                  <span className="mono text-[10px] text-[#94A3B8]">{msg.time}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Chips */}
          <div className="px-3 pt-2 pb-0 border-t border-[#E2E8F0] bg-white flex flex-wrap gap-1.5">
            {poChips.map(chip => (
              <button
                key={chip}
                onClick={() => send(chip)}
                className="text-[11px] px-2 py-1 rounded border border-[#E2E8F0] text-[#0F172A] hover:bg-[#F1F5F9] hover:border-[#94A3B8] transition-colors font-500 whitespace-nowrap mb-1.5"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="px-3 pb-3 bg-white flex gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send(input)}
              placeholder="Ask about students, drives, offers…"
              className="flex-1 text-sm px-3 py-2 rounded border border-[#E2E8F0] bg-[#F8F9FC] text-[#0F172A] placeholder-[#94A3B8] outline-none focus:border-[#0F172A] transition-colors"
            />
            <button onClick={() => send(input)} className="px-3 py-2 rounded text-white hover:opacity-90 transition-opacity flex-shrink-0" style={{ background: '#0F172A' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setOpen(o => !o)}
        className="rounded-full text-white shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center relative"
        style={{ width: 52, height: 52, background: open ? '#64748B' : '#0F172A' }}
        aria-label="Toggle Admin Assistant"
      >
        {open ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        )}
        {!open && <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#4F46E5] border-2 border-white text-[8px] text-white flex items-center justify-center font-700">AI</span>}
      </button>
    </div>
  )
}

// ─── Student Spreadsheet ─────────────────────────────────────────────────────

type SortDir = 'asc' | 'desc' | null
type ColKey = keyof StudentRow

const COLS: { key: ColKey; label: string; width: string; editable?: boolean }[] = [
  { key: 'studentId',   label: 'Student ID',     width: 'w-28',  editable: false },
  { key: 'name',        label: 'Name',            width: 'w-40',  editable: true  },
  { key: 'branch',      label: 'Branch',          width: 'w-20',  editable: true  },
  { key: 'batch',       label: 'Batch',           width: 'w-16',  editable: true  },
  { key: 'cgpa',        label: 'CGPA',            width: 'w-16',  editable: true  },
  { key: 'companies',   label: 'Applied To',      width: 'w-44',  editable: true  },
  { key: 'stage',       label: 'Stage',           width: 'w-28',  editable: true  },
  { key: 'offerLetter', label: 'Offer Letter',    width: 'w-28',  editable: true  },
  { key: 'package',     label: 'Package',         width: 'w-24',  editable: true  },
  { key: 'email',       label: 'Email',           width: 'w-48',  editable: true  },
  { key: 'phone',       label: 'Phone',           width: 'w-32',  editable: true  },
]

const stageColors: Record<string, { bg: string; text: string }> = {
  'Selected':    { bg: '#F0FDF4', text: '#15803D' },
  'Shortlisted': { bg: '#FFF7ED', text: '#C2410C' },
  'Interviewed': { bg: '#F5F3FF', text: '#6D28D9' },
  'Applied':     { bg: '#EFF6FF', text: '#1D4ED8' },
  'Rejected':    { bg: '#FFF1F2', text: '#BE123C' },
  'Not Applied': { bg: '#F1F5F9', text: '#64748B' },
}

const offerColors: Record<string, { bg: string; text: string }> = {
  'Issued':  { bg: '#F0FDF4', text: '#15803D' },
  'Pending': { bg: '#FFF7ED', text: '#C2410C' },
  'N/A':     { bg: '#F1F5F9', text: '#64748B' },
}

const blankRow = (): StudentRow => ({
  id: Date.now().toString(),
  studentId: `STU_${Math.floor(Math.random() * 900) + 100}`,
  name: '', branch: '', batch: '2026', cgpa: '',
  companies: '', stage: 'Not Applied', offerLetter: 'N/A',
  package: '', email: '', phone: '',
})

// Map arbitrary header names from uploaded file → StudentRow keys
const HEADER_MAP: Record<string, ColKey> = {
  'student id': 'studentId', 'studentid': 'studentId', 'id': 'studentId',
  'name': 'name', 'student name': 'name', 'full name': 'name',
  'branch': 'branch', 'dept': 'branch', 'department': 'branch',
  'batch': 'batch', 'year': 'batch',
  'cgpa': 'cgpa', 'gpa': 'cgpa', 'grade': 'cgpa',
  'companies': 'companies', 'applied to': 'companies', 'company': 'companies',
  'stage': 'stage', 'status': 'stage', 'placement status': 'stage',
  'offer letter': 'offerLetter', 'offerletter': 'offerLetter', 'offer': 'offerLetter',
  'package': 'package', 'ctc': 'package', 'salary': 'package',
  'email': 'email', 'email id': 'email', 'mail': 'email',
  'phone': 'phone', 'mobile': 'phone', 'contact': 'phone',
}

function parseSheetToRows(workbook: XLSX.WorkBook): StudentRow[] {
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const raw = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' })
  if (!raw.length) return []
  // Build column map from first row's headers
  const firstKeys = Object.keys(raw[0])
  const colMap: Partial<Record<ColKey, string>> = {}
  for (const k of firstKeys) {
    const mapped = HEADER_MAP[k.toLowerCase().trim()]
    if (mapped) colMap[mapped] = k
  }
  return raw.map((r, i) => {
    const get = (col: ColKey) => String(r[colMap[col] ?? ''] ?? '').trim()
    const offerRaw = get('offerLetter').toLowerCase()
    const offerLetter: StudentRow['offerLetter'] =
      offerRaw.includes('issue') ? 'Issued' :
      offerRaw.includes('pend') ? 'Pending' : 'N/A'
    return {
      id: `upload-${Date.now()}-${i}`,
      studentId:   get('studentId')   || `STU_${String(i + 1).padStart(3, '0')}`,
      name:        get('name'),
      branch:      get('branch'),
      batch:       get('batch')       || '2026',
      cgpa:        get('cgpa'),
      companies:   get('companies'),
      stage:       get('stage')       || 'Not Applied',
      offerLetter,
      package:     get('package'),
      email:       get('email'),
      phone:       get('phone'),
    }
  })
}

interface StudentSpreadsheetProps {
  rows: StudentRow[]
}

function StudentSpreadsheet({ rows }: StudentSpreadsheetProps) {
  const [editing, setEditing] = useState<{ rowId: string; col: ColKey } | null>(null)
  const [editVal, setEditVal] = useState('')
  const [search, setSearch] = useState('')
  const [sortCol, setSortCol] = useState<ColKey | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [saved, setSaved] = useState(false)
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null)

  // Upload state
  const [dragOver, setDragOver] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadPreview, setUploadPreview] = useState<StudentRow[]>([])
  const [uploadError, setUploadError] = useState('')
  const [uploadMode, setUploadMode] = useState<'replace' | 'merge'>('merge')
  const [showPreview, setShowPreview] = useState(false)
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  const processFile = useCallback((file: File) => {
    setUploadError('')
    setUploadFile(file)
    setShowPreview(false)
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (!['csv', 'xlsx', 'xls'].includes(ext)) {
      setUploadError('Unsupported file type. Please upload a .csv, .xlsx, or .xls file.')
      setUploadFile(null)
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array' })
        const parsed = parseSheetToRows(wb)
        if (!parsed.length) {
          setUploadError('The file appears to be empty or has no readable rows.')
          return
        }
        setUploadPreview(parsed)
        setShowPreview(true)
      } catch {
        setUploadError('Failed to read the file. Ensure it is a valid spreadsheet.')
      }
    }
    reader.readAsArrayBuffer(file)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [processFile])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    e.target.value = ''
  }

  const confirmImport = async () => {
    setImporting(true)
    try {
      if (uploadMode === 'replace') {
        for (const row of rows) {
          await fetch(`http://localhost:8000/api/applications/${row.id}`, { method: 'DELETE' })
        }
      }
      const records = uploadPreview.map(r => ({
        studentId: r.studentId,
        name: r.name,
        branch: r.branch,
        batch: r.batch,
        cgpa: r.cgpa,
        companies: r.companies,
        stage: r.stage,
        offerLetter: r.offerLetter,
        package: r.package,
        email: r.email,
        phone: r.phone,
        role: r.role || "SWE Intern"
      }))
      
      await fetch(`http://localhost:8000/api/applications/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records })
      })
      
      setShowPreview(false)
      setUploadFile(null)
      setUploadPreview([])
    } catch (e) {
      console.error("Error importing applications:", e)
    } finally {
      setImporting(false)
    }
  }

  const cancelUpload = () => {
    setUploadFile(null)
    setUploadPreview([])
    setShowPreview(false)
    setUploadError('')
  }

  const startEdit = (rowId: string, col: ColKey, val: string) => {
    const colDef = COLS.find(c => c.key === col)
    if (!colDef?.editable) return
    setEditing({ rowId, col })
    setEditVal(val)
  }

  const commitEdit = async () => {
    if (!editing) return
    const row = rows.find(r => r.id === editing.rowId)
    if (!row) return
    
    try {
      await fetch(`http://localhost:8000/api/applications/${editing.rowId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [editing.col]: editVal
        })
      })
    } catch (e) {
      console.error("Error updating applications:", e)
    }
    setEditing(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commitEdit()
    if (e.key === 'Escape') setEditing(null)
  }

  const addRow = async () => {
    const r = blankRow()
    try {
      const res = await fetch(`http://localhost:8000/api/applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: r.studentId,
          name: r.name,
          branch: r.branch,
          batch: r.batch,
          cgpa: r.cgpa,
          companies: r.companies,
          stage: r.stage,
          offerLetter: r.offerLetter,
          package: r.package,
          email: r.email,
          phone: r.phone
        })
      })
      if (res.ok) {
        const data = await res.json()
        setTimeout(() => startEdit(data.id, 'name', ''), 100)
      }
    } catch (e) {
      console.error("Error adding student row:", e)
    }
  }

  const deleteSelected = async () => {
    for (const id of Array.from(selected)) {
      try {
        await fetch(`http://localhost:8000/api/applications/${id}`, { method: 'DELETE' })
      } catch (e) {
        console.error("Error deleting application:", e)
      }
    }
    setSelected(new Set())
  }

  const toggleSelect = (id: string) =>
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const toggleAll = () =>
    setSelected(prev => prev.size === filtered.length ? new Set() : new Set(filtered.map(r => r.id)))

  const handleSort = (col: ColKey) => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : d === 'desc' ? null : 'asc')
      if (sortDir === 'desc') setSortCol(null)
    } else {
      setSortCol(col); setSortDir('asc')
    }
  }

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  // Filter
  const q = search.toLowerCase()
  let filtered = rows.filter(r =>
    !q || Object.values(r).some(v => String(v).toLowerCase().includes(q))
  )

  // Sort
  if (sortCol && sortDir) {
    filtered = [...filtered].sort((a, b) => {
      const av = a[sortCol], bv = b[sortCol]
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true })
      return sortDir === 'asc' ? cmp : -cmp
    })
  }

  const SortIcon = ({ col }: { col: ColKey }) => (
    <span className="ml-1 inline-flex flex-col" style={{ opacity: sortCol === col ? 1 : 0.3 }}>
      <svg width="7" height="5" viewBox="0 0 7 5" fill={sortCol === col && sortDir === 'asc' ? '#4F46E5' : '#94A3B8'}><path d="M3.5 0L7 5H0z" /></svg>
      <svg width="7" height="5" viewBox="0 0 7 5" fill={sortCol === col && sortDir === 'desc' ? '#4F46E5' : '#94A3B8'} style={{ marginTop: 1 }}><path d="M3.5 5L0 0h7z" /></svg>
    </span>
  )

  return (
    <div className="flex flex-col gap-4">

    {/* ── Upload Zone ── */}
    <div className="bg-white rounded-md border border-[#E2E8F0] overflow-hidden">
      <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          <span className="text-sm font-700 text-[#0F172A]">Upload Student Data</span>
        </div>
        <div className="flex items-center gap-1.5">
          {['.csv', '.xlsx', '.xls'].map(ext => (
            <span key={ext} className="mono text-[10px] px-1.5 py-0.5 bg-[#F1F5F9] text-[#64748B] rounded border border-[#E2E8F0]">{ext}</span>
          ))}
        </div>
      </div>

      <div className="p-5">
        {/* Drop zone */}
        {!showPreview && (
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed rounded-md flex flex-col items-center justify-center gap-3 py-10 cursor-pointer transition-all duration-150 select-none"
            style={{
              borderColor: dragOver ? '#4F46E5' : '#CBD5E1',
              background: dragOver ? '#EEF2FF' : '#FAFAFA',
            }}
          >
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center transition-colors"
              style={{ background: dragOver ? '#EEF2FF' : '#F1F5F9' }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={dragOver ? '#4F46E5' : '#94A3B8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </div>
            {uploadFile && !showPreview ? (
              <div className="text-center">
                <p className="text-sm font-600 text-[#4F46E5]">Processing {uploadFile.name}…</p>
                <p className="text-xs text-[#94A3B8] mt-1">Parsing spreadsheet</p>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-sm font-600 text-[#0F172A]">
                  {dragOver ? 'Drop to upload' : 'Drag & drop your spreadsheet here'}
                </p>
                <p className="text-xs text-[#94A3B8] mt-1">or click to browse · .csv · .xlsx · .xls</p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        )}

        {/* Error */}
        {uploadError && (
          <div className="mt-3 flex items-start gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="mt-0.5 flex-shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            {uploadError}
          </div>
        )}

        {/* Preview panel */}
        {showPreview && uploadPreview.length > 0 && (
          <div className="space-y-4">
            {/* File info */}
            <div className="flex items-center justify-between p-3 bg-[#F0FDF4] border border-[#BBF7D0] rounded-md">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded bg-green-100 flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#15803D" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <div>
                  <p className="text-sm font-600 text-[#15803D]">{uploadFile?.name}</p>
                  <p className="text-xs text-[#16A34A]">{uploadPreview.length} student records detected</p>
                </div>
              </div>
              <button onClick={cancelUpload} className="text-xs text-[#64748B] hover:text-red-500 border border-[#E2E8F0] px-2.5 py-1 rounded hover:border-red-200 transition-colors">
                Remove
              </button>
            </div>

            {/* Import mode toggle */}
            <div className="flex items-center gap-3">
              <span className="text-xs font-600 text-[#374151]">Import mode:</span>
              <div className="flex bg-[#F1F5F9] p-0.5 rounded gap-0.5">
                {(['merge', 'replace'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => setUploadMode(m)}
                    className="text-xs px-3 py-1.5 rounded transition-all font-500 capitalize"
                    style={uploadMode === m
                      ? { background: '#4F46E5', color: 'white' }
                      : { color: '#64748B' }
                    }
                  >
                    {m === 'merge' ? '⊕ Merge' : '↺ Replace'}
                  </button>
                ))}
              </div>
              <span className="text-[11px] text-[#94A3B8]">
                {uploadMode === 'merge'
                  ? 'New records appended; existing Student IDs skipped'
                  : 'All current rows will be replaced with uploaded data'}
              </span>
            </div>

            {/* Mini preview table */}
            <div className="border border-[#E2E8F0] rounded overflow-hidden">
              <div className="px-3 py-2 bg-[#F8F9FC] border-b border-[#E2E8F0] flex items-center justify-between">
                <span className="text-xs font-600 text-[#0F172A]">Preview (first 5 rows)</span>
                <span className="mono text-[10px] text-[#94A3B8]">{uploadPreview.length} total rows</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#F8F9FC]">
                      {['Student ID', 'Name', 'Branch', 'CGPA', 'Stage', 'Offer Letter', 'Package'].map(h => (
                        <th key={h} className="px-3 py-2 text-left font-600 uppercase tracking-wide text-[#64748B] border-b border-[#E2E8F0] whitespace-nowrap" style={{ fontSize: 10 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {uploadPreview.slice(0, 5).map((r, i) => (
                      <tr key={i} className="border-b border-[#F1F5F9] hover:bg-[#F8F9FC]">
                        <td className="px-3 py-2 mono text-[#4F46E5] font-600">{r.studentId || '—'}</td>
                        <td className="px-3 py-2 font-500 text-[#0F172A]">{r.name || '—'}</td>
                        <td className="px-3 py-2 text-[#64748B]">{r.branch || '—'}</td>
                        <td className="px-3 py-2 mono font-600" style={{ color: Number(r.cgpa) >= 8 ? '#15803D' : '#C2410C' }}>{r.cgpa || '—'}</td>
                        <td className="px-3 py-2">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-600" style={stageColors[r.stage] ?? { background: '#F1F5F9', color: '#64748B' }}>{r.stage || '—'}</span>
                        </td>
                        <td className="px-3 py-2">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-600" style={offerColors[r.offerLetter] ?? { background: '#F1F5F9', color: '#64748B' }}>{r.offerLetter}</span>
                        </td>
                        <td className="px-3 py-2 mono font-700 text-[#15803D]">{r.package || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {uploadPreview.length > 5 && (
                <div className="px-3 py-2 bg-[#F8F9FC] text-[11px] text-[#94A3B8] mono border-t border-[#E2E8F0]">
                  + {uploadPreview.length - 5} more rows not shown in preview
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={confirmImport}
                disabled={importing}
                className="flex items-center gap-2 px-5 py-2 rounded text-sm font-600 text-white transition-colors"
                style={{ background: importing ? '#818CF8' : '#4F46E5' }}
              >
                {importing ? (
                  <><svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Importing…</>
                ) : (
                  <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>Confirm Import ({uploadPreview.length} rows)</>
                )}
              </button>
              <button onClick={cancelUpload} className="px-4 py-2 rounded text-sm font-600 text-[#64748B] border border-[#E2E8F0] hover:bg-[#F1F5F9] transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Template download hint */}
        {!showPreview && (
          <div className="mt-4 flex items-center gap-2 text-xs text-[#94A3B8]">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            Column headers recognised:
            <span className="mono text-[10px] text-[#64748B]">
              Student ID · Name · Branch · Batch · CGPA · Companies · Stage · Offer Letter · Package · Email · Phone
            </span>
          </div>
        )}
      </div>
    </div>

    {/* ── Spreadsheet table ── */}
    <div className="bg-white rounded-md border border-[#E2E8F0] overflow-hidden flex flex-col">
      {/* Toolbar */}
      <div className="px-4 py-3 border-b border-[#E2E8F0] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="1"/><path d="M3 9h18M3 15h18M9 3v18"/></svg>
            <span className="text-sm font-700 text-[#0F172A]">Student Data</span>
          </div>
          <span className="mono text-[11px] text-[#94A3B8]">{filtered.length} of {rows.length} rows</span>
          {selected.size > 0 && (
            <span className="mono text-[11px] text-[#4F46E5]">{selected.size} selected</span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search students…"
              className="pl-7 pr-3 py-1.5 text-xs border border-[#E2E8F0] rounded bg-[#F8F9FC] outline-none focus:border-[#4F46E5] transition-colors w-44"
            />
          </div>

          {/* Delete selected */}
          {selected.size > 0 && (
            <button onClick={deleteSelected} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-600 text-red-600 border border-red-200 bg-red-50 rounded hover:bg-red-100 transition-colors">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
              Delete {selected.size}
            </button>
          )}

          {/* Add row */}
          <button onClick={addRow} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-600 text-[#4F46E5] border border-[#C7D2FE] bg-[#EEF2FF] rounded hover:bg-[#E0E7FF] transition-colors">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Student
          </button>

          {/* Save */}
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-600 text-white rounded transition-colors"
            style={{ background: saved ? '#22C55E' : '#0F172A' }}
          >
            {saved ? (
              <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>Saved!</>
            ) : (
              <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>Save Changes</>
            )}
          </button>

          {/* Export CSV hint */}
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-600 text-[#64748B] border border-[#E2E8F0] rounded hover:bg-[#F1F5F9] transition-colors">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export CSV
          </button>
        </div>
      </div>

      {/* Spreadsheet */}
      <div className="overflow-auto" style={{ maxHeight: '62vh' }}>
        <table className="text-xs border-collapse" style={{ minWidth: '100%', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: 36 }} />
            {COLS.map(c => <col key={c.key} style={{ width: c.key === 'email' ? 180 : c.key === 'companies' ? 160 : c.key === 'name' ? 140 : 96 }} />)}
          </colgroup>

          <thead className="sticky top-0 z-10">
            <tr style={{ background: '#F8F9FC' }}>
              {/* Row-number / checkbox col */}
              <th className="border border-[#E2E8F0] px-2 py-2 text-center select-none" style={{ background: '#F1F5F9' }}>
                <input
                  type="checkbox"
                  checked={selected.size === filtered.length && filtered.length > 0}
                  onChange={toggleAll}
                  className="accent-[#4F46E5] cursor-pointer"
                />
              </th>
              {COLS.map(col => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className="border border-[#E2E8F0] px-2 py-2 text-left font-600 uppercase tracking-widest text-[#64748B] cursor-pointer hover:bg-[#EEF2FF] select-none whitespace-nowrap"
                  style={{ fontSize: 10 }}
                >
                  <span className="flex items-center gap-0.5">
                    {col.label}
                    <SortIcon col={col.key} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {filtered.map((row, ri) => (
              <tr
                key={row.id}
                className="group"
                style={{ background: selected.has(row.id) ? '#EEF2FF' : ri % 2 === 0 ? '#FFFFFF' : '#FAFAFA' }}
              >
                {/* Row number + checkbox */}
                <td className="border border-[#E2E8F0] px-2 py-0 text-center select-none" style={{ background: selected.has(row.id) ? '#E0E7FF' : '#F8F9FC' }}>
                  <div className="flex items-center justify-center gap-1">
                    <input
                      type="checkbox"
                      checked={selected.has(row.id)}
                      onChange={() => toggleSelect(row.id)}
                      className="accent-[#4F46E5] cursor-pointer"
                    />
                    <span className="mono text-[10px] text-[#CBD5E1] w-5 text-right">{ri + 1}</span>
                  </div>
                </td>

                {COLS.map(col => {
                  const val = row[col.key] as string
                  const isEditing = editing?.rowId === row.id && editing?.col === col.key
                  const isStage = col.key === 'stage'
                  const isOffer = col.key === 'offerLetter'
                  const stageCfg = stageColors[val] ?? { bg: '#F1F5F9', text: '#64748B' }
                  const offerCfg = offerColors[val as keyof typeof offerColors] ?? { bg: '#F1F5F9', text: '#64748B' }

                  return (
                    <td
                      key={col.key}
                      onDoubleClick={() => startEdit(row.id, col.key, val)}
                      className="border border-[#E2E8F0] px-0 py-0 relative"
                      style={{ height: 34 }}
                    >
                      {isEditing ? (
                        // ── Edit cell ──
                        col.key === 'offerLetter' ? (
                          <select
                            ref={inputRef as React.RefObject<HTMLSelectElement>}
                            value={editVal}
                            onChange={e => setEditVal(e.target.value)}
                            onBlur={commitEdit}
                            onKeyDown={handleKeyDown}
                            className="w-full h-full px-2 text-xs border-2 border-[#4F46E5] outline-none bg-white"
                          >
                            <option>Issued</option><option>Pending</option><option>N/A</option>
                          </select>
                        ) : col.key === 'stage' ? (
                          <select
                            ref={inputRef as React.RefObject<HTMLSelectElement>}
                            value={editVal}
                            onChange={e => setEditVal(e.target.value)}
                            onBlur={commitEdit}
                            onKeyDown={handleKeyDown}
                            className="w-full h-full px-2 text-xs border-2 border-[#4F46E5] outline-none bg-white"
                          >
                            {['Not Applied','Applied','Shortlisted','Interviewed','Selected','Rejected'].map(s => <option key={s}>{s}</option>)}
                          </select>
                        ) : (
                          <input
                            ref={inputRef as React.RefObject<HTMLInputElement>}
                            value={editVal}
                            onChange={e => setEditVal(e.target.value)}
                            onBlur={commitEdit}
                            onKeyDown={handleKeyDown}
                            className="w-full h-full px-2 text-xs border-2 border-[#4F46E5] outline-none bg-white"
                            style={{ boxSizing: 'border-box' }}
                          />
                        )
                      ) : (
                        // ── View cell ──
                        <div
                          className={`w-full h-full flex items-center px-2 overflow-hidden ${col.editable ? 'cursor-cell hover:bg-[#F0F4FF]' : 'cursor-default'} group-hover:bg-opacity-80 transition-colors`}
                          title={col.editable ? 'Double-click to edit' : undefined}
                        >
                          {isStage && val ? (
                            <span className="mono inline-block px-1.5 py-0.5 rounded text-[10px] font-600 truncate" style={{ background: stageCfg.bg, color: stageCfg.text }}>{val}</span>
                          ) : isOffer && val ? (
                            <span className="mono inline-block px-1.5 py-0.5 rounded text-[10px] font-600" style={{ background: offerCfg.bg, color: offerCfg.text }}>{val}</span>
                          ) : col.key === 'studentId' ? (
                            <span className="mono text-[#4F46E5] font-600 text-[11px]">{val}</span>
                          ) : col.key === 'cgpa' ? (
                            <span className="mono font-600" style={{ color: Number(val) >= 8 ? '#15803D' : Number(val) >= 7 ? '#C2410C' : '#BE123C' }}>{val}</span>
                          ) : col.key === 'package' && val ? (
                            <span className="mono font-700 text-[#15803D]">{val}</span>
                          ) : (
                            <span className="truncate text-[#0F172A]">{val || <span className="text-[#CBD5E1] italic">—</span>}</span>
                          )}
                          {col.editable && !isEditing && (
                            <svg className="ml-auto opacity-0 group-hover:opacity-30 flex-shrink-0" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2.5" strokeLinecap="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                          )}
                        </div>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}

            {/* Empty state */}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={COLS.length + 1} className="text-center py-16 text-[#94A3B8] border border-[#E2E8F0]">
                  {search ? `No students match "${search}"` : 'No student records yet. Click "Add Student" to begin.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer status bar */}
      <div className="px-4 py-2 border-t border-[#E2E8F0] bg-[#F8F9FC] flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="mono text-[10px] text-[#94A3B8]">
            Double-click any cell to edit · Enter to confirm · Esc to cancel
          </span>
        </div>
        <div className="flex items-center gap-3">
          {[
            { label: 'Placed', val: rows.filter(r => r.stage === 'Selected').length, color: '#22C55E' },
            { label: 'In Progress', val: rows.filter(r => ['Shortlisted','Interviewed'].includes(r.stage)).length, color: '#F97316' },
            { label: 'Not Applied', val: rows.filter(r => r.stage === 'Not Applied').length, color: '#94A3B8' },
          ].map(s => (
            <span key={s.label} className="mono text-[10px] flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
              <span className="text-[#64748B]">{s.label}:</span>
              <span className="font-700 text-[#0F172A]">{s.val}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function OfficerDashboard({ officerName, officerId, onLogout }: OfficerDashboardProps) {
  const [tab, setTab] = useState<'overview' | 'drives' | 'pipeline' | 'activity' | 'students'>('overview')
  const [drives, setDrives] = useState<Drive[]>([])
  const [rows, setRows] = useState<StudentRow[]>([])
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [lastSync, setLastSync] = useState(tsNow())
  const [pulseActive, setPulseActive] = useState(false)
  const [showAddDrive, setShowAddDrive] = useState(false)
  const [successBanner, setSuccessBanner] = useState('')

  const fetchData = async () => {
    try {
      // Fetch drives
      const resDrives = await fetch("http://localhost:8000/api/drives")
      if (resDrives.ok) {
        const data = await resDrives.json()
        setDrives(data)
      }
      
      // Fetch applications (spreadsheet rows)
      const resApps = await fetch("http://localhost:8000/api/applications")
      if (resApps.ok) {
        const data = await resApps.json()
        setRows(data)
      }
      
      setPulseActive(true)
      setTimeout(() => setPulseActive(false), 800)
      setLastSync(tsNow())
    } catch (e) {
      console.error("Error fetching data:", e)
    }
  }

  useEffect(() => {
    fetchData()
    
    // Connect to WebSocket for real-time updates
    const ws = new WebSocket("ws://localhost:8000/ws")
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        if (msg.type === "refresh") {
          fetchData()
        }
      } catch (e) {
        console.error("WebSocket message parse error:", e)
      }
    }
    ws.onerror = (err) => console.error("WebSocket error:", err)
    return () => ws.close()
  }, [])

  // Compute metrics dynamically from applications
  const totalPlaced = rows.filter(r => r.stage === 'Selected').length
  const totalApplied = rows.filter(r => r.stage !== 'Not Applied').length

  // Unique student calculations for overall metrics
  const totalStudents = new Set(rows.map(r => r.studentId)).size
  const appliedStudents = new Set(rows.filter(r => r.stage !== 'Not Applied').map(r => r.studentId)).size
  const shortlistedStudents = new Set(rows.filter(r => ['Shortlisted', 'Interviewed', 'Selected'].includes(r.stage)).map(r => r.studentId)).size
  const interviewedStudents = new Set(rows.filter(r => ['Interviewed', 'Selected'].includes(r.stage)).map(r => r.studentId)).size

  // Highlights Calculations
  let highestPkgVal = 'N/A'
  let highestPkgCompany = 'No drives yet'
  let maxPkg = 0
  drives.forEach(d => {
    const match = d.package.match(/(\d+)/)
    if (match) {
      const val = parseInt(match[1])
      if (val > maxPkg) {
        maxPkg = val
        highestPkgVal = d.package
        highestPkgCompany = `${d.company} (${d.status.toLowerCase()})`
      }
    }
  })

  const companyAppCounts: Record<string, number> = {}
  rows.forEach(r => {
    if (r.companies && r.stage !== 'Not Applied') {
      companyAppCounts[r.companies] = (companyAppCounts[r.companies] || 0) + 1
    }
  })
  let mostAppCompany = 'None'
  let maxApps = 0
  Object.entries(companyAppCounts).forEach(([comp, count]) => {
    if (count > maxApps) {
      maxApps = count
      mostAppCompany = comp
    }
  })

  const branchPlacedCounts: Record<string, number> = {}
  rows.forEach(r => {
    if (r.stage === 'Selected' && r.branch) {
      branchPlacedCounts[r.branch] = (branchPlacedCounts[r.branch] || 0) + 1
    }
  })
  let topBranch = 'None'
  let maxBranchPlaced = 0
  Object.entries(branchPlacedCounts).forEach(([br, count]) => {
    if (count > maxBranchPlaced) {
      maxBranchPlaced = count
      topBranch = br
    }
  })

  // Compute pipeline dynamically from drives and applications
  const pipeline: PipelineRow[] = []
  const companyDrives = new Map<string, { logo: string, color: string }>()
  drives.forEach(d => companyDrives.set(d.company, { logo: d.logo, color: d.logoColor }))

  const companyApps = new Map<string, StudentRow[]>()
  rows.forEach(app => {
    if (app.companies && app.stage !== 'Not Applied') {
      const comp = app.companies
      if (!companyApps.has(comp)) companyApps.set(comp, [])
      companyApps.get(comp)!.push(app)
    }
  })

  companyApps.forEach((apps, company) => {
    const driveInfo = companyDrives.get(company) || { logo: company[0].toUpperCase(), color: '#4F46E5' }
    pipeline.push({
      company,
      logo: driveInfo.logo,
      logoColor: driveInfo.color,
      applied: apps.length,
      shortlisted: apps.filter(a => a.stage === 'Shortlisted').length,
      interviewed: apps.filter(a => a.stage === 'Interviewed').length,
      selected: apps.filter(a => a.stage === 'Selected').length,
      rejected: apps.filter(a => a.stage === 'Rejected').length,
    })
  })

  // Compute activity feed from applications updates
  useEffect(() => {
    const activeApps = rows.filter(r => r.stage !== 'Not Applied')
    const feed = activeApps.map(r => {
      let action = 'applied to'
      let type: 'selected' | 'shortlisted' | 'applied' | 'rejected' = 'applied'
      if (r.stage === 'Selected') { action = 'received offer from'; type = 'selected' }
      else if (r.stage === 'Shortlisted') { action = 'got shortlisted at'; type = 'shortlisted' }
      else if (r.stage === 'Interviewed') { action = 'is interviewing at'; type = 'shortlisted' }
      else if (r.stage === 'Rejected') { action = 'got rejected in rounds at'; type = 'rejected' }
      
      return {
        id: r.id,
        student: r.name,
        studentId: r.studentId,
        action,
        company: r.companies,
        time: 'Active',
        type
      }
    })
    setActivity(feed.slice(0, 15))
  }, [rows])

  const handleAddDrive = async (drive: Drive) => {
    try {
      const res = await fetch("http://localhost:8000/api/drives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: drive.company,
          logo: drive.logo,
          logoColor: drive.logoColor,
          date: drive.date,
          role: drive.role,
          status: drive.status,
          eligible: drive.eligible,
          applied: drive.applied,
          offers: drive.offers,
          package: drive.package,
          minCgpa: drive.minCgpa || "",
          branches: drive.branches || "",
          openings: drive.openings || "",
          hrContact: drive.hrContact || "",
          description: drive.description || ""
        })
      })
      if (res.ok) {
        setSuccessBanner(`Drive for ${drive.company} added successfully!`)
        setTimeout(() => setSuccessBanner(''), 4000)
      }
    } catch (e) {
      console.error("Error adding drive:", e)
    }
  }

  const tabs = [
    { id: 'overview',  label: 'Overview'       },
    { id: 'drives',    label: 'Drives'          },
    { id: 'pipeline',  label: 'Pipeline'        },
    { id: 'activity',  label: 'Live Feed'       },
    { id: 'students',  label: 'Update Students' },
  ] as const

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
            <span className="text-xs text-[#64748B] hidden sm:block font-500">Admin Console</span>
          </div>

          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-colors duration-500"
            style={{ background: pulseActive ? '#F0FDF4' : '#F8FAFC', border: `1px solid ${pulseActive ? '#BBF7D0' : '#E2E8F0'}` }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="mono text-[10px] text-[#64748B] font-500">LIVE · {lastSync}</span>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <p className="text-xs font-600 text-[#0F172A] leading-none">{officerName}</p>
              <p className="mono text-[10px] text-[#64748B] mt-0.5">{officerId} · Placement Officer</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-[#0F172A] flex items-center justify-center text-white text-xs font-700">
              {officerName.split(' ').map((w: string) => w[0]).join('').slice(0, 2)}
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

      {/* Success banner */}
      {successBanner && (
        <div className="bg-green-50 border-b border-green-200 px-4 sm:px-6 py-2.5 flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#15803D" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
          <p className="text-sm text-green-800 font-500">{successBanner}</p>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Page header */}
        <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <p className="mono text-[11px] text-[#64748B] uppercase tracking-widest">Admin</p>
              <span className="w-1 h-1 rounded-full bg-[#CBD5E1]" />
              <p className="mono text-[11px] text-[#4F46E5] uppercase tracking-widest">Real-Time Dashboard</p>
            </div>
            <h1 className="text-2xl font-800 text-[#0F172A]">Placement Overview</h1>
            <p className="text-sm text-[#64748B] mt-1">Anna University · CSE + ECE · Batch 2026 · Syncing live from SQLite via WebSockets</p>
          </div>
          <button
            onClick={() => setShowAddDrive(true)}
            className="flex items-center gap-2 px-4 py-2 rounded bg-[#4F46E5] text-white text-sm font-600 hover:bg-[#4338CA] active:bg-[#3730A3] transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            Add Drive
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 mb-7 border-b border-[#E2E8F0]">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="px-4 py-2.5 text-sm font-600 border-b-2 transition-colors duration-150 -mb-px"
              style={tab === t.id
                ? { borderColor: '#4F46E5', color: '#4F46E5' }
                : { borderColor: 'transparent', color: '#64748B' }
              }
            >
              {t.label}
              {t.id === 'activity' && (
                <span className="ml-1.5 px-1.5 py-0.5 text-[10px] rounded-full bg-green-100 text-green-700 font-600">Live</span>
              )}
              {t.id === 'students' && (
                <span className="ml-1.5 px-1.5 py-0.5 text-[10px] rounded-full bg-[#F1F5F9] text-[#64748B] font-600">Sheet</span>
              )}
              {t.id === 'drives' && drives.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 text-[10px] rounded-full bg-[#EEF2FF] text-[#4F46E5] font-600">{drives.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── Overview ── */}
        {tab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Total Students" value={totalStudents} sub="Registered this season" color="#4F46E5"
                icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
              />
              <StatCard label="Placed Students" value={totalPlaced} sub={`${totalStudents > 0 ? ((totalPlaced / totalStudents) * 100).toFixed(1) : 0}% placement rate`} color="#22C55E"
                icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>}
              />
              <StatCard label="Active Drives" value={drives.filter(d => d.status === 'Live' || d.status === 'Upcoming').length} sub="Live + Upcoming" color="#F97316"
                icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>}
              />
              <StatCard label="Total Applications" value={totalApplied} sub="Across all companies" color="#8B5CF6"
                icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 bg-white rounded-md border border-[#E2E8F0] p-5">
                <h3 className="text-sm font-700 text-[#0F172A] mb-1">Overall Student Pipeline</h3>
                <p className="text-xs text-[#64748B] mb-5">All companies combined · Season 2026</p>
                <div className="space-y-3">
                  {[
                    { label: 'Registered', value: totalStudents, max: totalStudents || 1, color: '#4F46E5' },
                    { label: 'Applied (≥1 company)', value: appliedStudents, max: totalStudents || 1, color: '#6366F1' },
                    { label: 'Shortlisted', value: shortlistedStudents, max: totalStudents || 1, color: '#F97316' },
                    { label: 'Interviewed', value: interviewedStudents, max: totalStudents || 1, color: '#8B5CF6' },
                    { label: 'Placed', value: totalPlaced, max: totalStudents || 1, color: '#22C55E' },
                  ].map(row => (
                    <div key={row.label} className="flex items-center gap-3">
                      <span className="text-xs text-[#64748B] w-40 font-500">{row.label}</span>
                      <div className="flex-1 bg-[#F1F5F9] rounded-full h-2 overflow-hidden">
                        <div className="h-2 rounded-full transition-all duration-700" style={{ width: `${(row.value / row.max) * 100}%`, background: row.color }} />
                      </div>
                      <span className="mono text-xs font-600 text-[#0F172A] w-8 text-right">{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-md border border-[#E2E8F0] p-5 flex flex-col gap-4">
                <h3 className="text-sm font-700 text-[#0F172A]">Highlights</h3>
                {[
                  { label: 'Highest Package', val: highestPkgVal, sub: highestPkgCompany, color: '#22C55E' },
                  { label: 'Most Applications', val: mostAppCompany, sub: `${maxApps} applications filed`, color: '#F97316' },
                  { label: 'Fastest Drive', val: 'Razorpay', sub: 'Completed in 4 days', color: '#8B5CF6' },
                  { label: 'Top Branch', val: topBranch, sub: `${maxBranchPlaced} out of ${totalPlaced} offers`, color: '#4F46E5' },
                ].map(h => (
                  <div key={h.label} className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: h.color }} />
                    <div>
                      <p className="text-xs text-[#64748B]">{h.label}</p>
                      <p className="text-sm font-700 text-[#0F172A]">{h.val}</p>
                      <p className="text-[11px] text-[#94A3B8]">{h.sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Drives ── */}
        {tab === 'drives' && (
          <div className="bg-white rounded-md border border-[#E2E8F0] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="text-sm font-700 text-[#0F172A]">All Campus Drives</h3>
                <p className="text-xs text-[#64748B] mt-0.5">{drives.length} drives this season</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(['Live', 'Upcoming', 'Completed'] as DriveStatus[]).map(s => {
                  const cfg = driveStatusStyle[s]
                  return (
                    <span key={s} className="mono text-[11px] px-2 py-1 rounded flex items-center gap-1" style={{ background: cfg.bg, color: cfg.text }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.dot }} />
                      {drives.filter(d => d.status === s).length} {s}
                    </span>
                  )
                })}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#F8F9FC] border-b border-[#E2E8F0]">
                    {['Company', 'Role', 'Date', 'Status', 'Eligible', 'Applied', 'Offers', 'Package'].map(h => (
                      <th key={h} className={`px-4 py-3 text-[11px] font-600 uppercase tracking-widest text-[#64748B] ${h === 'Package' || h === 'Offers' ? 'text-right' : 'text-left'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {drives.map(d => {
                    const cfg = driveStatusStyle[d.status]
                    return (
                      <tr key={d.id} className="border-b border-[#F1F5F9] hover:bg-[#F8F9FC] transition-colors">
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded flex items-center justify-center text-white text-xs font-700 flex-shrink-0" style={{ background: d.logoColor }}>{d.logo}</div>
                            <span className="font-600 text-[#0F172A]">{d.company}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-[#64748B] text-xs">{d.role}</td>
                        <td className="px-4 py-3.5"><span className="mono text-xs text-[#64748B]">{d.date}</span></td>
                        <td className="px-4 py-3.5">
                          <span className="mono inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded font-500" style={{ background: cfg.bg, color: cfg.text }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.dot }} />{d.status}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-center"><span className="mono text-xs text-[#64748B]">{d.eligible}</span></td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-[#F1F5F9] rounded-full h-1.5 overflow-hidden">
                              <div className="h-1.5 rounded-full bg-[#4F46E5]" style={{ width: d.eligible > 0 ? `${(d.applied / d.eligible) * 100}%` : '0%' }} />
                            </div>
                            <span className="mono text-xs text-[#64748B] w-6">{d.applied}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-right"><span className="mono text-sm font-700" style={{ color: d.offers > 0 ? '#15803D' : '#94A3B8' }}>{d.offers}</span></td>
                        <td className="px-4 py-3.5 text-right"><span className="mono text-sm font-600 text-[#0F172A]">{d.package}</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 bg-[#F8F9FC] flex items-center justify-between">
              <p className="mono text-[11px] text-[#94A3B8]">{drives.length} total drives · {drives.filter(d => d.applied === 0).length} with no applications yet</p>
              <button onClick={() => setShowAddDrive(true)} className="text-[11px] text-[#4F46E5] font-600 hover:underline flex items-center gap-1">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                Add another drive
              </button>
            </div>
          </div>
        )}

        {/* ── Pipeline ── */}
        {tab === 'pipeline' && (
          <div className="bg-white rounded-md border border-[#E2E8F0] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E2E8F0]">
              <h3 className="text-sm font-700 text-[#0F172A]">Student Pipeline by Company</h3>
              <p className="text-xs text-[#64748B] mt-0.5">Updated in real-time · counts increase as students progress</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#F8F9FC] border-b border-[#E2E8F0]">
                    <th className="text-left px-5 py-3 text-[11px] font-600 uppercase tracking-widest text-[#64748B]">Company</th>
                    {(['Applied', 'Shortlisted', 'Interviewed', 'Selected', 'Rejected'] as PipelineStage[]).map(s => (
                      <th key={s} className="text-center px-4 py-3 text-[11px] font-600 uppercase tracking-widest text-[#64748B]">{s}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pipeline.map(row => (
                    <tr key={row.company} className="border-b border-[#F1F5F9] hover:bg-[#F8F9FC] transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded flex items-center justify-center text-white text-xs font-700" style={{ background: row.logoColor }}>{row.logo}</div>
                          <span className="font-600 text-[#0F172A]">{row.company}</span>
                        </div>
                      </td>
                      {[
                        { val: row.applied, bg: '#EFF6FF', text: '#1D4ED8' },
                        { val: row.shortlisted, bg: '#FFF7ED', text: '#C2410C' },
                        { val: row.interviewed, bg: '#F5F3FF', text: '#6D28D9' },
                        { val: row.selected, bg: '#F0FDF4', text: '#15803D' },
                        { val: row.rejected, bg: '#FFF1F2', text: '#BE123C' },
                      ].map((cell, i) => (
                        <td key={i} className="px-4 py-4 text-center">
                          <span className="mono text-sm font-700 px-2.5 py-0.5 rounded" style={{ background: cell.bg, color: cell.text }}>{cell.val}</span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Activity ── */}
        {tab === 'activity' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-white rounded-md border border-[#E2E8F0] overflow-hidden">
              <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-700 text-[#0F172A]">Live Activity Feed</h3>
                  <p className="text-xs text-[#64748B] mt-0.5">Streaming from SQLite · auto-updates instantly via WebSockets</p>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-colors duration-500" style={{ background: pulseActive ? '#F0FDF4' : '#F8FAFC', border: `1px solid ${pulseActive ? '#BBF7D0' : '#E2E8F0'}` }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  <span className="mono text-[10px] text-[#64748B]">Synced {lastSync}</span>
                </div>
              </div>
              <div className="divide-y divide-[#F1F5F9] max-h-[520px] overflow-y-auto">
                {activity.map((item, i) => (
                  <div key={item.id} className="px-5 py-3.5 flex items-start gap-3 hover:bg-[#F8F9FC] transition-colors" style={{ opacity: Math.max(0.5, 1 - i * 0.04) }}>
                    <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: activityTypeStyle[item.type] }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#0F172A]">
                        <span className="font-600">{item.student}</span>
                        <span className="mono text-xs text-[#94A3B8] ml-1">({item.studentId})</span>
                        {' '}<span className="text-[#64748B]">{item.action}</span>{' '}
                        <span className="font-600">{item.company}</span>
                      </p>
                    </div>
                    <span className="mono text-[11px] text-[#94A3B8] flex-shrink-0">{item.time}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="bg-white rounded-md border border-[#E2E8F0] p-5">
                <h3 className="text-sm font-700 text-[#0F172A] mb-4">Event Types</h3>
                <div className="space-y-3">
                  {[
                    { type: 'selected', label: 'Offer Received', color: '#22C55E' },
                    { type: 'shortlisted', label: 'Shortlisted', color: '#F97316' },
                    { type: 'applied', label: 'Applied', color: '#3B82F6' },
                    { type: 'rejected', label: 'Rejected', color: '#F43F5E' },
                  ].map(e => (
                    <div key={e.type} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ background: e.color }} />
                        <span className="text-sm text-[#64748B]">{e.label}</span>
                      </div>
                      <span className="mono text-sm font-700 text-[#0F172A]">{activity.filter(a => a.type === e.type).length}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-[#EEF2FF] border border-[#C7D2FE] rounded-md p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#4F46E5] animate-pulse" />
                  <p className="text-xs font-600 text-[#4338CA]">SQLite Connection</p>
                </div>
                <p className="mono text-[11px] text-[#6366F1]">{'const ws = new WebSocket(\"/ws\")'}<br />{'ws.onmessage = (event) => {'}<br />{'  fetchData() // refresh state'}<br />{'}'}</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Students Spreadsheet ── */}
        {tab === 'students' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-700 text-[#0F172A]">Student Records</h2>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Click any cell to select · <span className="font-600">Double-click</span> to edit · Changes are local until you hit Save
                </p>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 bg-[#EEF2FF] border border-[#C7D2FE] rounded">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <span className="text-xs text-[#4338CA]">Staged changes are saved to SQLite automatically</span>
              </div>
            </div>
            <StudentSpreadsheet rows={rows} />
          </div>
        )}
      </main>

      {/* Add Drive Modal */}
      {showAddDrive && <AddDriveModal onClose={() => setShowAddDrive(false)} onAdd={handleAddDrive} />}

      {/* PO Chatbot */}
      <POChatWidget drives={drives} />
    </div>
  )
}
