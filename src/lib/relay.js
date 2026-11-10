import { useCallback, useEffect, useRef, useState } from "react"

/**
 * One socket to the relay that keeps coming back. `hello()` is asked for the
 * first message on every (re)connect, so a phone that slept or changed network
 * re-authenticates with whatever token it holds by then and lands in its seat.
 */
export function useRelay(hello, onMessage) {
  const [status, setStatus] = useState("connecting")
  const ref = useRef({ ws: null })
  ref.current.hello = hello
  ref.current.onMessage = onMessage

  useEffect(() => {
    let stop = false
    let wait = 500
    let timer
    const open = () => {
      const ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`)
      ref.current.ws = ws
      ws.onopen = () => {
        wait = 500
        setStatus("open")
        const m = ref.current.hello()
        if (m) ws.send(JSON.stringify(m))
      }
      ws.onmessage = (e) => ref.current.onMessage(JSON.parse(e.data))
      ws.onclose = () => {
        setStatus("closed")
        if (!stop) timer = setTimeout(open, (wait = Math.min(wait * 2, 5000)))
      }
    }
    open()
    return () => {
      stop = true
      clearTimeout(timer)
      ref.current.ws?.close()
    }
  }, [])

  const send = useCallback((m) => {
    const ws = ref.current.ws
    if (ws?.readyState === 1) ws.send(JSON.stringify(m))
  }, [])
  return { status, send }
}

export const store = {
  get(k) {
    try {
      return JSON.parse(localStorage.getItem(k))
    } catch {
      return null
    }
  },
  set(k, v) {
    localStorage.setItem(k, JSON.stringify(v))
  },
}

export const param = (k) => new URLSearchParams(location.search).get(k)?.toUpperCase() ?? ""

/** Put ?code=... in the address bar without a reload, so the TV comes back to the same room. */
export function setParams(obj) {
  const url = new URL(location.href)
  for (const [k, v] of Object.entries(obj)) v ? url.searchParams.set(k, v) : url.searchParams.delete(k)
  history.replaceState(null, "", url)
}

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"])

/** An origin a phone can open: a TV on localhost would print a dead QR, so swap in the LAN address. */
export async function shareOrigin() {
  if (!LOOPBACK.has(location.hostname)) return location.origin
  const ip = await fetch("/api/net")
    .then((r) => r.json())
    .then((j) => j.ips?.[0])
    .catch(() => null)
  return ip ? `${location.protocol}//${ip}${location.port ? `:${location.port}` : ""}` : location.origin
}

/** Seconds left on a server clock. The server sends ms remaining, never a timestamp, so skewed phone clocks do not matter. */
export function useCountdown(left, paused) {
  const [now, setNow] = useState(() => Date.now())
  const endAt = useRef(null)
  useEffect(() => {
    endAt.current = left == null ? null : Date.now() + left
    setNow(Date.now())
  }, [left, paused])
  useEffect(() => {
    if (left == null || paused) return
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [left, paused])
  if (left == null) return null
  if (paused) return Math.ceil(left / 1000)
  return Math.max(0, Math.ceil((endAt.current - now) / 1000))
}
