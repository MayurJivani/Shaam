import { cardSrc } from "../../lib/cardArt.js"

/** One illustrated card, or its back when id is null. Children render as an overlay (numbers, owners, votes). */
export function Card({ id, onClick, selected, disabled, className = "", children, style, label }) {
  const Tag = onClick ? "button" : "div"
  return (
    <Tag
      className={`card${id == null ? " back" : ""}${selected ? " selected" : ""}${disabled ? " disabled" : ""} ${className}`}
      onClick={disabled ? undefined : onClick}
      disabled={onClick ? disabled : undefined}
      style={style}
      aria-label={label}
      aria-pressed={onClick ? !!selected : undefined}
    >
      {id != null && <img src={cardSrc(id)} alt="" draggable="false" />}
      {children}
    </Tag>
  )
}
