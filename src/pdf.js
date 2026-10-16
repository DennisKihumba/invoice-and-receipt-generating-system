import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { supabase } from './supabase'

const TEAL = [15, 118, 110], INK = [20, 50, 58], MUTED = [93, 114, 121]
const fmt = n => 'KES ' + Number(n ?? 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const initials = name => name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
const METHODS = { mpesa: 'M-Pesa', bank: 'Bank transfer', cash: 'Cash', card: 'Card', other: 'Other' }

async function orgFull(orgId) {
  const { data, error } = await supabase.from('organizations').select('*').eq('id', orgId).single()
  if (error) throw error
  return data
}

async function logoData(url) {
  if (!url) return null
  try {
    const blob = await (await fetch(url)).blob()
    return await new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob) })
  } catch { return null }
}

// Letterhead: logo (or initials until a logo is uploaded), company details, document title
async function letterhead(doc, o, title, number) {
  const W = doc.internal.pageSize.getWidth()
  let drawn = false
  const logo = await logoData(o.logo_url)
  if (logo) { try { doc.addImage(logo, 14, 12, 20, 20); drawn = true } catch { /* unsupported format */ } }
  if (!drawn) {
    doc.setFillColor(...TEAL); doc.roundedRect(14, 12, 20, 20, 2, 2, 'F')
    doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(12)
    doc.text(initials(o.name), 24, 24.5, { align: 'center' })
  }
  doc.setTextColor(...INK); doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.text(o.name, 38, 18)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...MUTED)
  ;[o.address, [o.phone, o.email].filter(Boolean).join('  |  '), o.kra_pin && `KRA PIN: ${o.kra_pin}`]
    .filter(Boolean).forEach((l, i) => doc.text(l, 38, 23 + i * 4.5))
  doc.setTextColor(...TEAL); doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.text(title, W - 14, 20, { align: 'right' })
  doc.setTextColor(...INK); doc.setFontSize(10); doc.text(number ?? '', W - 14, 27, { align: 'right' })
  return 44
}

function party(doc, label, c, y) {
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...MUTED); doc.text(label, 14, y)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...INK); doc.text(c.name, 14, y + 5)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  const l = [c.email, c.phone, c.address].filter(Boolean)
  l.forEach((t, i) => doc.text(t, 14, y + 10 + i * 4.5))
  return y + 12 + Math.max(l.length, 1) * 4.5
}

function right(doc, rows, y, bold = false) {
  const W = doc.internal.pageSize.getWidth()
  rows.forEach(([k, v], i) => {
    doc.setFont('helvetica', bold && i === rows.length - 1 ? 'bold' : 'normal'); doc.setFontSize(10); doc.setTextColor(...INK)
    doc.text(k, W - 70, y + i * 6); doc.text(v, W - 14, y + i * 6, { align: 'right' })
  })
  return y + rows.length * 6
}

async function buildInvoice(orgId, id) {
  const o = await orgFull(orgId)
  const { data: inv, error } = await supabase.from('invoices').select('*, clients(*), invoice_items(*)').eq('id', id).single()
  if (error) throw error
  const doc = new jsPDF(), W = doc.internal.pageSize.getWidth()
  let y = await letterhead(doc, o, 'INVOICE', inv.number)
  const yEnd = party(doc, 'Bill to', inv.clients, y)
  doc.setFontSize(9); doc.setTextColor(...INK)
  doc.text(`Issued: ${inv.issue_date}`, W - 14, y + 5, { align: 'right' })
  if (inv.due_date) doc.text(`Due: ${inv.due_date}`, W - 14, y + 10, { align: 'right' })
  const items = [...inv.invoice_items].sort((a, b) => a.position - b.position)
  autoTable(doc, {
    startY: yEnd + 4,
    head: [['Description', 'Qty', 'Unit price', 'Amount']],
    body: items.map(i => [i.description, Number(i.quantity), fmt(i.unit_price), fmt(i.amount)]),
    headStyles: { fillColor: TEAL }, styles: { fontSize: 9 },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
  })
  y = doc.lastAutoTable.finalY + 8
  const rows = [['Subtotal', fmt(inv.subtotal)], ['VAT', fmt(inv.tax)], ['Total', fmt(inv.total)]]
  if (Number(inv.amount_paid) > 0) rows.push(['Paid', fmt(inv.amount_paid)], ['Balance due', fmt(inv.total - inv.amount_paid)])
  y = right(doc, rows, y, true) + 8
  doc.setFontSize(9); doc.setTextColor(...INK)
  for (const [title, text] of [['How to pay', o.payment_instructions], ['Notes', inv.notes]]) {
    if (!text) continue
    doc.setFont('helvetica', 'bold'); doc.text(title, 14, y)
    doc.setFont('helvetica', 'normal')
    const wrapped = doc.splitTextToSize(text, W - 28); doc.text(wrapped, 14, y + 5); y += 9 + wrapped.length * 4
  }
  return { doc, inv, o }
}

async function buildReceipt(orgId, id) {
  const o = await orgFull(orgId)
  const { data: r, error } = await supabase.from('receipts')
    .select('*, payments(*), invoices(number, total, clients(*))').eq('id', id).single()
  if (error) throw error
  const doc = new jsPDF(), W = doc.internal.pageSize.getWidth()
  let y = await letterhead(doc, o, 'RECEIPT', r.number)
  y = party(doc, 'Received from', r.invoices.clients, y)
  autoTable(doc, {
    startY: y + 4,
    head: [['Invoice', 'Date paid', 'Method', 'Reference', 'Amount']],
    body: [[r.invoices.number, String(r.payments.paid_at).slice(0, 10), METHODS[r.payments.method], r.payments.reference ?? '-', fmt(r.amount)]],
    headStyles: { fillColor: TEAL }, styles: { fontSize: 9 }, columnStyles: { 4: { halign: 'right' } },
  })
  y = right(doc, [['Invoice total', fmt(r.invoices.total)], ['Amount received', fmt(r.amount)],
    [r.paid_in_full ? 'Status' : 'Balance remaining', r.paid_in_full ? 'PAID IN FULL' : fmt(r.balance_after)]],
    doc.lastAutoTable.finalY + 8, true)
  doc.setFontSize(9); doc.setTextColor(...MUTED); doc.text('Thank you for your payment.', 14, y + 10)
  return { doc, r, o }
}

async function publish(orgId, kind, id, doc) {
  const path = `${orgId}/${kind}/${id}.pdf`
  const { error } = await supabase.storage.from('documents')
    .upload(path, doc.output('blob'), { contentType: 'application/pdf', upsert: true })
  if (error) throw error
  return supabase.storage.from('documents').getPublicUrl(path).data.publicUrl + `?v=${Date.now()}`
}

// Kenyan numbers: 0712… / 712… / +254712… all become 254712…
function waLink(phone, text) {
  let n = String(phone ?? '').replace(/\D/g, '')
  if (n.startsWith('0')) n = '254' + n.slice(1)
  else if (n.length === 9) n = '254' + n
  return `https://wa.me/${n}?text=${encodeURIComponent(text)}`
}

async function openWhatsApp(getLink) {
  const w = window.open('', '_blank')   // opened first so the browser doesn't block the popup
  try { w.location = await getLink() } catch (e) { w?.close(); throw e }
}

export async function downloadInvoice(org, id) { const { doc, inv } = await buildInvoice(org.id, id); doc.save(`${inv.number}.pdf`) }
export async function downloadReceipt(org, id) { const { doc, r } = await buildReceipt(org.id, id); doc.save(`${r.number}.pdf`) }

export const whatsappInvoice = (org, id) => openWhatsApp(async () => {
  const { doc, inv, o } = await buildInvoice(org.id, id)
  const url = await publish(org.id, 'invoices', id, doc)
  if (inv.status === 'draft') await supabase.from('invoices').update({ status: 'sent' }).eq('id', id)
  return waLink(inv.clients.phone, `Hello ${inv.clients.name}, here is invoice ${inv.number} from ${o.name}: ${url}`)
})

export const whatsappReceipt = (org, id) => openWhatsApp(async () => {
  const { doc, r, o } = await buildReceipt(org.id, id)
  const url = await publish(org.id, 'receipts', id, doc)
  await supabase.from('receipts').update({ pdf_url: url }).eq('id', id)
  return waLink(r.invoices.clients.phone, `Hello ${r.invoices.clients.name}, thank you for your payment. Your receipt ${r.number} from ${o.name}: ${url}`)
})

// ── Email (sent by the send-document Edge Function) ──
async function sendEmail(kind, id) {
  const { data, error } = await supabase.functions.invoke('send-document', { body: { kind, id } })
  if (error) throw new Error(error.message)
  if (data?.error) throw new Error(data.error)
  return `Emailed to ${data.sentTo}`
}

export async function emailInvoice(org, id) {
  const { doc, inv } = await buildInvoice(org.id, id)
  await publish(org.id, 'invoices', id, doc)
  if (inv.status === 'draft') await supabase.from('invoices').update({ status: 'sent' }).eq('id', id)
  return sendEmail('invoice', id)
}

export async function emailReceipt(org, id) {
  const { doc } = await buildReceipt(org.id, id)
  const url = await publish(org.id, 'receipts', id, doc)
  await supabase.from('receipts').update({ pdf_url: url }).eq('id', id)
  return sendEmail('receipt', id)
}