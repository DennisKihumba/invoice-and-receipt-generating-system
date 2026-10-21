import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from './supabase'
import Auth from './Auth'
import Landing from './Landing'
import ResetPassword from './ResetPassword'
import CreateCompany from './CreateCompany'
import Clients from './Clients'
import { peek, store, clearCache } from './cache'
import { startLive, stopLive, onChange } from './live'
import { warmPdf } from './pdf'
import Invoices from './Invoices'
import Payments from './Payments'
import Settings from './Settings'
import Team from './Team'
import Locked, { RenewBanner } from './Locked'
import Billing from './Billing'
import { billingState } from './subscription'

function Logo({ org }) {
  if (org.logo_url) return <img className="logo" src={org.logo_url} alt={org.name} />
  const initials = org.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  return <div className="logo logo-fallback">{initials}</div>
}

export default function App() {
  const [session, setSession] = useState(undefined)
  const [orgs, setOrgs] = useState(null)      // companies this login belongs to
  const [activeId, setActiveId] = useState(null)
  const [tab, setTab] = useState('clients')
  const uidRef = useRef(null)
  // Visitors who are not logged in see the landing page first; 'login' / 'signup' opens the form.
  // A link with an error in it (an expired reset link) goes straight to the form, which explains it.
  const [entry, setEntry] = useState(() => (window.location.hash.includes('error=') ? 'login' : null))
  const [recovering, setRecovering] = useState(false)   // true while choosing a new password
  const [platformAdmin, setPlatformAdmin] = useState(false)   // the owner of the whole platform: sees the Billing screen
  const [now, setNow] = useState(Date.now())                    // re-checks the subscription clock every 30 seconds

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      setSession(s)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  // The login decides the company: RLS only returns this user's memberships.
  const loadOrgs = useCallback(async () => {
    // Only MY membership rows: members can see everyone's rows in their company, and without this
    // filter the owner's row could be picked as mine, giving staff the owner's tabs.
    const { data: s } = await supabase.auth.getSession()
    const uid = s.session?.user?.id
    if (!uid) return
    const { data, error } = await supabase
      .from('members')
      .select('role, organizations(id, name, logo_url, invoice_prefix, receipt_prefix, vat_rate, paid_until, plan_exempt)')
      .eq('user_id', uid)
    if (error) return console.error(error)
    const list = data.map(m => ({ ...m.organizations, role: m.role }))
    setOrgs(list)
    if (uidRef.current) store('orgs3:' + uidRef.current, list)
    setActiveId(prev => (prev && list.some(o => o.id === prev) ? prev : list[0]?.id ?? null))
  }, [])

  useEffect(() => {
    uidRef.current = session?.user?.id ?? null
    if (session) {
      // Open instantly with the last known company, then refresh it in the background
      const cached = peek('orgs3:' + session.user.id)
      if (cached) { setOrgs(cached); setActiveId(prev => prev ?? cached[0]?.id ?? null) }
      loadOrgs()
      // Download the PDF tools quietly so the first PDF / WhatsApp / Email is instant
      if ('requestIdleCallback' in window) requestIdleCallback(warmPdf, { timeout: 3000 })
      else setTimeout(warmPdf, 1500)
    } else if (session === null) {
      setOrgs(null); setActiveId(null); clearCache()   // signed out: leave nothing behind
    }
  }, [session, loadOrgs])

  // Live updates: listen for changes to this company's data (and for changes to my own role or
  // the company details) so every screen stays current without clicking
  const liveOrgId = session && orgs?.length ? (orgs.find(o => o.id === activeId) ?? orgs[0]).id : null
  useEffect(() => {
    if (!liveOrgId) return
    startLive(liveOrgId)
    return stopLive
  }, [liveOrgId])
  useEffect(() => onChange(changed => { if (changed.includes('members') || changed.includes('organizations')) loadOrgs() }), [loadOrgs])

  useEffect(() => {
    if (!session) { setPlatformAdmin(false); return }
    supabase.rpc('is_platform_admin').then(({ data }) => setPlatformAdmin(data === true))
  }, [session?.user?.id])
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(t)
  }, [])

  if (session === undefined) return <p className="center muted">Loading…</p>
  // New team members arrive with a temporary password and must choose their own
  const mustChange = session?.user?.user_metadata?.must_change_password === true
  if ((recovering || mustChange) && session) return <ResetPassword first={mustChange && !recovering} onDone={() => setRecovering(false)} />
  if (!session) {
    return entry
      ? <Auth initialMode={entry} onBack={() => setEntry(null)} />
      : <Landing onLogin={() => setEntry('login')} onSignup={() => setEntry('signup')} />
  }
  if (orgs === null) return <p className="center muted">Loading your company…</p>
  if (orgs.length === 0) return <CreateCompany onCreated={loadOrgs} />

  const org = orgs.find(o => o.id === activeId) ?? orgs[0]
  const canManage = ['owner', 'admin'].includes(org.role)   // only they may change company settings

  // Subscription: unpaid or expired companies see only the payment screen. The database refuses
  // new work for them as well, so this screen is not the only thing standing in the way.
  const billing = billingState(org, now)
  if (billing.status === 'locked' && !platformAdmin) {
    return <Locked org={org} billing={billing} onCheck={loadOrgs}
                   onSignOut={() => { clearCache(); setEntry(null); supabase.auth.signOut() }} />
  }

  return (
    <div className="shell">
      <header className="bar">
        <Logo org={org} />
        <div className="bar-name">
          {orgs.length > 1 ? (
            <select value={org.id} onChange={e => setActiveId(e.target.value)}>
              {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          ) : <strong>{org.name}</strong>}
        </div>
        <nav className="tabs">
          <button className={tab === 'clients' ? 'on' : ''} onClick={() => setTab('clients')}>Clients</button>
          <button className={tab === 'invoices' ? 'on' : ''} onClick={() => setTab('invoices')}>Invoices</button>
          <button className={tab === 'payments' ? 'on' : ''} onClick={() => setTab('payments')}>Payments</button>
          {canManage && <button className={tab === 'team' ? 'on' : ''} onClick={() => setTab('team')}>Team</button>}
          {canManage && <button className={tab === 'settings' ? 'on' : ''} onClick={() => setTab('settings')}>Settings</button>}
          {platformAdmin && <button className={tab === 'billing' ? 'on' : ''} onClick={() => setTab('billing')}>Billing</button>}
        </nav>
        <button className="ghost" onClick={() => { clearCache(); setEntry(null); supabase.auth.signOut() }}>Sign out</button>
      </header>

      <main>
        {billing.status === 'warning' && <RenewBanner org={org} billing={billing} />}
        {tab === 'clients' && <Clients org={org} />}
        {tab === 'invoices' && <Invoices org={org} />}
        {tab === 'payments' && <Payments org={org} />}
        {tab === 'team' && canManage && <Team org={org} />}
        {tab === 'billing' && platformAdmin && <Billing />}
        {tab === 'settings' && canManage && <Settings org={org} onSaved={loadOrgs} />}
        {tab === 'settings' && !canManage && <p className="muted">Only owners and admins can change company settings.</p>}
      </main>
    </div>
  )
}
