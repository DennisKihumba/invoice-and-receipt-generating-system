import { supabase } from './supabase'

// Live updates. We listen to the database for changes to THIS company's rows only (every
// subscription is filtered by company id, and the database also applies the same access rules
// as for normal reads). A change does not carry data into the screen: it just tells the screens
// that show that table to fetch fresh data, so what you see always comes from the database.
const TABLES = ['invoices', 'payments', 'receipts', 'clients', 'members']   // each has an org_id column
let channel = null
let down = false          // true while the connection is lost, so we catch up on reconnect
let hiddenAt = 0
const listeners = new Set()
const pending = new Set()
let timer = null

// Several changes at once (a payment also changes the invoice and creates a receipt) are gathered
// into ONE announcement, so a screen refreshes once, not once per table
function notify(table) {
  pending.add(table)
  clearTimeout(timer)
  timer = setTimeout(() => {
    const changed = [...pending]
    pending.clear()
    listeners.forEach(fn => fn(changed))
  }, 300)
}
const notifyAll = () => [...TABLES, 'organizations'].forEach(notify)

export function onChange(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

// A phone can pause the connection while the browser is in the background, so on coming back
// (or when the network returns) every screen refreshes once to catch up.
function onVisibility() {
  if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); return }
  if (hiddenAt && Date.now() - hiddenAt > 10000) notifyAll()
  hiddenAt = 0
}

export function startLive(orgId) {
  stopLive()
  let ch = supabase.channel('org-' + orgId)
  for (const table of TABLES) {
    ch = ch.on('postgres_changes', { event: '*', schema: 'public', table, filter: `org_id=eq.${orgId}` }, () => notify(table))
  }
  ch = ch.on('postgres_changes', { event: '*', schema: 'public', table: 'organizations', filter: `id=eq.${orgId}` }, () => notify('organizations'))
  ch.subscribe(status => {
    if (status === 'SUBSCRIBED') { if (down) notifyAll(); down = false }
    else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) down = true
  })
  channel = ch
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('online', notifyAll)
}

export function stopLive() {
  if (channel) supabase.removeChannel(channel)
  channel = null; down = false
  document.removeEventListener('visibilitychange', onVisibility)
  window.removeEventListener('online', notifyAll)
}
