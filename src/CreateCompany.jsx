import { useState } from 'react'
import { supabase } from './supabase'

export default function CreateCompany({ onCreated }) {
  const [f, setF] = useState({ name: '', inv: 'INV', rct: 'RCT', phone: '', email: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const set = k => e => setF({ ...f, [k]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setErr('')
    const { error } = await supabase.rpc('create_organization', {
      p_name: f.name,
      p_invoice_prefix: f.inv,
      p_receipt_prefix: f.rct,
      p_phone: f.phone || null,
      p_email: f.email || null,
    })
    if (error) { setErr(error.message); setBusy(false) } else onCreated()
  }

  return (
    <div className="card narrow">
      <h1>Set up your company</h1>
      <p className="muted">This appears on your invoices and receipts. You can add a logo later.</p>
      <form onSubmit={submit}>
        <label>Company name<input required value={f.name} onChange={set('name')} placeholder="Cancelo IT Services" /></label>
        <div className="row">
          <label>Invoice prefix<input required value={f.inv} onChange={set('inv')} placeholder="CIS-INV" /></label>
          <label>Receipt prefix<input required value={f.rct} onChange={set('rct')} placeholder="CIS-RCT" /></label>
        </div>
        <label>Phone<input value={f.phone} onChange={set('phone')} /></label>
        <label>Email<input type="email" value={f.email} onChange={set('email')} /></label>
        {err && <p className="note">{err}</p>}
        <button disabled={busy}>Create company</button>
      </form>
    </div>
  )
}
