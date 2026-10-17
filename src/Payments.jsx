import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'
import { friendly } from './errors'
import { useCached, forget } from './cache'
import { parseMpesa, cleanCode, isMpesaCode } from './mpesa'
import { downloadReceipt, whatsappReceipt, emailReceipt } from './pdf'

const money = n => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(n ?? 0)
const today = () => new Date().toISOString().slice(0, 10)
const methods = { mpesa: 'M-Pesa', bank: 'Bank transfer', cash: 'Cash', card: 'Card', other: 'Other' }

export default function Payments({ org }) {
  const [invoiceId, setInvoiceId] = useState('')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('mpesa')
  const [reference, setReference] = useState('')
  const [date, setDate] = useState(today())
  const [err, setErr] = useState('')
  const [notice, setNotice] = useState('')
  const [emailIt, setEmailIt] = useState(true)
  const [working, setWorking] = useState('')   // which receipt action is running
  const [sms, setSms] = useState('')
  const [smsNote, setSmsNote] = useState('')
  const [busy, setBusy] = useState(false)

  const { data, error: loadErr, refresh: load } = useCached(`${org.id}:payments`, async () => {
    const [inv, rec] = await Promise.all([
      supabase.from('invoices')
        .select('id, number, total, amount_paid, clients(name)')
        .eq('org_id', org.id).in('status', ['sent', 'partial']).order('created_at', { ascending: false }),
      supabase.from('receipts')
        .select('id, number, issued_at, amount, balance_after, paid_in_full, invoices(number, clients(name, phone)), payments(method, reference)')
        .eq('org_id', org.id).order('issued_at', { ascending: false }),
    ])
    if (inv.error || rec.error) throw (inv.error || rec.error)
    return { open: inv.data, receipts: rec.data }
  })
  const ready = data !== undefined
  const open = data?.open ?? []
  const receipts = data?.receipts ?? []

  useEffect(() => {
    if (data) setInvoiceId(prev => (data.open.some(i => i.id === prev) ? prev : data.open[0]?.id ?? ''))
  }, [data])

  const selected = open.find(i => i.id === invoiceId)
  const balance = selected ? Number(selected.total) - Number(selected.amount_paid) : 0

  // Default the amount to the full balance whenever the invoice changes
  useEffect(() => { setAmount(selected ? String(balance) : '') }, [invoiceId, selected?.amount_paid])

  const run = (key, fn, text) => {
    if (working) return
    setErr(''); setNotice(text); setWorking(key)
    return fn()
      .then(r => { setNotice(typeof r === 'string' ? r : ''); })
      .catch(e => { setNotice(''); setErr(friendly(e)) })
      .finally(() => setWorking(''))
  }

  // Pasting the M-Pesa confirmation message fills in the code and amount, and lets us cross-check them
  function readSms(text) {
    setSms(text); setErr('')
    if (!text.trim()) return setSmsNote('')
    const p = parseMpesa(text)
    if (!p.code) return setSmsNote('No M-Pesa code found in that message.')
    setReference(p.code)
    if (p.amount) setAmount(String(p.amount))
    setSmsNote(`Read from the message: code ${p.code}${p.amount ? `, KES ${p.amount.toLocaleString('en-KE')}` : ''}.`)
  }

  async function record(e) {
    e.preventDefault()
    setErr(''); setNotice('')
    if (Number(amount) > balance) return setErr(`That is more than the balance of ${money(balance)}.`)
    let code = reference.trim()
    if (method === 'mpesa') {
      code = cleanCode(code)
      if (!isMpesaCode(code)) return setErr('This M-Pesa code is not valid.')
      const p = sms.trim() ? parseMpesa(sms) : null
      if (p?.code && p.code !== code) return setErr('The code does not match the M-Pesa message.')
      if (p?.amount && Math.abs(p.amount - Number(amount)) > 0.001) return setErr('The amount does not match the M-Pesa message.')
    }
    setBusy(true); setNotice('Saving payment…')
    const { data: pay, error } = await supabase.from('payments').insert({
      org_id: org.id, invoice_id: invoiceId, amount: Number(amount), method,
      reference: code || null, paid_at: date,
    }).select('id').single()
    if (error) { setBusy(false); setNotice(''); return setErr(error.code === '23505' ? (method === 'mpesa' ? 'This M-Pesa code has already been used.' : 'This reference has already been used.') : friendly(error)) }
    setReference(''); setSms(''); setSmsNote('')
    forget(`${org.id}:invoices`)   // invoice status just changed; refetch it next time
    setNotice(emailIt ? 'Payment saved. Sending the receipt…' : 'Payment recorded.')
    if (emailIt) {
      try {
        const { data: rc } = await supabase.from('receipts').select('id').eq('payment_id', pay.id).single()
        setNotice(await emailReceipt(org, rc.id))
      } catch (e) { setNotice('Payment recorded.'); setErr('The receipt email failed: ' + friendly(e) + ' You can resend it with the Email button below.') }
    }
    setBusy(false)
    load()
  }

  return (
    <section>
      <h2>Record a payment</h2>
      {!ready ? (
        <p className="muted">Loading…</p>
      ) : open.length === 0 ? (
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
              <input value={reference} onChange={e => { setErr(''); setReference(method === 'mpesa' ? e.target.value.toUpperCase() : e.target.value) }} required={method === 'mpesa'} maxLength={method === 'mpesa' ? 10 : undefined} autoCapitalize="characters" placeholder={method === 'mpesa' ? 'e.g. SHK1A2B3C4' : 'Optional'} />
            </label>
            <label>Date paid<input type="date" required value={date} onChange={e => setDate(e.target.value)} /></label>
          </div>
          {err && <p className="note">{err}</p>}
          {method === 'mpesa' && (
            <label>Paste the M-Pesa message (optional, fills in and double-checks the code and amount)
              <textarea rows="3" value={sms} onChange={e => readSms(e.target.value)} placeholder="SHK1A2B3C4 Confirmed. Ksh1,624.00 received from…" />
              {smsNote && <span className="muted">{smsNote}</span>}
            </label>
          )}
          <label style={{ marginTop: '.5rem' }}>
            <input type="checkbox" style={{ display: 'inline', width: 'auto', marginRight: '.5rem' }}
                   checked={emailIt} onChange={e => setEmailIt(e.target.checked)} />
            Email the receipt to the client
          </label>
          <button disabled={busy || !!working}>{busy ? 'Working…' : 'Record payment and issue receipt'}</button>
        </form>
      )}
      {loadErr && <p className="note">{loadErr}</p>}
      {open.length === 0 && err && <p className="note">{err}</p>}

      {notice && <p className="status" role="status">{(working || busy) && <span className="spin" />}{notice}</p>}

      <h2 style={{ marginTop: '2rem' }}>Receipts</h2>
      {receipts.length === 0 ? (
        <p className="muted">Receipts appear here as soon as you record a payment.</p>
      ) : (
        <table className="stack">
          <thead><tr><th>Receipt</th><th>Invoice</th><th>Client</th><th>Paid</th><th>Method</th><th>Balance left</th><th></th></tr></thead>
          <tbody>{receipts.map(r => {
            const on = a => working === r.id + ':' + a
            return (
              <tr key={r.id}>
                <td data-label="Receipt"><strong>{r.number}</strong></td>
                <td data-label="Invoice">{r.invoices?.number}</td>
                <td data-label="Client">{r.invoices?.clients?.name}</td>
                <td data-label="Paid">{money(r.amount)}</td>
                <td data-label="Method">{methods[r.payments?.method]}{r.payments?.reference ? ` · ${r.payments.reference}` : ''}</td>
                <td data-label="Balance left">{r.paid_in_full ? 'Paid in full' : money(r.balance_after)}</td>
                <td className="actcell"><div className="actions">
                  <button className="ghost" disabled={busy || !!working} onClick={() => run(r.id + ':pdf', () => downloadReceipt(org, r.id), 'Preparing the PDF…')}>{on('pdf') ? 'Preparing…' : 'PDF'}</button>
                  <button className="ghost" disabled={busy || !!working} onClick={() => run(r.id + ':wa', () => whatsappReceipt(org, r.id), 'Preparing the receipt for WhatsApp…')}>{on('wa') ? 'Opening…' : 'WhatsApp'}</button>
                  <button className="ghost" disabled={busy || !!working} onClick={() => run(r.id + ':email', () => emailReceipt(org, r.id), 'Sending the receipt by email. Please wait…')}>{on('email') ? 'Sending…' : 'Email'}</button>
                </div></td>
              </tr>
            )
          })}</tbody>
        </table>
      )}
    </section>
  )
}