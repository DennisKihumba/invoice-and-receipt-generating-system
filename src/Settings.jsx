import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export default function Settings({ org, onSaved }) {
  const [f, setF] = useState(null)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    supabase.from('organizations').select('*').eq('id', org.id).single()
      .then(({ data, error }) => (error ? setErr(error.message) : setF(data)))
  }, [org.id])

  if (!f) return <p className="muted">{err || 'Loading…'}</p>
  const set = k => e => setF({ ...f, [k]: e.target.value })

  async function save(e) {
    e.preventDefault(); setBusy(true); setErr(''); setMsg('')
    const { error } = await supabase.from('organizations').update({
      name: f.name, address: f.address || null, phone: f.phone || null, email: f.email || null,
      kra_pin: f.kra_pin || null, vat_rate: Number(f.vat_rate),
      invoice_prefix: f.invoice_prefix.trim().toUpperCase(), receipt_prefix: f.receipt_prefix.trim().toUpperCase(),
      payment_instructions: f.payment_instructions || null,
    }).eq('id', org.id)
    setBusy(false)
    if (error) return setErr(error.message)
    setMsg('Saved.'); onSaved()
  }

  async function upload(e) {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    if (!['image/png', 'image/jpeg'].includes(file.type)) return setErr('Use a PNG or JPG logo.')
    if (file.size > 2 * 1024 * 1024) return setErr('The logo must be under 2 MB.')
    setBusy(true); setErr(''); setMsg('')
    const path = `${org.id}/logo.${file.type === 'image/png' ? 'png' : 'jpg'}`
    const up = await supabase.storage.from('logos').upload(path, file, { upsert: true, contentType: file.type })
    if (up.error) { setBusy(false); return setErr(up.error.message) }
    const url = supabase.storage.from('logos').getPublicUrl(path).data.publicUrl + `?v=${Date.now()}`
    const { error } = await supabase.from('organizations').update({ logo_url: url }).eq('id', org.id)
    setBusy(false)
    if (error) return setErr(error.message)
    setF({ ...f, logo_url: url }); setMsg('Logo updated.'); onSaved()
  }

  async function removeLogo() {
    const { error } = await supabase.from('organizations').update({ logo_url: null }).eq('id', org.id)
    if (error) return setErr(error.message)
    setF({ ...f, logo_url: null }); onSaved()
  }

  return (
    <section>
      <h2>Company settings</h2>
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div className="row" style={{ alignItems: 'center' }}>
          {f.logo_url
            ? <img src={f.logo_url} alt="Your logo" style={{ flex: '0 0 auto', width: 72, height: 72, objectFit: 'contain' }} />
            : <p className="muted" style={{ flex: '1 1 12rem', margin: 0 }}>No logo yet. Your initials appear on documents until you add one.</p>}
          <label style={{ flex: '1 1 14rem', margin: 0 }}>Logo (PNG or JPG, under 2 MB)
            <input type="file" accept="image/png,image/jpeg" onChange={upload} disabled={busy} />
          </label>
          {f.logo_url && <button type="button" className="ghost" style={{ flex: '0 0 auto' }} onClick={removeLogo}>Remove logo</button>}
        </div>
      </div>

      <form className="card" onSubmit={save}>
        <label>Company name<input required value={f.name} onChange={set('name')} /></label>
        <label>Address<input value={f.address ?? ''} onChange={set('address')} placeholder="Street, town" /></label>
        <div className="row">
          <label>Phone<input value={f.phone ?? ''} onChange={set('phone')} /></label>
          <label>Email<input type="email" value={f.email ?? ''} onChange={set('email')} /></label>
          <label>KRA PIN<input value={f.kra_pin ?? ''} onChange={set('kra_pin')} /></label>
        </div>
        <div className="row">
          <label>VAT rate (%)<input type="number" min="0" max="100" step="0.01" required value={f.vat_rate} onChange={set('vat_rate')} /></label>
          <label>Invoice prefix<input required value={f.invoice_prefix} onChange={set('invoice_prefix')} /></label>
          <label>Receipt prefix<input required value={f.receipt_prefix} onChange={set('receipt_prefix')} /></label>
        </div>
        <p className="muted">Prefix and VAT changes apply to new documents only. Existing numbers stay as they are.</p>
        <label>How clients should pay
          <textarea rows="4" value={f.payment_instructions ?? ''} onChange={set('payment_instructions')}
                    placeholder="e.g. M-Pesa Paybill 123456, account = invoice number" />
        </label>
        {err && <p className="note">{err}</p>}
        {msg && <p className="muted">{msg}</p>}
        <button disabled={busy}>Save changes</button>
      </form>
    </section>
  )
}