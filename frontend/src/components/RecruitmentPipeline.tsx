import { useState, useEffect } from 'react'

interface Drive {
  id: string
  company: string
  logo: string
  logoColor: string
  date: string
  role: string
  status: string
  eligible: number
  applied: number
  offers: number
  package: string
  minCgpa?: string
  branches?: string
}

interface StudentRow {
  id: string
  studentId: string
  name: string
  branch: string
  batch: string
  cgpa: string
  companies: string // In this DB schema, "companies" column is the company name for this application row
  stage: string
  offerLetter: 'Issued' | 'Pending' | 'N/A'
  package: string
  email: string
  phone: string
}

interface RecruitmentPipelineProps {
  drives: Drive[]
  rows: StudentRow[]
  onRefresh?: () => void
}

const STAGES = ['Applied', 'Shortlisted', 'Interviewed', 'Selected', 'Rejected'] as const
type StageType = typeof STAGES[number]

const stageStyles: Record<StageType, { bg: string; border: string; text: string; badgeBg: string }> = {
  Applied: {
    bg: 'bg-blue-50/50',
    border: 'border-blue-200',
    text: 'text-blue-700',
    badgeBg: 'bg-blue-100 text-blue-800'
  },
  Shortlisted: {
    bg: 'bg-orange-50/50',
    border: 'border-orange-200',
    text: 'text-orange-700',
    badgeBg: 'bg-orange-100 text-orange-800'
  },
  Interviewed: {
    bg: 'bg-purple-50/50',
    border: 'border-purple-200',
    text: 'text-purple-700',
    badgeBg: 'bg-purple-100 text-purple-800'
  },
  Selected: {
    bg: 'bg-emerald-50/50',
    border: 'border-emerald-200',
    text: 'text-emerald-700',
    badgeBg: 'bg-emerald-100 text-emerald-800'
  },
  Rejected: {
    bg: 'bg-rose-50/50',
    border: 'border-rose-200',
    text: 'text-rose-700',
    badgeBg: 'bg-rose-100 text-rose-800'
  }
}

const denormalizeStage = (stage: string): string => {
  const s = stage.trim()
  if (s === 'Selected') return 'offered'
  if (s === 'Shortlisted') return 'shortlisted'
  if (s === 'Interviewed') return 'interview'
  if (s === 'Applied') return 'applied'
  if (s === 'Rejected') return 'rejected'
  return 'Not Applied'
}

export default function RecruitmentPipeline({ drives, rows, onRefresh }: RecruitmentPipelineProps) {
  const [selectedCompany, setSelectedCompany] = useState<string>('')

  // Sync selectedCompany when drives are loaded
  useEffect(() => {
    if (drives.length > 0 && !selectedCompany) {
      setSelectedCompany(drives[0].company)
    }
  }, [drives, selectedCompany])

  const [searchQuery, setSearchQuery] = useState('')
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  // Filter applications by selected company drive and search query
  const driveApplications = rows.filter(
    r => r.companies === selectedCompany && r.stage !== 'Not Applied'
  )

  const filteredApplications = driveApplications.filter(r =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.studentId.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleStageChange = async (student: StudentRow, newStage: StageType) => {
    setUpdatingId(student.id)
    try {
      const drive = drives.find(d => d.company === selectedCompany)
      const isSelected = newStage === 'Selected'
      
      const payload = {
        stage: denormalizeStage(newStage),
        offerLetter: isSelected ? 'Issued' : (['Shortlisted', 'Interviewed'].includes(newStage) ? 'Pending' : 'N/A'),
        package: isSelected && drive ? drive.package : ''
      }

      const res = await fetch(`http://localhost:8000/api/applications/${student.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (res.ok) {
        if (onRefresh) onRefresh()
      } else {
        console.error('Failed to update student stage')
      }
    } catch (e) {
      console.error('Error transitioning student:', e)
    } finally {
      setUpdatingId(null)
    }
  }

  const selectedDrive = drives.find(d => d.company === selectedCompany)

  return (
    <div className="space-y-6">
      {/* Filters and Drive Info Header */}
      <div className="bg-white rounded-md border border-[#E2E8F0] p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-[10px] font-700 text-[#64748B] uppercase tracking-wider mb-1">Select Drive</label>
            <select
              value={selectedCompany}
              onChange={e => setSelectedCompany(e.target.value)}
              className="text-sm border border-[#E2E8F0] rounded px-3 py-1.5 bg-[#F8F9FC] text-[#0F172A] outline-none font-600 focus:border-[#4F46E5] transition-colors"
            >
              {drives.length === 0 && <option value="">No drives available</option>}
              {drives.map(d => (
                <option key={d.id} value={d.company}>
                  {d.company} — {d.role}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-700 text-[#64748B] uppercase tracking-wider mb-1">Search Candidates</label>
            <input
              type="text"
              placeholder="Search by name/ID..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="text-sm border border-[#E2E8F0] rounded px-3 py-1.5 bg-[#F8F9FC] text-[#0F172A] placeholder-[#94A3B8] outline-none focus:border-[#4F46E5] transition-colors w-48 sm:w-60"
            />
          </div>
        </div>

        {selectedDrive && (
          <div className="flex items-center gap-3.5 border-t md:border-t-0 md:border-l border-[#E2E8F0] pt-4 md:pt-0 md:pl-5">
            <div
              className="w-10 h-10 rounded flex items-center justify-center text-white text-sm font-800 shadow-sm flex-shrink-0"
              style={{ background: selectedDrive.logoColor }}
            >
              {selectedDrive.logo}
            </div>
            <div>
              <h4 className="text-sm font-700 text-[#0F172A]">{selectedDrive.company} Recruitment</h4>
              <p className="text-xs text-[#64748B] mt-0.5">
                Role: <span className="font-600 text-[#334155]">{selectedDrive.role}</span> · Package: <span className="font-700 text-emerald-600">{selectedDrive.package}</span>
              </p>
              {selectedDrive.minCgpa && (
                <p className="text-[10px] text-[#94A3B8] mt-0.5">
                  Cutoff: <span className="mono font-600">{selectedDrive.minCgpa} CGPA</span> · Branches: <span className="font-500">{selectedDrive.branches || 'All'}</span>
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Kanban Pipeline Columns */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-start">
        {STAGES.map(stage => {
          const stageApps = filteredApplications.filter(a => a.stage === stage)
          const style = stageStyles[stage]

          return (
            <div
              key={stage}
              className={`rounded-lg border ${style.border} ${style.bg} p-4 flex flex-col gap-3 min-h-[480px] shadow-xs`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-2 border-b border-dashed border-[#CBD5E1]">
                <h3 className={`text-xs font-700 uppercase tracking-widest ${style.text}`}>
                  {stage}
                </h3>
                <span className={`text-[10px] font-700 px-2 py-0.5 rounded-full ${style.badgeBg} mono`}>
                  {stageApps.length}
                </span>
              </div>

              {/* Cards Container */}
              <div className="flex flex-col gap-2.5 overflow-y-auto max-h-[500px] pr-0.5">
                {stageApps.map(student => (
                  <div
                    key={student.id}
                    className={`bg-white rounded-md border border-[#E2E8F0] p-3.5 shadow-xs hover:shadow-md transition-all duration-200 relative group ${
                      updatingId === student.id ? 'opacity-50 pointer-events-none' : ''
                    }`}
                  >
                    {/* Confetti dot or selection badge */}
                    {stage === 'Selected' && (
                      <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    )}

                    <div className="space-y-2">
                      <div>
                        <h4 className="text-xs font-700 text-[#0F172A] truncate">{student.name}</h4>
                        <p className="mono text-[9px] text-[#94A3B8] mt-0.5">
                          {student.studentId} · {student.branch}
                        </p>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="mono text-[10px] text-[#64748B] font-600 bg-slate-50 border border-slate-100 rounded px-1.5 py-0.5">
                          {student.cgpa} CGPA
                        </span>
                        
                        {student.package && (
                          <span className="mono text-[10px] text-emerald-700 font-700 bg-emerald-50 rounded px-1.5 py-0.5">
                            {student.package}
                          </span>
                        )}
                      </div>

                      {/* Transition Action Selector */}
                      <div className="pt-2 border-t border-[#F1F5F9] flex items-center justify-between gap-2">
                        <span className="text-[9px] font-600 text-[#94A3B8] uppercase">Move to</span>
                        <select
                          value={stage}
                          onChange={e => handleStageChange(student, e.target.value as StageType)}
                          className="text-[10px] border border-[#E2E8F0] rounded px-1.5 py-1 bg-white text-[#334155] outline-none font-500 focus:border-[#4F46E5] cursor-pointer"
                        >
                          {STAGES.map(s => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}

                {stageApps.length === 0 && (
                  <div className="text-center py-10 text-slate-400 text-xs italic border border-dashed border-slate-200 rounded">
                    No candidates
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
