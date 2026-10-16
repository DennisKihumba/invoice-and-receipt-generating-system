import { useState } from 'react'
import { supabase } from './supabase'

export default function Auth() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setMsg('')
    const fn = mode === 'login' ? supabase.auth.signInWithPassword : supabase.auth.signUp
    const { data, error } = await fn.call(supabase.auth, { email, password })
    if (error) setMsg(error.message)
    else if (mode === 'signup' && !data.session) setMsg('Check your email to confirm your account, then log in.')
    setBusy(false)
  }

  return (
    <div className="card narrow">
      <h1>{mode === 'login' ? 'Log in' : 'Create your account'}</h1>
      <form onSubmit={submit}>
        <label>Email<input type="email" required value={email} onChange={e => setEmail(e.target.value)} /></label>
        <label>Password<input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} /></label>
        {msg && <p className="note">{msg}</p>}
        <button disabled={busy}>{mode === 'login' ? 'Log in' : 'Create account'}</button>
      </form>
      <p className="muted">
        {mode === 'login' ? 'New here?' : 'Already have an account?'}{' '}
        <a href="#" onClick={e => { e.preventDefault(); setMode(mode === 'login' ? 'signup' : 'login'); setMsg('') }}>
          {mode === 'login' ? 'Create an account' : 'Log in'}
        </a>
      </p>
    </div>
  )
}
