import { useState } from 'react'
import { supabase } from './supabase'
import { useCached } from './cache'
import { friendly } from './errors'
import { billingState, when } from './subscription'

const STATUS = org => {
  const b = billingState(org)
  if (b.status === 'exempt') return 'Exempt'
  if (b.status === 'locked') return b.reason === 'new' ? 'Locked: not paid yet' : 'Locked: expired'
  return b.status === 'warning' ? 'Ends within a day' : 'Active'
}

// Only the platform owner sees this screen: confirm a payment, then extend the company in one click
export default function Billing() {
  const { data, error: loadErr, refresh } = useCached('platform:orgs', async () => {
    const { data, error } = await supabase.rpc('platform_list_orgs')
    if (error) throw error
    return data
  })
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const orgs = data ?? []

  async function act(id, call, done) {
    if (busy) return
    setErr(''); setMsg(''); setBusy(id)
    const { data: res, error } = await call()
    setBusy('')
    if (error) return setErr(friendly(error))
    setMsg(done(res)); setNote(''); refresh()
  }
  const extend = (o, months) => act(o.id, () => supabase.rpc('platform_extend', { p_org: o.id, p_months: months, p_note: note.trim() || null }),
    res => `${o.name} is active until ${when(res)}.`)
  const exempt = o => {
    if (!window.confirm(o.plan_exempt ? `Start charging ${o.name} again?` : `Stop charging ${o.name}? They will never be locked.`)) return
    return act(o.id, () => supabase.rpc('platform_set_exempt', { p_org: o.id, p_exempt: !o.plan_exempt }),
      () => o.plan_exempt ? `${o.name} will be charged again.` : `${o.name} is now exempt.`)
  }

  return (
    <section>
      <div className="row" style={{ alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0 }}>Billing</h2>
        <button className="ghost" style={{ flex: '0 0 auto', marginLeft: 'auto' }} onClick={refresh}>Refresh</button>
      </div>
      <label>M-Pesa code or note for the next change (kept in the billing log)
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. QJ82K4L9TA" />
      </label>
      {(err || loadErr) && <p className="note" role="alert">{err || loadErr}</p>}
      {msg && <p className="status" role="status">{msg}</p>}
      {data === undefined && !loadErr && <p className="muted">Loading…</p>}
      {orgs.length > 0 && (
        <table className="stack">
          <thead><tr><th>Company</th><th>Owner</th><th>Status</th><th>Paid until</th><th></th></tr></thead>
          <tbody>{orgs.map(o => (
            <tr key={o.id}>
              <td data-label="Company"><strong>{o.name}</strong></td>
              <td data-label="Owner">{o.owner_email}</td>
              <td data-label="Status" className={billingState(o).status === 'locked' ? 'warn-text' : undefined}>{STATUS(o)}</td>
              <td data-label="Paid until">{o.plan_exempt ? '—' : o.paid_until ? when(o.paid_until) : 'Never'}</td>
              <td className="actcell"><div className="actions">
                <button className="ghost" disabled={!!busy} onClick={() => extend(o, 1)}>{busy === o.id ? 'Working…' : '+1 month'}</button>
                <button className="ghost" disabled={!!busy} onClick={() => extend(o, 12)}>+12 months</button>
                <button className="ghost" disabled={!!busy} onClick={() => exempt(o)}>{o.plan_exempt ? 'Charge' : 'Exempt'}</button>
              </div></td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </section>
  )
}
