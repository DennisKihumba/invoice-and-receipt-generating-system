import { useEffect, useState, useCallback, useRef } from 'react'
import { friendly } from './errors'

// Show saved data instantly, then refresh from the server and update the screen
// (often called "stale-while-revalidate"). Saved in memory and in this browser's
// localStorage, so the app also opens with data after a reload.
// The cache is wiped on sign-out, so nothing stays behind on a shared phone or computer.
const PREFIX = 'cis-cache:'
const mem = new Map()

export function peek(key) {
  if (mem.has(key)) return mem.get(key)
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (raw) { const v = JSON.parse(raw); mem.set(key, v); return v }
  } catch { /* storage unavailable: carry on without it */ }
  return undefined
}

export function store(key, value) {
  mem.set(key, value)
  try { localStorage.setItem(PREFIX + key, JSON.stringify(value)) } catch { /* full or blocked */ }
}

// Drop one entry when we know it is out of date (e.g. a payment changed an invoice)
export function forget(key) {
  mem.delete(key)
  try { localStorage.removeItem(PREFIX + key) } catch { /* ignore */ }
}

export function clearCache() {
  mem.clear()
  try {
    Object.keys(localStorage).filter(k => k.startsWith(PREFIX)).forEach(k => localStorage.removeItem(k))
  } catch { /* ignore */ }
}

export function useCached(key, fetcher) {
  const [data, setData] = useState(() => peek(key))
  const [error, setError] = useState('')
  const fetchRef = useRef(fetcher)
  fetchRef.current = fetcher

  const refresh = useCallback(async () => {
    try {
      const v = await fetchRef.current()
      store(key, v); setData(v); setError('')
    } catch (e) { setError(friendly(e)) }
  }, [key])

  useEffect(() => { setData(peek(key)); refresh() }, [key, refresh])
  return { data, error, refresh }
}
