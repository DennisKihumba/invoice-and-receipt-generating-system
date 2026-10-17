import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'
import { downloadInvoice, whatsappInvoice, emailInvoice } from './pdf'

const money = n => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(n ?? 0)
const today = () => new Date().toISOString().slice(0, 10)
const blank = () => ({ description: '', quantity: 1, unit_price: '' })
const label = { draft: 'Draft', sent: 'Sent', partial: 'Partly paid', paid: 'Paid', void: 'Void' }

export default function Invoices({ org }) {
  const [view, setView] = useState('list')
  const [invoices, setInvoices] = useState([])
  const [clients, setClients] = useState([])
  const [err, setErr] = useState('')
  const [notice, setNotice] = useState('')
  const [working, setWorking] = useState('')   // which row action is running, e.g. "<id>:email"

  const load = useCallback(async () => {
    const [inv, cl] = await Promise.all([
      supabase.from('invoices')
        .select('id, number, status, issue_date, due_date, total, amount_paid, clients(name, phone)')
        .eq('org_id', org.id).order('created_at', { ascending: false }),
      supabase.from('clients').select('id, name').eq('org_id', org.id).order('name'),
    ])
    if (inv.error || cl.error) return setErr((inv.error || cl.error).message)
    setInvoices(inv.data); setClients(cl.data)
  }, [org.id])

  useEffect(() => { load() }, [load])

  async function markSent(id) {
    const { error } = await supabase.from('invoices').update({ status: 'sent' }).eq('id', id)
    if (error) setErr(error.message); else load()
  }

  const run = (key, fn, text) => {
    if (working) return
    setErr(''); setNotice(text); setWorking(key)
    return fn()
      .then(r => { setNotice(typeof r === 'string' ? r : ''); return load() })
      .catch(e => { setNotice(''); setErr(e.message) })
      .finally(() => setWorking(''))
  }

  if (view === 'new')
    return <Builder org={org} clients={clients} onCancel={() => setView('list')}
                    onDone={() => { setView('list'); load() }} />

  return (
    <section>
      <div className="row" style={{ alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0 }}>Invoices</h2>
        <button style={{ flex: '0 0 auto', marginLeft: 'auto' }} onClick={() => setView('new')}
                disabled={clients.length === 0}>New invoice</button>
      </div>
      {clients.length === 0 && <p className="muted">Add a client first, then you can create an invoice.</p>}
      {err && <p className="note">{err}</p>}
      {notice && <p className="status" role="status">{working && <span className="spin" />}{notice}</p>}
      {invoices.length > 0 && (
        <table className="stack">
          <thead><tr><th>Number</th><th>Client</th><th>Issued</th><th>Status</th><th>Total</th><th>Paid</th><th></th></tr></thead>
          <tbody>{invoices.map(i => {
            const on = a => working === i.id + ':' + a
            return (
              <tr key={i.id}>
                <td data-label="Invoice"><strong>{i.number}</strong></td>
                <td data-label="Client">{i.clients?.name}</td>
                <td data-label="Issued">{i.issue_date}</td>
                <td data-label="Status">{label[i.status]}</td>
                <td data-label="Total">{money(i.total)}</td>
                <td data-label="Paid">{money(i.amount_paid)}</td>
                <td className="actcell"><div className="actions">
                  <button className="ghost" disabled={!!working} onClick={() => run(i.id + ':pdf', () => downloadInvoice(org, i.id), 'Preparing the PDF…')}>{on('pdf') ? 'Preparing…' : 'PDF'}</button>
                  <button className="ghost" disabled={!!working} onClick={() => run(i.id + ':wa', () => whatsappInvoice(org, i.id), 'Preparing the invoice for WhatsApp…')}>{on('wa') ? 'Opening…' : 'WhatsApp'}</button>
                  <button className="ghost" disabled={!!working} onClick={() => run(i.id + ':email', () => emailInvoice(org, i.id), 'Sending the invoice by email. Please wait…')}>{on('email') ? 'Sending…' : 'Email'}</button>
                  {i.status === 'draft' && <button className="ghost" disabled={!!working} onClick={() => run(i.id + ':sent', async () => { const { error } = await supabase.from('invoices').update({ status: 'sent' }).eq('id', i.id); if (error) throw error }, 'Updating…')}>{on('sent') ? 'Updating…' : 'Mark as sent'}</button>}
                </div></td>
              </tr>
            )
          })}</tbody>
        </table>
      )}
    </section>
  )
}

function Builder({ org, clients, onDone, onCancel }) {
  const [clientId, setClientId] = useState(clients[0]?.id ?? '')
  const [issue, setIssue] = useState(today())
  const [due, setDue] = useState('')
  const [vat, setVat] = useState(true)
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState([blank()])
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const setItem = (i, k, v) => setItems(items.map((it, j) => (j === i ? { ...it, [k]: v } : it)))
  const lines = items.filter(it => it.description.trim() && it.unit_price !== '' && Number(it.unit_price) >= 0 && Number(it.quantity) > 0)
  const subtotal = lines.reduce((s, it) => s + Math.round(Number(it.quantity) * Number(it.unit_price) * 100) / 100, 0)
  const tax = vat ? Math.round(subtotal * Number(org.vat_rate ?? 16)) / 100 : 0

  async function save(e) {
    e.preventDefault()
    if (!lines.length) return setErr('Add at least one line with a description and a price.')
    setBusy(true); setErr('')
    const { data: inv, error } = await supabase.from('invoices')
      .insert({ org_id: org.id, client_id: clientId, issue_date: issue, due_date: due || null, apply_vat: vat, notes: notes || null })
      .select('id').single()
    if (error) { setErr(error.message); setBusy(false); return }
    const { error: e2 } = await supabase.from('invoice_items').insert(
      lines.map((it, i) => ({
        org_id: org.id, invoice_id: inv.id, description: it.description.trim(),
        quantity: Number(it.quantity), unit_price: Number(it.unit_price), position: i,
      })))
    if (e2) { await supabase.from('invoices').delete().eq('id', inv.id); setErr(e2.message); setBusy(false); return }
    onDone()
  }

  return (
    <form className="card" onSubmit={save}>
      <h2>New invoice</h2>
      <div className="row">
        <label>Client
          <select value={clientId} onChange={e => setClientId(e.target.value)}>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label>Issue date<input type="date" required value={issue} onChange={e => setIssue(e.target.value)} /></label>
        <label>Due date<input type="date" value={due} onChange={e => setDue(e.target.value)} /></label>
      </div>

      {items.map((it, i) => (
        <div className="row add" key={i}>
          <input style={{ flex: '4 1 14rem' }} placeholder="Description (e.g. Website design)" value={it.description}
                 onChange={e => setItem(i, 'description', e.target.value)} />
          <input type="number" min="0.01" step="0.01" placeholder="Qty" value={it.quantity}
                 onChange={e => setItem(i, 'quantity', e.target.value)} />
          <input type="number" min="0" step="0.01" placeholder="Unit price" value={it.unit_price}
                 onChange={e => setItem(i, 'unit_price', e.target.value)} />
          <button type="button" className="ghost" style={{ flex: '0 0 auto' }}
                  onClick={() => setItems(items.length > 1 ? items.filter((_, j) => j !== i) : [blank()])}>Remove</button>
        </div>
      ))}
      <button type="button" className="ghost" onClick={() => setItems([...items, blank()])}>Add line</button>

      <label style={{ marginTop: '1.25rem' }}>
        <input type="checkbox" style={{ display: 'inline', width: 'auto', marginRight: '.5rem' }}
               checked={vat} onChange={e => setVat(e.target.checked)} />
        Add VAT ({org.vat_rate ?? 16}%)
      </label>
      <label>Notes<input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Payment terms, project reference…" /></label>

      <div style={{ textAlign: 'right', margin: '1rem 0' }}>
        <div className="muted">Subtotal {money(subtotal)}</div>
        <div className="muted">VAT {money(tax)}</div>
        <strong>Total {money(subtotal + tax)}</strong>
      </div>
      {err && <p className="note">{err}</p>}
      <div className="row">
        <button disabled={busy}>Save as draft</button>
        <button type="button" className="ghost" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}