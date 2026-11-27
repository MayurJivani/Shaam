import { useEffect, useState } from "react"
import { param, store, useRelay } from "../../lib/relay.js"
import { Avatar, JoinForm, Offline } from "../ui.jsx"
import { ROLE, WINNER } from "./UndercoverTV.jsx"

/** A player's phone: your word (tap to hide it from neighbours) and your vote. Clues are said out loud. */
export default function UndercoverPhone() {
  const [code, setCode] = useState(param("code"))
  const seatKey = `shaam.seat.${code}`
  const [v, setV] = useState(null)
  const [error, setError] = useState("")
  const [form, setForm] = useState(() => !code || (!store.get(`shaam.seat.${code}`) && !store.get("shaam.me")))
  const [shown, setShown] = useState(false)

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
  // A new deal starts hidden, so nobody glances at a neighbour's fresh word.
  useEffect(() => setShown(false), [v?.me?.word, v?.me?.mrWhite])

  if (form || !v?.me) {
    return (
      <main className="phone">
        <Offline status={status} />
        <h1 className="brand small">Undercover</h1>
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
  const act = (a, extra) => send({ t: "game.act", a, ...extra })
  return (
    <main className="phone">
      <Offline status={status} />
      <header className="me-bar">
        <Avatar i={me.avatar} size={40} />
        <span className="name">{me.name}</span>
        {v.phase === "over" && <span className="score">{me.score}</span>}
      </header>
      {error && <p className="error" role="alert" onClick={() => setError("")}>{error}</p>}
      {v.phase !== "lobby" && v.phase !== "over" && me.alive && (
        <button className="phone-card" onClick={() => setShown(!shown)} aria-pressed={shown}>
          <span className="hint">{shown ? "Tap to hide" : "Tap to see your word"}</span>
          {v.me.mrWhite ? (
            <span className={`word${shown ? "" : " hidden"}`}>Mr White</span>
          ) : (
            <span className={`word${shown ? "" : " hidden"}`}>{v.me.word}</span>
          )}
          {shown && <span className="hint">{v.me.mrWhite ? "You have no word. Listen, blend in, and guess theirs." : "You might be a Civilian. You might not."}</span>}
        </button>
      )}
      <Body v={v} me={me} act={act} />
    </main>
  )
}

function Body({ v, me, act }) {
  if (v.phase === "lobby") return <Note title="You're in." text="Watch the TV. Words are dealt when the host starts." />
  if (v.phase === "over") {
    return (
      <>
        <Note title={WINNER[v.winner]} text={`You were ${ROLE[me.role]}. Civilians: ${v.words.civilian}. Undercovers: ${v.words.undercover}.`} big />
        {v.party && <a className="btn primary big" href={`/join?code=${v.party}`}>Back to the party</a>}
      </>
    )
  }
  if (!me.alive) {
    if (v.phase === "guess" && v.last?.out === me.id) return <Guess act={act} />
    return <Note title={`You're out, ${ROLE[me.role]}.`} text="Keep quiet and enjoy watching the rest squirm." />
  }
  if (v.phase === "describe") {
    const turn = v.order.indexOf(me.id) + 1
    return <Note title={`You speak ${turn === 1 ? "first" : `#${turn}`}`} text="Say one clue about your word out loud when it's your turn. Then the host opens the vote." />
  }
  if (v.phase === "guess") return <Note title="Mr White is guessing" text="Hold your breath." />
  if (v.me.vote) return <Note title={`Voted: ${v.players.find((p) => p.id === v.me.vote)?.name}`} text="Waiting for the others." />
  const options = v.players.filter((p) => p.alive && p.id !== me.id && (!v.runoff || v.runoff.includes(p.id)))
  return (
    <section className="phone-card">
      <h2>{v.runoff ? "Re-vote: who goes?" : "Who goes?"}</h2>
      <div className="vote-list">
        {options.map((p) => (
          <button key={p.id} className="btn" onClick={() => act("vote", { target: p.id })}>
            <Avatar i={p.avatar} size={32} /> {p.name}
          </button>
        ))}
      </div>
    </section>
  )
}

function Guess({ act }) {
  const [word, setWord] = useState("")
  return (
    <section className="phone-card">
      <h2>Caught! Guess their word.</h2>
      <form className="guess" onSubmit={(e) => { e.preventDefault(); act("guess", { word }) }}>
        <input value={word} onChange={(e) => setWord(e.target.value)} maxLength={40} placeholder="The Civilians' word" aria-label="Your guess" autoFocus required />
        <button className="btn primary big" disabled={!word.trim()}>Guess</button>
      </form>
    </section>
  )
}

const Note = ({ title, text, big }) => (
  <section className={`phone-card${big ? " big" : ""}`}>
    <h2>{title}</h2>
    <p>{text}</p>
  </section>
)
