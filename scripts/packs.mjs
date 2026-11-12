/**
 * Builds Reverie's picture packs from public-domain works in The Met's open
 * collection (CC0). Run once by hand; it writes public/packs/<slug>/<n>.jpg and
 * shared/packs.js, both committed, so the game never depends on the Met at play time.
 *
 *   node scripts/packs.mjs            # build missing packs, keep finished ones
 *   node scripts/packs.mjs ukiyo      # also rebuild this one
 *
 * Needs ImageMagick (`magick`) to crop every work to a 2:3 card.
 */
import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"

const API = "https://collectionapi.metmuseum.org/public/collection"
const PER_PACK = 96
const PER_QUERY = 16 // no artist dominates a pack, so cards stay tellable apart
const KEEP = /print|drawing|painting|woodblock/i
// Text-heavy objects make bad cards: the picture has to carry the clue.
const DROP = /letter|book|binding|cover|title|journal|frontispiece|newspaper|periodical|manuscript|sketchbook|text|caricature|portrait of|advertisement/i

const PACKS = [
  { slug: "visions", name: "Visions", blurb: "Symbolists and visionaries: Redon, Blake, Goya, Bosch, Moreau.", q: ["Odilon Redon", "William Blake", "Goya Caprichos", "Goya Disparates", "Hieronymus Bosch", "Gustave Moreau", "Max Klinger", "Henry Fuseli", "Arnold Böcklin", "James Ensor"] },
  { slug: "ukiyo", name: "Floating World", blurb: "Japanese woodblock prints: ghosts, waves, foxes and moonlight.", q: ["Kuniyoshi", "Yoshitoshi", "Hokusai", "Hiroshige", "Kyosai", "yokai", "ghost print Japan"] },
  { slug: "curiosities", name: "Cabinet of Curiosities", blurb: "Odd creatures, insects, devils and living flowers from old prints.", q: ["Grandville Un Autre Monde", "Grandville Fleurs animées", "Maria Sibylla Merian", "Albertus Seba", "Jacques Callot temptation", "Wenceslaus Hollar insects", "Jacques de Gheyn", "fantastic animal print", "Martin Schongauer"] },
  { slug: "lost-worlds", name: "Lost Worlds", blurb: "Ruins, abysses, storms and impossible cities.", q: ["Gustave Doré", "Piranesi", "John Martin", "Hubert Robert", "Thomas Cole", "Caspar David Friedrich", "Turner", "Charles Meryon", "Hercules Segers", "Claude Lorrain"] },
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function json(url) {
  for (let i = 0; i < 4; i++) {
    const r = await fetch(url).catch(() => null)
    if (r?.ok) return r.json()
    await sleep(1500 * (i + 1)) // the Met rate-limits bursts
  }
  return null
}

async function build(pack, root, force) {
  const dir = path.join(root, "public/packs", pack.slug)
  const done = path.join(dir, "credits.json")
  if (!force && existsSync(done)) return { slug: pack.slug, name: pack.name, blurb: pack.blurb, ...JSON.parse(readFileSync(done, "utf8")) }
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  const seen = new Set()
  const cards = []
  const titles = new Set()
  for (const q of pack.q) {
    const hits = await json(`${API}/v1.1/search?hasImages=true&isPublicDomain=true&q=${encodeURIComponent(q)}`)
    let taken = 0
    for (const id of (hits?.objectIDs ?? []).slice(0, 80)) {
      if (cards.length >= PER_PACK || taken >= PER_QUERY) break
      if (seen.has(id)) continue
      seen.add(id)
      const o = await json(`${API}/v1/objects/${id}`)
      if (!o?.isPublicDomain || !o.primaryImageSmall || !KEEP.test(`${o.classification} ${o.objectName}`)) continue
      if (DROP.test(`${o.title} ${o.objectName} ${o.classification}`) || titles.has(o.title)) continue
      const file = path.join(dir, `${cards.length}.jpg`)
      try {
        const img = await fetch(o.primaryImageSmall)
        if (!img.ok) continue
        writeFileSync(file, Buffer.from(await img.arrayBuffer()))
        execFileSync("magick", [file, "-auto-orient", "-resize", "480x720^", "-gravity", "center", "-extent", "480x720", "-strip", "-quality", "76", file])
        // A near-flat crop is a blank margin or an empty page, not a picture.
        if (Number(execFileSync("magick", [file, "-colorspace", "Gray", "-format", "%[fx:standard_deviation]", "info:"])) < 0.09) throw 0
      } catch {
        rmSync(file, { force: true })
        continue
      }
      titles.add(o.title)
      taken++
      cards.push({ title: o.title.slice(0, 120), artist: o.artistDisplayName || "Unknown", url: o.objectURL })
      process.stdout.write(`\r${pack.slug}: ${cards.length}/${PER_PACK}`)
    }
    if (cards.length >= PER_PACK) break
  }
  console.log()
  // Written last, so a run cut short rebuilds this pack and a finished one is kept on the next run.
  writeFileSync(done, JSON.stringify({ count: cards.length, credits: cards }))
  return { slug: pack.slug, name: pack.name, blurb: pack.blurb, count: cards.length, credits: cards }
}

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..")
const only = process.argv[2] // rebuild just this pack; finished packs are otherwise kept
const out = []
for (const p of PACKS) out.push(await build(p, root, p.slug === only))
const packs = out.filter((p) => p.count >= 40)
writeFileSync(
  path.join(root, "shared/packs.js"),
  `// Generated by scripts/packs.mjs from The Met's public-domain (CC0) collection. Do not edit by hand.\n` +
    `// "dream" is the pack drawn in code (src/lib/cardArt.js); the rest are photos in public/packs/<slug>/.\n` +
    `export const DREAM = { slug: "dream", name: "Dreamscapes", blurb: "Original surreal scenes, drawn in code.", count: 240 }\n` +
    `export const PACKS = ${JSON.stringify(packs, null, 1)}\n` +
    `export const ALL_PACKS = [DREAM, ...PACKS]\n` +
    `export const packBySlug = (slug) => ALL_PACKS.find((p) => p.slug === slug) ?? DREAM\n`,
)
console.log(packs.map((p) => `${p.slug} ${p.count}`).join("\n"))
