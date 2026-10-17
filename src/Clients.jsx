import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'
import { friendly } from './errors'
import { useCached, forget } from './cache'

export default function Clients({ org }) {
  const [f, setF] = useState({ name: '', email: '', phone: '' })
  const [err, setErr] = useState('')

  const { data: list, error: loadErr, refresh: load } = useCached(`${org.id}:clients`, async () => {
    const { data, error } = await supabase
      .from('clients').select('*').eq('org_id', org.id).order('created_at', { ascending: false })
    if (error) throw error
    return data
  })
  const clients = list ?? []

  async function add(e) {
    e.preventDefault(); setErr('')
    const { error } = await supabase.from('clients').insert({
      org_id: org.id, name: f.name, email: f.email || null, phone: f.phone || null,
    })
    if (error) return setErr(friendly(error))
    setF({ name: '', email: '', phone: '' }); forget(`${org.id}:invoices`); load()
  }

  return (
    <section>
      <h2>Clients</h2>
      <form className="row add" onSubmit={add}>
        <input required placeholder="Client name" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} />
        <input type="email" placeholder="Email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} />
        <input placeholder="Phone" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} />
        <button>Add client</button>
      </form>
      {(err || loadErr) && <p className="note">{err || loadErr}</p>}
      {list === undefined
        ? <p className="muted">Loading…</p>
        : clients.length === 0
        ? <p className="muted">No clients yet. Add your first client above to start invoicing.</p>
        : <table className="stack">
            <thead><tr><th>Name</th><th>Email</th><th>Phone</th></tr></thead>
            <tbody>{clients.map(c => (
              <tr key={c.id}><td data-label="Name"><strong>{c.name}</strong></td><td data-label="Email">{c.email}</td><td data-label="Phone">{c.phone}</td></tr>
            ))}</tbody>
          </table>}
    </section>
  )
}
