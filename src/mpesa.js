// M-Pesa transaction codes are 10 letters/digits, e.g. SHK1A2B3C4.
export const cleanCode = s => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
export const isMpesaCode = c => /^[A-Z0-9]{10}$/.test(c)

// Reads the code, amount and date out of a pasted M-Pesa confirmation message.
export function parseMpesa(text) {
  const t = String(text ?? '')
  const code = (t.match(/\b([A-Z0-9]{10})\s+confirmed/i) || [])[1]?.toUpperCase() ?? null
  const amt = (t.match(/Ksh\.?\s?([\d,]+(?:\.\d{1,2})?)/i) || [])[1]   // first amount = payment, later one = balance
  const amount = amt ? Number(amt.replace(/,/g, '')) : null
  const date = (t.match(/on\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/i) || [])[1] ?? null
  return { code, amount, date }
}
