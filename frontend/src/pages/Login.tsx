import { useState } from 'react'

type LoginRole = 'student' | 'officer'

interface LoginProps {
  onLogin: (role: LoginRole, id: string, name: string) => void
}

export default function Login({ onLogin }: LoginProps) {
  const [tab, setTab] = useState<LoginRole>('student')
  const [studentId, setStudentId] = useState('')
  const [officerId, setOfficerId] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (tab === 'student') {
      const idUpper = studentId.toUpperCase()
      if (!idUpper.trim()) { setError('Please enter your Student ID.'); return }
      if (!password.trim()) { setError('Please enter your password.'); return }
      if (password !== '1234') { setError('Incorrect password. (Hint: 1234)'); return }
      setLoading(true)
      
      fetch(`http://localhost:8000/api/applications?student_id=${idUpper}`)
        .then(res => res.json())
        .then(data => {
          const name = data && data.length > 0 ? data[0].name : `Student ${idUpper}`
          onLogin('student', idUpper, name)
        })
        .catch(() => {
          onLogin('student', idUpper, `Student ${idUpper}`)
        })
        .finally(() => setLoading(false))
    } else {
      if (!officerId.trim()) { setError('Please enter your Officer ID.'); return }
      if (!password.trim()) { setError('Please enter your password.'); return }
      if (password !== 'admin') { setError('Incorrect password. (Hint: admin)'); return }
      setLoading(true)
      setTimeout(() => {
        onLogin('officer', officerId.toUpperCase(), 'Dr. Priya Nair')
      }, 900)
    }
  }

  return (
    <div className="min-h-screen bg-[#F8F9FC] flex">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-[44%] bg-[#059669] p-10 relative overflow-hidden">
        {/* Grid lines decoration */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        {/* Floating orb */}
        <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full bg-emerald-400 opacity-20 blur-3xl" />
        <div className="absolute top-20 right-0 w-48 h-48 rounded-full bg-teal-300 opacity-20 blur-2xl" />

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-white/20 flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" />
            </svg>
          </div>
          <span className="text-white font-700 text-lg">PlaceTrack</span>

        </div>

        {/* Center content */}
        <div className="relative space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-white/80 text-xs font-500">Placement Season 2026 is Live</span>
          </div>
          <h1 className="text-4xl font-800 text-white leading-tight">
            Your career<br />starts here.
          </h1>
          <p className="text-emerald-100 text-sm leading-relaxed max-w-xs">
            Track applications, get AI-powered insights, and land your dream offer — all in one unified placement portal.
          </p>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 pt-2">
            {[
              { val: '240+', label: 'Students' },
              { val: '48', label: 'Drives' },
              { val: '₹45L', label: 'Highest CTC' },
            ].map(s => (
              <div key={s.label} className="bg-white/10 rounded-md p-3">
                <p className="text-white text-xl font-800">{s.val}</p>
                <p className="text-emerald-100 text-xs mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom testimonial */}
        <div className="relative bg-white/10 rounded-md p-4">
          <p className="text-white/90 text-sm italic leading-relaxed">
            "PlaceTrack helped me manage 12 applications simultaneously and land my Google offer with confidence."
          </p>
          <div className="flex items-center gap-2 mt-3">
            <div className="w-7 h-7 rounded-full bg-emerald-300 flex items-center justify-center text-emerald-900 text-xs font-700">RS</div>
            <div>
              <p className="text-white text-xs font-600">Riya Singh</p>
              <p className="text-emerald-200 text-[10px]">SWE @ Google · CSE 2025</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel – form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="w-8 h-8 rounded bg-[#059669] flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" />
              </svg>
            </div>
            <span className="font-700 text-[#0F172A]">PlaceTrack</span>
          </div>

          <div className="mb-7">
            <h2 className="text-2xl font-800 text-[#0F172A]">Sign in to your portal</h2>
            <p className="text-sm text-[#64748B] mt-1.5">Anna University · Placement Cell 2026</p>
          </div>

          {/* Tab switcher */}
          <div className="flex bg-[#F1F5F9] p-1 rounded gap-1 mb-7">
            <button
              onClick={() => { setTab('student'); setError(''); setPassword('') }}
              className="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-600 rounded transition-all duration-150"
              style={tab === 'student'
                ? { background: 'white', color: '#0F172A', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }
                : { color: '#64748B' }
              }
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
              </svg>
              Student Login
            </button>
            <button
              onClick={() => { setTab('officer'); setError(''); setPassword('') }}
              className="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-600 rounded transition-all duration-150"
              style={tab === 'officer'
                ? { background: 'white', color: '#0F172A', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }
                : { color: '#64748B' }
              }
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" />
              </svg>
              Officer Login
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* ID field */}
            {tab === 'student' ? (
              <div>
                <label className="block text-xs font-600 text-[#374151] mb-1.5 uppercase tracking-wide">Student ID</label>
                <input
                  type="text"
                  value={studentId}
                  onChange={e => setStudentId(e.target.value)}
                  placeholder="e.g. STU_101"
                  className="w-full px-3.5 py-2.5 text-sm border border-[#E2E8F0] rounded bg-white outline-none focus:border-[#059669] focus:ring-2 focus:ring-[#059669]/15 transition-all placeholder-[#94A3B8] font-mono"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-600 text-[#374151] mb-1.5 uppercase tracking-wide">Officer ID</label>
                <input
                  type="text"
                  value={officerId}
                  onChange={e => setOfficerId(e.target.value)}
                  placeholder="e.g. PO_001"
                  className="w-full px-3.5 py-2.5 text-sm border border-[#E2E8F0] rounded bg-white outline-none focus:border-[#059669] focus:ring-2 focus:ring-[#059669]/15 transition-all placeholder-[#94A3B8] font-mono"
                />
              </div>
            )}

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-600 text-[#374151] uppercase tracking-wide">Password</label>
                <button type="button" className="text-[11px] text-[#059669] hover:underline font-500">Forgot password?</button>
              </div>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={tab === 'student' ? 'Enter password (hint: 1234)' : 'Enter password (hint: admin)'}
                  className="w-full px-3.5 py-2.5 pr-10 text-sm border border-[#E2E8F0] rounded bg-white outline-none focus:border-[#059669] focus:ring-2 focus:ring-[#059669]/15 transition-all placeholder-[#94A3B8]"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#64748B] transition-colors"
                >
                  {showPass ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                  )}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="flex-shrink-0">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded text-sm font-600 text-white transition-all duration-150 flex items-center justify-center gap-2 mt-1"
              style={{ background: loading ? '#34D399' : '#059669' }}
            >
              {loading ? (
                <>
                  <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  Signing in…
                </>
              ) : (
                <>
                  {tab === 'student' ? 'Sign in as Student' : 'Sign in as Placement Officer'}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
                </>
              )}
            </button>
          </form>

          {/* Credentials hint */}
          <div className="mt-5 p-3.5 bg-[#F8F9FC] border border-[#E2E8F0] rounded">
            <p className="mono text-[11px] text-[#64748B] font-500 mb-1.5">Demo Credentials</p>
            <div className="space-y-1">
              <p className="mono text-[11px] text-[#94A3B8]">Student → ID: <span className="text-[#4F46E5]">STU_101</span>  ·  Pass: <span className="text-[#4F46E5]">1234</span></p>
              <p className="mono text-[11px] text-[#94A3B8]">Officer → ID: <span className="text-[#4F46E5]">PO_001</span>  ·  Pass: <span className="text-[#4F46E5]">admin</span></p>
            </div>
          </div>

          <p className="text-[11px] text-[#94A3B8] text-center mt-6">
            Secured by Placement Cell · Anna University © 2026
          </p>
        </div>
      </div>
    </div>
  )
}
