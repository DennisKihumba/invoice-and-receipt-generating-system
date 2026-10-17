import { useState } from 'react'
import { supabase } from './supabase'
import { friendly } from './errors'

// Shown after someone opens the reset link from their email.
export default function ResetPassword({ onDone, first }) {
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault(); setMsg('')
    if (pw.length < 8) return setMsg('Use at least 8 characters.')
    if (pw !== pw2) return setMsg('The two passwords do not match.')
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password: pw, data: { must_change_password: false } })
    setBusy(false)
    if (error) return setMsg(friendly(error))
    window.history.replaceState(null, '', window.location.pathname)
    onDone()
  }

  return (
    <div className="card narrow">
      <h1>{first ? 'Choose your own password' : 'Set a new password'}</h1>
      <p className="muted">{first ? 'Your account was created with a temporary password. Choose one that only you know to continue.' : 'Choose a password you have not used before. You will be logged in straight after.'}</p>
      <form onSubmit={submit}>
        <label>New password<input type="password" required minLength={8} autoComplete="new-password" value={pw} onChange={e => setPw(e.target.value)} /></label>
        <label>Confirm new password<input type="password" required minLength={8} autoComplete="new-password" value={pw2} onChange={e => setPw2(e.target.value)} /></label>
        {msg && <p className="note" role="alert">{msg}</p>}
        <button disabled={busy}>{busy ? 'Saving…' : 'Save new password'}</button>
      </form>
    </div>
  )
}
