import { useState } from 'react'
import { supabase } from './supabase'
import { friendly } from './errors'
import { useCached } from './cache'

// Letters and digits that cannot be confused with each other (no O/0, l/1/I)
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
const makePassword = (len = 12) =>
  [...crypto.getRandomValues(new Uint8Array(len))].map(b => ALPHABET[b % ALPHABET.length]).join('')
const ROLE = { owner: 'Owner', admin: 'Admin', staff: 'Staff' }

export default function Team({ org }) {
  const isOwner = org.role === 'owner'
  const { data, error: loadErr, refresh } = useCached(`${org.id}:team`, async () => {
    const { data, error } = await supabase.rpc('list_team', { p_org: org.id })
    if (error) throw error
    return data
  })
  const team = data ?? []
  const [f, setF] = useState({ name: '', email: '', role: 'staff', password: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState('')          // 'add' or the user id being changed
  const [created, setCreated] = useState(null)  // shown once, right after an account is made
  const [copied, setCopied] = useState(false)
  const set = k => e => setF({ ...f, [k]: e.target.value })

  async function add(e) {
    e.preventDefault()
    if (busy) return
    setErr(''); setCreated(null); setCopied(false); setBusy('add')
    const { data: res, error } = await supabase.functions.invoke('manage-team', {
      body: { org_id: org.id, email: f.email.trim(), full_name: f.name.trim(), role: f.role, password: f.password },
    })
    setBusy('')
    if (error || res?.error) return setErr(res?.error ? friendly(res.error) : friendly(error))
    setCreated({ name: f.name.trim(), email: f.email.trim(), password: f.password })
    setF({ name: '', email: '', role: 'staff', password: '' })
    refresh()
  }

  async function change(userId, fn) {
    if (busy) return
    setErr(''); setBusy(userId)
    const { error } = await fn()
    setBusy('')
    if (error) return setErr(friendly(error))
    refresh()
  }
  const setRole = (m, role) => change(m.user_id, () => supabase.rpc('team_set_role', { p_org: org.id, p_user: m.user_id, p_role: role }))
  const remove = m => {
    if (!window.confirm(`Remove ${m.full_name || m.email} from ${org.name}? They will lose access straight away.`)) return
    return change(m.user_id, () => supabase.rpc('team_remove', { p_org: org.id, p_user: m.user_id }))
  }

  const message = c => `Hello${c.name ? ' ' + c.name : ''}, your ${org.name} invoicing account is ready.\nLog in at ${window.location.origin}\nEmail: ${c.email}\nTemporary password: ${c.password}\nYou will be asked to choose your own password when you first log in.`
  async function copy() {
    try { await navigator.clipboard.writeText(message(created)); setCopied(true) }
    catch { setErr('Could not copy automatically. Select the message and copy it by hand.') }
  }

  // Owner may change anyone but the owner; an admin may only remove staff
  const canTouch = m => m.role !== 'owner' && (isOwner || m.role === 'staff')

  return (
    <section>
      <h2>Team</h2>
      <form className="card" onSubmit={add} style={{ marginBottom: '1.25rem' }}>
        <strong>Add a team member</strong>
        <p className="muted">You create their login here. They are asked to choose their own password the first time they sign in.</p>
        <div className="row">
          <label>Full name<input value={f.name} onChange={set('name')} /></label>
          <label>Email<input type="email" required value={f.email} onChange={set('email')} /></label>
          <label>Role
            <select value={f.role} onChange={set('role')}>
              <option value="staff">Staff</option>
              {isOwner && <option value="admin">Admin</option>}
            </select>
          </label>
        </div>
        <label>Temporary password
          <div className="row" style={{ alignItems: 'center' }}>
            <input required minLength={8} value={f.password} onChange={set('password')} autoComplete="off" />
            <button type="button" className="ghost" style={{ flex: '0 0 auto' }} onClick={() => setF({ ...f, password: makePassword() })}>Generate</button>
          </div>
        </label>
        <p className="muted">Staff can create clients and invoices, record payments and send documents. Admins can also manage staff and change company settings.</p>
        <button disabled={!!busy}>{busy === 'add' ? 'Creating…' : 'Create account'}</button>
      </form>

      {created && (
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <strong>Account created for {created.email}</strong>
          <p className="muted">Send them this message privately. The password is shown only now, so copy it before leaving this page.</p>
          <textarea readOnly rows="5" value={message(created)} onFocus={e => e.target.select()} />
          <div className="row" style={{ marginTop: '.75rem' }}>
            <button type="button" onClick={copy}>{copied ? 'Copied' : 'Copy message'}</button>
            <button type="button" className="ghost" onClick={() => setCreated(null)}>Done</button>
          </div>
        </div>
      )}

      {(err || loadErr) && <p className="note" role="alert">{err || loadErr}</p>}
      {data === undefined && !loadErr && <p className="muted">Loading…</p>}
      {team.length > 0 && (
        <table className="stack">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th></th></tr></thead>
          <tbody>{team.map(m => (
            <tr key={m.user_id}>
              <td data-label="Name"><strong>{m.full_name || '—'}</strong></td>
              <td data-label="Email">{m.email}</td>
              <td data-label="Role">{ROLE[m.role]}</td>
              <td className="actcell"><div className="actions">
                {canTouch(m) && isOwner && (
                  <button className="ghost" disabled={!!busy} onClick={() => setRole(m, m.role === 'admin' ? 'staff' : 'admin')}>
                    {busy === m.user_id ? 'Working…' : m.role === 'admin' ? 'Make staff' : 'Make admin'}
                  </button>
                )}
                {canTouch(m) && <button className="ghost" disabled={!!busy} onClick={() => remove(m)}>Remove</button>}
              </div></td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </section>
  )
}
