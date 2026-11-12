import { useEffect, useRef, useState } from "react"
import QRCode from "qrcode"

/** Sixteen creatures; a party and every game in it use the same index. */
export const AVATARS = ["🦉", "🐙", "🦊", "🐌", "🦋", "🐋", "🦔", "🐸", "🦩", "🐢", "🦄", "🐝", "🦚", "🐞", "🦀", "🐇"]

export function Avatar({ i, size = 40, dim = false, ring = false }) {
  const hue = ((i ?? 0) * 47) % 360
  return (
    <span
      className={`avatar${dim ? " dim" : ""}${ring ? " ring" : ""}`}
      style={{ width: size, height: size, fontSize: size * 0.56, background: `hsl(${hue} 55% 32%)` }}
      aria-hidden="true"
    >
      {i == null ? "✦" : AVATARS[i]}
    </span>
  )
}

export function AvatarPicker({ value, onChange }) {
  return (
    <div className="avatar-picker" role="radiogroup" aria-label="Pick a creature">
      {AVATARS.map((_, i) => (
        <button key={i} type="button" role="radio" aria-checked={value === i} className={value === i ? "on" : ""} onClick={() => onChange(i)}>
          <Avatar i={i} size={44} />
        </button>
      ))}
    </div>
  )
}

export function Qr({ url, size = 180 }) {
  const ref = useRef(null)
  useEffect(() => {
    if (url && ref.current) QRCode.toCanvas(ref.current, url, { width: size, margin: 1, color: { dark: "#111111", light: "#ffffff" } }).catch(() => {})
  }, [url, size])
  return url ? <canvas ref={ref} className="qr" aria-label={`QR code for ${url}`} /> : null
}

/** Name + creature form shared by the party and the games. */
export function JoinForm({ code, askCode, error, busy, onJoin, cta = "Join" }) {
  const [c, setC] = useState(code ?? "")
  const [name, setName] = useState(() => localStorage.getItem("shaam.name") ?? "")
  const [avatar, setAvatar] = useState(() => Number(localStorage.getItem("shaam.avatar") ?? Math.floor(Math.random() * 16)))
  const submit = (e) => {
    e.preventDefault()
    localStorage.setItem("shaam.name", name)
    localStorage.setItem("shaam.avatar", String(avatar))
    onJoin({ code: c.trim().toUpperCase(), name: name.trim(), avatar })
  }
  return (
    <form className="join-form" onSubmit={submit}>
      {askCode && (
        <label>
          Room code
          <input value={c} onChange={(e) => setC(e.target.value)} maxLength={4} autoCapitalize="characters" autoComplete="off" required className="code-input" />
        </label>
      )}
      <label>
        Your name
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={18} required autoComplete="nickname" />
      </label>
      <AvatarPicker value={avatar} onChange={setAvatar} />
      {error && <p className="error" role="alert">{error}</p>}
      <button className="btn primary big" disabled={busy}>
        {cta}
      </button>
    </form>
  )
}

export function Offline({ status }) {
  return status === "closed" ? <div className="offline" role="status">Reconnecting…</div> : null
}
