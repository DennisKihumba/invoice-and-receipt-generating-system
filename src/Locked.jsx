import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { when } from './subscription'

function useSettings() {
  const [s, setS] = useState(null)
  useEffect(() => {
    supabase.from('platform_settings').select('price_text, pay_instructions, whatsapp').eq('id', 1).maybeSingle()
      .then(({ data }) => setS(data ?? {}))
  }, [])
  return s
}

const digits = p => {
  let n = String(p ?? '').replace(/\D/g, '')
  if (n.startsWith('0')) n = '254' + n.slice(1)
  return n
}

// Price and how to pay, as set by the platform owner in the database
export function PayInfo({ org }) {
  const s = useSettings()
  if (!s) return <p className="muted">Loading…</p>
  return (
    <div style={{ margin: '1rem 0' }}>
      {s.price_text && <p><strong>{s.price_text}</strong></p>}
      {s.pay_instructions && <p style={{ whiteSpace: 'pre-line' }}>{s.pay_instructions}</p>}
      {!s.price_text && !s.pay_instructions && <p className="muted">Contact us to activate your account.</p>}
      <p className="muted">Use <strong>{org.name}</strong> as the payment reference.</p>
      {s.whatsapp && (
        <a className="as-button" target="_blank" rel="noreferrer"
           href={`https://wa.me/${digits(s.whatsapp)}?text=${encodeURIComponent(`Hello, I have paid for ${org.name} on Cancelo Invoicing. M-Pesa code: `)}`}>
          Tell us you have paid on WhatsApp
        </a>
      )}
    </div>
  )
}

// Everything else is hidden until the company is paid up
export default function Locked({ org, billing, onCheck, onSignOut }) {
  const [checking, setChecking] = useState(false)
  const expired = billing.reason === 'expired'
  async function check() { setChecking(true); await onCheck(); setChecking(false) }
  return (
    <div className="card narrow">
      <h1>{expired ? 'Your subscription has ended' : 'Activate your account'}</h1>
      <p className="muted">
        {expired
          ? `${org.name} was active until ${when(billing.until)}. Your clients, invoices and records are safe. Renew to carry on.`
          : `${org.name} is set up. To start using Cancelo Invoicing, make the payment below and your account will be activated.`}
      </p>
      <PayInfo org={org} />
      <p className="muted">This page unlocks by itself once we confirm your payment. If it does not, press Check again.</p>
      <div className="row">
        <button onClick={check} disabled={checking}>{checking ? 'Checking…' : 'Check again'}</button>
        <button className="ghost" onClick={onSignOut}>Sign out</button>
      </div>
    </div>
  )
}

// Shown for the last day before the subscription ends; everything keeps working
export function RenewBanner({ org, billing }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="status" role="status" style={{ flexWrap: 'wrap' }}>
      <span>Your subscription ends {when(billing.until)}. Everything keeps working until then. Renew to avoid an interruption.</span>
      <button className="ghost" onClick={() => setOpen(!open)}>{open ? 'Hide' : 'How to pay'}</button>
      {open && <div style={{ flexBasis: '100%' }}><PayInfo org={org} /></div>}
    </div>
  )
}
