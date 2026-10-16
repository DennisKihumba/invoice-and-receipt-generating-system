import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'
import { downloadReceipt, whatsappReceipt, emailReceipt } from './pdf'

const money = n => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(n ?? 0)
const today = () => new Date().toISOString().slice(0, 10)
const methods = { mpesa: 'M-Pesa', bank: 'Bank transfer', cash: 'Cash', card: 'Card', other: 'Other' }

export default function Payments({ org }) {
  const [open, setOpen] = useState([])        // invoices that can still be paid
  const [receipts, setReceipts] = useState([])
  const [invoiceId, setInvoiceId] = useState('')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('mpesa')
  const [reference, setReference] = useState('')
  const [date, setDate] = useState(today())
  const [err, setErr] = useState('')
  const [notice, setNotice] = useState('')
  const [emailIt, setEmailIt] = useState(true)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const [inv, rec] = await Promise.all([
      supabase.from('invoices')
        .select('id, number, total, amount_paid, clients(name)')
        .eq('org_id', org.id).in('status', ['sent', 'partial']).order('created_at', { ascending: false }),
      supabase.from('receipts')
        .select('id, number, issued_at, amount, balance_after, paid_in_full, invoices(number, clients(name, phone)), payments(method, reference)')
        .eq('org_id', org.id).order('issued_at', { ascending: false }),
    ])
    if (inv.error || rec.error) return setErr((inv.error || rec.error).message)
    setOpen(inv.data); setReceipts(rec.data)
    setInvoiceId(prev => (inv.data.some(i => i.id === prev) ? prev : inv.data[0]?.id ?? ''))
  }, [org.id])

  useEffect(() => { load() }, [load])

  const selected = open.find(i => i.id === invoiceId)
  const balance = selected ? Number(selected.total) - Number(selected.amount_paid) : 0

  // Default the amount to the full balance whenever the invoice changes
  useEffect(() => { setAmount(selected ? String(balance) : '') }, [invoiceId, selected?.amount_paid])

  const run = fn => { setErr(''); setNotice(''); return fn().then(r => { if (typeof r === 'string') setNotice(r) }).catch(e => setErr(e.message)) }

  async function record(e) {
    e.preventDefault()
    setErr(''); setNotice('')
    if (Number(amount) > balance) return setErr(`That is more than the balance of ${money(balance)}.`)
    setBusy(true)
    const { data: pay, error } = await supabase.from('payments').insert({
      org_id: org.id, invoice_id: invoiceId, amount: Number(amount), method,
      reference: reference.trim() || null, paid_at: date,
    }).select('id').single()
    setBusy(false)
    if (error) return setErr(error.code === '23505' ? 'That reference has already been recorded.' : error.message)
    setReference('')
    if (emailIt) {
      try {
        const { data: rc } = await supabase.from('receipts').select('id').eq('payment_id', pay.id).single()
        setNotice(await emailReceipt(org, rc.id))
      } catch (e) { setErr('Payment recorded, but the receipt email failed: ' + e.message) }
    }
    load()
  }

  return (
    <section>
      <h2>Record a payment</h2>
      {open.length === 0 ? (
        <p className="muted">No invoices are waiting for payment. Mark an invoice as sent on the Invoices tab first.</p>
      ) : (
        <form className="card" onSubmit={record}>
          <label>Invoice
            <select value={invoiceId} onChange={e => setInvoiceId(e.target.value)}>
              {open.map(i => (
                <option key={i.id} value={i.id}>
                  {i.number} · {i.clients?.name} · balance {money(Number(i.total) - Number(i.amount_paid))}
                </option>
              ))}
            </select>
          </label>
          <div className="row">
            <label>Amount paid (KES)
              <input type="number" min="0.01" step="0.01" required value={amount} onChange={e => setAmount(e.target.value)} />
            </label>
            <label>Method
              <select value={method} onChange={e => setMethod(e.target.value)}>
                {Object.entries(methods).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label>{method === 'mpesa' ? 'M-Pesa code' : 'Reference'}
              <input value={reference} onChange={e => setReference(e.target.value)} placeholder={method === 'mpesa' ? 'e.g. SHK1A2B3C4' : 'Optional'} />
            </label>
            <label>Date paid<input type="date" required value={date} onChange={e => setDate(e.target.value)} /></label>
          </div>
          {err && <p className="note">{err}</p>}
          <label style={{ marginTop: '.5rem' }}>
            <input type="checkbox" style={{ display: 'inline', width: 'auto', marginRight: '.5rem' }}
                   checked={emailIt} onChange={e => setEmailIt(e.target.checked)} />
            Email the receipt to the client
          </label>
          <button disabled={busy}>Record payment and issue receipt</button>
        </form>
      )}
      {open.length === 0 && err && <p className="note">{err}</p>}

      {notice && <p className="muted">{notice}</p>}

      <h2 style={{ marginTop: '2rem' }}>Receipts</h2>
      {receipts.length === 0 ? (
        <p className="muted">Receipts appear here as soon as you record a payment.</p>
      ) : (
        <table>
          <thead><tr><th>Receipt</th><th>Invoice</th><th>Client</th><th>Paid</th><th>Method</th><th>Balance left</th><th></th></tr></thead>
          <tbody>{receipts.map(r => (
            <tr key={r.id}>
              <td>{r.number}</td><td>{r.invoices?.number}</td><td>{r.invoices?.clients?.name}</td>
              <td>{money(r.amount)}</td>
              <td>{methods[r.payments?.method]}{r.payments?.reference ? ` · ${r.payments.reference}` : ''}</td>
              <td>{r.paid_in_full ? 'Paid in full' : money(r.balance_after)}</td>
              <td style={{ whiteSpace: 'nowrap' }}>
                <button className="ghost" onClick={() => run(() => downloadReceipt(org, r.id))}>PDF</button>{' '}
                <button className="ghost" onClick={() => run(() => whatsappReceipt(org, r.id))}>WhatsApp</button>{' '}
                <button className="ghost" onClick={() => run(() => emailReceipt(org, r.id))}>Email</button>
              </td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </section>
  )
}