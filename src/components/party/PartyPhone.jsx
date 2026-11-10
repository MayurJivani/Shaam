import { useState } from "react"
import { gameBySlug } from "../../../shared/games.js"
import { param, setParams, store, useRelay } from "../../lib/relay.js"
import { Avatar, JoinForm, Offline } from "../ui.jsx"

/**
 * A phone in the party. Mostly a waiting room: it follows the TV into each
 * built-in game on its own, and for an outside game it shows the link.
 * The identity it keeps (shaam.me) is what lets a game credit this player.
 */
export default function PartyPhone() {
  const [me, setMe] = useState(() => {
    const saved = store.get("shaam.me")
    return saved && (!param("code") || saved.code === param("code")) ? saved : null
  })
  const [party, setParty] = useState(null)
  const [error, setError] = useState("")
  const [pending, setPending] = useState(null)

  const { status, send } = useRelay(
    () => (me ? { t: "party.join", code: me.code, token: me.token } : null),
    (m) => {
      if (m.t === "party.joined") {
        const next = { code: m.code, token: m.token, ...m.me }
        store.set("shaam.me", next)
        setMe(next)
        setParams({ code: m.code })
        setPending(null)
      } else if (m.t === "party") {
        setParty(m.party)
        // Follow the TV into a built-in game.
        if (m.party.current?.room) location.href = `/${m.party.current.game}/play?code=${m.party.current.room}`
      } else if (m.t === "error") {
        setError(m.msg)
        setPending(null)
        if (m.fatal) {
          store.set("shaam.me", null)
          setMe(null)
        }
      }
    },
  )

  if (!me || !party) {
    return (
      <main className="phone">
        <Offline status={status} />
        <h1 className="brand small">Shaam</h1>
        {me ? (
          <p className="hint">Finding your party…</p>
        ) : (
          <JoinForm
            code={param("code")}
            askCode
            error={error}
            busy={!!pending}
            cta="Join the party"
            onJoin={(f) => {
              setError("")
              setPending(f)
              send({ t: "party.join", ...f })
            }}
          />
        )}
      </main>
    )
  }

  const current = party.current && gameBySlug(party.current.game)
  const rank = party.leaderboard.findIndex((r) => r.key === me.id)
  return (
    <main className="phone">
      <Offline status={status} />
      <header className="me-bar">
        <Avatar i={me.avatar} size={40} />
        <span className="name">{me.name}</span>
        <span className="code-tag">{party.code}</span>
      </header>
      {current && !current.builtIn ? (
        <section className="phone-card">
          <p className="eyebrow">Next up</p>
          <h2>{current.name}</h2>
          <p>Open it, play along, then come back here. The host records the result.</p>
          <a className="btn primary big" href={party.current.url} target="_blank" rel="noopener">Open {current.name}</a>
        </section>
      ) : (
        <section className="phone-card">
          <h2>You're in.</h2>
          <p>Look up at the TV. When the host picks a game, this phone takes you there.</p>
        </section>
      )}
      {party.results.length > 0 && rank >= 0 && (
        <p className="hint center-text">
          You're {ordinal(rank + 1)} of {party.leaderboard.length} after {party.results.length} game{party.results.length > 1 ? "s" : ""}.
        </p>
      )}
    </main>
  )
}

export const ordinal = (n) => `${n}${["th", "st", "nd", "rd"][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] ?? "th"}`
