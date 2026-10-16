import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'
import Auth from './Auth'
import CreateCompany from './CreateCompany'
import Clients from './Clients'
import Invoices from './Invoices'
import Payments from './Payments'
import Settings from './Settings'

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

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  // The login decides the company: RLS only returns this user's memberships.
  const loadOrgs = useCallback(async () => {
    const { data, error } = await supabase
      .from('members')
      .select('role, organizations(id, name, logo_url, invoice_prefix, receipt_prefix, vat_rate)')
    if (error) return console.error(error)
    const list = data.map(m => ({ ...m.organizations, role: m.role }))
    setOrgs(list)
    setActiveId(prev => prev ?? list[0]?.id ?? null)
  }, [])

  useEffect(() => {
    if (session) loadOrgs()
    else { setOrgs(null); setActiveId(null) }
  }, [session, loadOrgs])

  if (session === undefined) return <p className="center muted">Loading…</p>
  if (!session) return <Auth />
  if (orgs === null) return <p className="center muted">Loading your company…</p>
  if (orgs.length === 0) return <CreateCompany onCreated={loadOrgs} />

  const org = orgs.find(o => o.id === activeId) ?? orgs[0]

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
          <button className={tab === 'settings' ? 'on' : ''} onClick={() => setTab('settings')}>Settings</button>
        </nav>
        <button className="ghost" onClick={() => supabase.auth.signOut()}>Sign out</button>
      </header>

      <main>
        {tab === 'clients' && <Clients org={org} />}
        {tab === 'invoices' && <Invoices org={org} />}
        {tab === 'payments' && <Payments org={org} />}
        {tab === 'settings' && <Settings org={org} onSaved={loadOrgs} />}
      </main>
    </div>
  )
}