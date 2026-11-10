import { useEffect, useState } from "react"
import { param, store, useCountdown, useRelay } from "../../lib/relay.js"
import { ordinal } from "../party/PartyPhone.jsx"
import { Avatar, JoinForm, Offline } from "../ui.jsx"
import { Card } from "./Card.jsx"

/**
 * A player's phone: only private actions live here (your hand, your clue,
 * your vote). Everything to look at together is on the TV, so between actions
 * this screen deliberately says little more than "look up".
 */
export default function ReveriePhone() {
  const [code, setCode] = useState(param("code"))
  const seatKey = `shaam.seat.${code}`
  const [v, setV] = useState(null)
  const [error, setError] = useState("")
  const [form, setForm] = useState(() => !code || (!store.get(`shaam.seat.${code}`) && !store.get("shaam.me")))
  const [pick, setPick] = useState(null)

  const { status, send } = useRelay(
    () => {
      const token = store.get(seatKey)
      const me = store.get("shaam.me")
      return code && !form && (token || me) ? { t: "game.join", code, token, partyToken: me?.token } : null
    },
    (m) => {
      if (m.t === "game.joined") {
        store.set(`shaam.seat.${m.code}`, m.token)
        setForm(false)
        setError("")
      } else if (m.t === "game") setV(m.view)
      else if (m.t === "error") {
        setError(m.msg)
        if (m.fatal) {
          store.set(seatKey, null)
          setForm(true)
          setV(null)
        }
      }
    },
  )
  const secs = useCountdown(v?.left, v?.paused)
  // A new phase never inherits a half-made choice from the last one.
  useEffect(() => setPick(null), [v?.phase, v?.round])
  // After the final scores, go back to the party so this phone follows the TV into the next game.
  useEffect(() => {
    if (v?.phase !== "over" || !v.party) return
    const t = setTimeout(() => (location.href = `/join?code=${v.party}`), 8000)
    return () => clearTimeout(t)
  }, [v?.phase, v?.party])

  if (form || !v?.me) {
    return (
      <main className="phone">
        <Offline status={status} />
        <h1 className="brand small">Reverie</h1>
        {form ? (
          <JoinForm
            code={code}
            askCode={!param("code")}
            error={error}
            cta="Take a seat"
            onJoin={(f) => {
              setCode(f.code)
              history.replaceState(null, "", `?code=${f.code}`)
              send({ t: "game.join", code: f.code, name: f.name, avatar: f.avatar, partyToken: store.get("shaam.me")?.token })
            }}
          />
        ) : (
          <p className="hint">Finding your seat…</p>
        )}
      </main>
    )
  }

  const me = v.players.find((p) => p.id === v.me.id)
  const teller = v.players.find((p) => p.id === v.tellerId)
  const iTell = v.tellerId === v.me.id
  const act = (a, extra) => send({ t: "game.act", a, ...extra })

  return (
    <main className={`phone rv-phone phase-${v.phase}`}>
      <Offline status={status} />
      <header className="me-bar">
        <Avatar i={me.avatar} size={40} />
        <span className="name">{me.name}</span>
        <span className="score" aria-label="your score">{me.score}</span>
        {secs != null && <span className={`timer${secs <= 5 ? " hurry" : ""}`}>{v.paused ? "❚❚" : `${secs}s`}</span>}
      </header>
      {error && <p className="error" role="alert" onClick={() => setError("")}>{error}</p>}
      <Body v={v} me={me} teller={teller} iTell={iTell} pick={pick} setPick={setPick} act={act} />
    </main>
  )
}

function Body({ v, me, teller, iTell, pick, setPick, act }) {
  switch (v.phase) {
    case "lobby":
      return <Note title="You're in." text="Watch the TV. The game starts when the host is ready." />
    case "telling":
      if (!iTell) return <><Note title={`${teller?.name} is the storyteller`} text="While they think, look through your hand. You'll pick one of these next." /><Hand cards={v.me.hand} /></>
      return <Tell v={v} pick={pick} setPick={setPick} act={act} />
    case "submitting":
      if (iTell) return <Note title="Your card is in." text="The others are picking cards to match your clue. Look at the TV." />
      if (v.me.played != null) return <Played card={v.me.played} text="Played. Look up at the TV." />
      return (
        <>
          <ClueBar clue={v.clue} who={teller?.name} />
          <p className="hint center-text">Play the card that best fits the clue. Fool the others into picking it.</p>
          <Hand cards={v.me.hand} pick={pick} setPick={setPick} />
          {pick != null && <Sheet card={pick} onClose={() => setPick(null)} action="Play this card" onAction={() => act("submit", { card: pick })} />}
        </>
      )
    case "discussing":
      return (
        <>
          <ClueBar clue={v.clue} who={teller?.name} />
          <Note title="Talk it over." text={`Which card on the TV is ${iTell ? "yours? Don't give it away" : `${teller?.name}'s`}? Voting opens on your phone in a moment.`} />
          {!iTell && v.me.played != null && <Played card={v.me.played} text="Your card. You can't vote for it." small />}
        </>
      )
    case "voting":
      if (iTell) return <Note title="No vote for you." text="Keep a straight face while they decide." />
      if (v.me.vote != null) return <Note title={`Locked in: card ${v.table.indexOf(v.me.vote) + 1}`} text="Waiting for the others to vote." />
      return (
        <>
          <ClueBar clue={v.clue} who={teller?.name} />
          <p className="hint center-text">Which card is {teller?.name}'s? Numbers match the TV.</p>
          <div className="hand vote">
            {v.table.map((c, i) => (
              <Card key={c} id={c} disabled={c === v.me.played} selected={pick === c} onClick={() => setPick(c)} label={`Card ${i + 1}`}>
                <span className="num">{i + 1}</span>
                {c === v.me.played && <span className="yours">yours</span>}
              </Card>
            ))}
          </div>
          {pick != null && <Sheet card={pick} onClose={() => setPick(null)} action={`Vote for card ${v.table.indexOf(pick) + 1}`} onAction={() => act("vote", { card: pick })} />}
        </>
      )
    case "reveal": {
      const d = v.last?.deltas[me.id] ?? 0
      const found = v.last?.cards.find((c) => c.card === v.last.tellerCard)?.voters.includes(me.id)
      return <Note title={d ? `+${d} this round` : "No points this round"} text={iTell ? "See how the room read your clue on the TV." : found ? `You found ${teller?.name}'s card.` : "Look at the TV to see whose card was whose."} big />
    }
    case "over": {
      const rank = [...v.players].sort((a, b) => b.score - a.score).findIndex((p) => p.id === me.id)
      return (
        <>
          <Note title={`${ordinal(rank + 1)} place`} text={`${me.score} points. Thanks for dreaming along.`} big />
          {v.party && <a className="btn primary big" href={`/join?code=${v.party}`}>Back to the party</a>}
        </>
      )
    }
  }
  return null
}

function Tell({ v, pick, setPick, act }) {
  const [clue, setClue] = useState("")
  return (
    <>
      <Note title="You're the storyteller." text="Pick a card, then give a clue: a word, a phrase, a quote, a sound. Not too obvious, not too obscure." />
      <Hand cards={v.me.hand} pick={pick} setPick={setPick} />
      {pick != null && (
        <Sheet card={pick} onClose={() => setPick(null)}>
          <form
            className="tell"
            onSubmit={(e) => {
              e.preventDefault()
              act("tell", { card: pick, clue })
            }}
          >
            {v.config.customClues ? (
              <input value={clue} onChange={(e) => setClue(e.target.value)} maxLength={80} placeholder="Your clue" aria-label="Your clue" autoFocus required />
            ) : (
              <div className="prompts" role="radiogroup" aria-label="Pick a clue">
                {v.me.prompts.map((p) => (
                  <button type="button" key={p} role="radio" aria-checked={clue === p} className={`btn${clue === p ? " primary" : ""}`} onClick={() => setClue(p)}>{p}</button>
                ))}
              </div>
            )}
            <button className="btn primary big" disabled={!clue.trim()}>Tell</button>
          </form>
        </Sheet>
      )}
    </>
  )
}

function Hand({ cards, pick, setPick }) {
  return (
    <div className="hand">
      {cards.map((c) => <Card key={c} id={c} selected={pick === c} onClick={setPick ? () => setPick(c) : undefined} label="A card from your hand" />)}
    </div>
  )
}

/** The chosen card, big, with the one thing you can do with it. */
function Sheet({ card, onClose, action, onAction, children }) {
  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label="Chosen card">
      <button className="sheet-close" onClick={onClose} aria-label="Choose another">✕</button>
      <Card id={card} className="sheet-card" />
      {children ?? <button className="btn primary big" onClick={onAction}>{action}</button>}
    </div>
  )
}

const ClueBar = ({ clue, who }) => <p className="clue-bar">“{clue}” <span>{who}</span></p>
const Note = ({ title, text, big }) => (
  <section className={`phone-card${big ? " big" : ""}`}>
    <h2>{title}</h2>
    <p>{text}</p>
  </section>
)
const Played = ({ card, text, small }) => (
  <section className="played">
    <Card id={card} className={small ? "small" : ""} />
    <p className="hint center-text">{text}</p>
  </section>
)
