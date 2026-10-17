import { useEffect, useState } from 'react'
import { supabase } from './supabase'

// Slows down password guessing from this browser: after 5 failed attempts the form locks for
// 30 seconds, then 1, 2, 4 minutes... up to 15. It is only a first brake, because anyone can
// clear their browser data. The real limit is enforced by Supabase on its servers.
const KEY = 'cis-login-guard'
const FREE_TRIES = 5
const lockSeconds = fails => Math.min(900, 30 * 2 ** (fails - FREE_TRIES))
const empty = { fails: 0, until: 0, last: 0 }
const readGuard = () => { try { return JSON.parse(localStorage.getItem(KEY)) ?? empty } catch { return empty } }
const writeGuard = g => { try { localStorage.setItem(KEY, JSON.stringify(g)) } catch { /* ignore */ } }
const clock = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

export default function Auth() {
  const [mode, setMode] = useState('login')            // 'login' | 'signup' | 'forgot'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [until, setUntil] = useState(() => readGuard().until)         // login lock
  const [resendAt, setResendAt] = useState(0)                         // reset-link cooldown
  const [now, setNow] = useState(Date.now())
  const remaining = Math.max(0, Math.ceil((until - now) / 1000))
  const wait = Math.max(0, Math.ceil((resendAt - now) / 1000))

  useEffect(() => {
    const end = Math.max(until, resendAt)
    if (end <= Date.now()) return
    const t = setInterval(() => { setNow(Date.now()); if (Date.now() >= end) clearInterval(t) }, 1000)
    return () => clearInterval(t)
  }, [until, resendAt])

  // An expired or already-used reset link comes back to us with an error in the address
  useEffect(() => {
    const h = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    if (!h.get('error')) return
    setMode('forgot')
    setMsg(h.get('error_code') === 'otp_expired'
      ? 'That reset link has expired or was already used. Request a new one below.'
      : (h.get('error_description') || 'That link did not work. Request a new one below.'))
    window.history.replaceState(null, '', window.location.pathname)
  }, [])

  function switchMode(m) { setMode(m); setMsg('') }

  async function sendReset(e) {
    e.preventDefault()
    if (wait > 0 || busy) return
    setBusy(true); setMsg('')
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin })
    setBusy(false)
    if (error && (error.status === 429 || /rate limit|too many|seconds/i.test(error.message))) {
      return setMsg('Please wait a minute before asking for another link.')
    }
    if (error && error.status >= 500) return setMsg('We could not send the email right now. Please try again later.')
    // Same answer whether or not the address has an account, so nobody can use this form to find out
    setResendAt(Date.now() + 60000); setNow(Date.now())
    setMsg('If that email has an account, a reset link is on its way. Check your inbox and spam folder.')
  }

  async function submit(e) {
    e.preventDefault()
    if (remaining > 0 || busy) return
    setBusy(true); setMsg('')
    const fn = mode === 'login' ? supabase.auth.signInWithPassword : supabase.auth.signUp
    const { data, error } = await fn.call(supabase.auth, { email: email.trim(), password })
    setBusy(false)

    if (!error) {
      writeGuard(empty)
      if (mode === 'signup' && !data.session) setMsg('Check your email to confirm your account, then log in.')
      return
    }
    if (error.status === 429 || /rate limit|too many/i.test(error.message)) {
      return setMsg('Too many attempts. Please wait a few minutes and try again.')
    }

    const g = readGuard()
    const stale = Date.now() - (g.last ?? 0) > 15 * 60 * 1000   // old failures are forgiven
    const fails = (stale ? 0 : g.fails) + 1
    const lock = fails >= FREE_TRIES ? lockSeconds(fails) : 0
    const next = { fails, last: Date.now(), until: lock ? Date.now() + lock * 1000 : 0 }
    writeGuard(next); setUntil(next.until); setNow(Date.now())

    const left = FREE_TRIES - fails
    const base = mode === 'login' ? 'Incorrect email or password.' : error.message
    setMsg(left > 0 && left <= 2 ? `${base} ${left} attempt${left === 1 ? '' : 's'} left before a short lock.` : base)
  }

  const forgot = mode === 'forgot'
  return (
    <div className="card narrow">
      <h1>{forgot ? 'Reset your password' : mode === 'login' ? 'Log in' : 'Create your account'}</h1>
      {forgot && <p className="muted">Enter your email and we will send you a link to choose a new password.</p>}
      <form onSubmit={forgot ? sendReset : submit}>
        <label>Email<input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
        {!forgot && (
          <label>Password
            <input type="password" required autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                   minLength={mode === 'signup' ? 8 : undefined} value={password} onChange={e => setPassword(e.target.value)} />
          </label>
        )}
        {mode === 'signup' && <p className="muted" style={{ marginTop: '-.5rem' }}>Use at least 8 characters.</p>}
        {mode === 'login' && (
          <p style={{ marginTop: '-.5rem' }}>
            <a href="#" onClick={e => { e.preventDefault(); switchMode('forgot') }}>Forgot your password?</a>
          </p>
        )}
        {msg && <p className={forgot && msg.startsWith('If that') ? 'muted' : 'note'} role="alert">{msg}</p>}
        {!forgot && remaining > 0 && <p className="note">Too many failed attempts. Please wait before trying again.</p>}
        {forgot ? (
          <button disabled={busy || wait > 0}>{wait > 0 ? `Send again in ${clock(wait)}` : busy ? 'Sending…' : 'Send reset link'}</button>
        ) : (
          <button disabled={busy || remaining > 0}>
            {remaining > 0 ? `Try again in ${clock(remaining)}` : mode === 'login' ? 'Log in' : 'Create account'}
          </button>
        )}
      </form>
      <p className="muted">
        {forgot ? (
          <a href="#" onClick={e => { e.preventDefault(); switchMode('login') }}>Back to log in</a>
        ) : (
          <>
            {mode === 'login' ? 'New here?' : 'Already have an account?'}{' '}
            <a href="#" onClick={e => { e.preventDefault(); switchMode(mode === 'login' ? 'signup' : 'login') }}>
              {mode === 'login' ? 'Create an account' : 'Log in'}
            </a>
          </>
        )}
      </p>
    </div>
  )
}
