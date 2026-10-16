import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'

export default function Clients({ org }) {
  const [clients, setClients] = useState([])
  const [f, setF] = useState({ name: '', email: '', phone: '' })
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('clients').select('*').eq('org_id', org.id).order('created_at', { ascending: false })
    if (error) setErr(error.message); else setClients(data)
  }, [org.id])

  useEffect(() => { load() }, [load])

  async function add(e) {
    e.preventDefault(); setErr('')
    const { error } = await supabase.from('clients').insert({
      org_id: org.id, name: f.name, email: f.email || null, phone: f.phone || null,
    })
    if (error) return setErr(error.message)
    setF({ name: '', email: '', phone: '' }); load()
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
      {err && <p className="note">{err}</p>}
      {clients.length === 0
        ? <p className="muted">No clients yet. Add your first client above to start invoicing.</p>
        : <table>
            <thead><tr><th>Name</th><th>Email</th><th>Phone</th></tr></thead>
            <tbody>{clients.map(c => (
              <tr key={c.id}><td>{c.name}</td><td>{c.email}</td><td>{c.phone}</td></tr>
            ))}</tbody>
          </table>}
    </section>
  )
}
