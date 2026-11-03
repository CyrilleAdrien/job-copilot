// Identité commune au CV et à la lettre : couleurs, contact, titres de section.
#let ink = rgb("#1F1F1F")
#let muted = rgb("#5F5F5F")
#let gold = rgb("#FFC412")
#let hairline = rgb("#DDDDDD")

#let icons = (
  location: "icons/map-pin.svg",
  address: "icons/map-pin.svg",
  phone: "icons/phone.svg",
  email: "icons/mail.svg",
  github: "icons/github.svg",
  linkedin: "icons/linkedin.svg",
  link: "icons/link.svg",
  licence: "icons/car.svg",
  birth: "icons/cake.svg",
  nationality: "icons/flag.svg",
)

// La police choisie, Carlito pour tout caractère qu'elle n'aurait pas.
#let fonts-for(data) = {
  let chosen = data.at("font", default: none)
  if chosen == none { ("Carlito",) } else { (chosen, "Carlito") }
}

// Le texte enrichi : **gras**, *italique*, __souligné__. Mêmes règles que rich.py et rich-text.ts.
#let rich-tokens(value) = {
  let chars = value.clusters()
  let size = chars.len()
  let out = ()
  let italic = false
  let under = false
  let i = 0
  let blank(c) = c.trim() == ""
  // Une fonction Typst garde une copie de ses variables : la position lui est passée à chaque appel.
  let mark-at(at, opened, width) = if opened {
    at > 0 and not blank(chars.at(at - 1))
  } else {
    at + width < size and not blank(chars.at(at + width))
  }
  while i < size {
    let c = chars.at(i)
    let next = if i + 1 < size { chars.at(i + 1) } else { "" }
    if c == "\\" and next != "" and next in "*_\\-.0123456789" {
      out.push(("text", next))
      i += 2
    } else if c == "*" and next == "*" {
      out.push(("bold", "**"))
      i += 2
    } else if c == "_" and next == "_" and mark-at(i, under, 2) {
      under = not under
      out.push(("under", "__"))
      i += 2
    } else if c == "*" and mark-at(i, italic, 1) {
      italic = not italic
      out.push(("italic", "*"))
      i += 1
    } else {
      out.push(("text", c))
      i += 1
    }
  }
  out
}

// Une ligne avec ses styles. Une marque sans sa paire redevient du texte.
#let rich(value) = {
  let parsed = rich-tokens(value)
  let paired(kind) = calc.even(parsed.filter(t => t.at(0) == kind).len())
  let toggles = (bold: paired("bold"), italic: paired("italic"), under: paired("under"))
  let state = (bold: false, italic: false, under: false)
  let result = []
  let buffer = ""
  let styled(body, style) = {
    let c = [#body]
    if style.italic { c = emph(c) }
    if style.bold { c = strong(c) }
    if style.under { c = underline(c) }
    c
  }
  for (kind, piece) in parsed {
    if kind != "text" and toggles.at(kind) {
      if buffer != "" {
        result += styled(buffer, state)
        buffer = ""
      }
      state.insert(kind, not state.at(kind))
    } else {
      buffer += piece
    }
  }
  if buffer != "" { result += styled(buffer, state) }
  result
}

// Un texte sur plusieurs lignes : paragraphes, listes à puces (- ) et numérotées (1. ).
#let rich-block(value) = {
  let flush(kind, items) = if kind == "bullet" {
    list(..items.map(rich))
  } else if kind == "number" {
    enum(..items.map(rich))
  }
  let kind = none
  let items = ()
  for raw in value.split("\n") {
    let line = raw.trim()
    if line == "" { continue }
    let found = line.match(regex("^\\d+\\. "))
    let current = if line.starts-with("- ") { "bullet" } else if found != none { "number" } else { "text" }
    if current != kind {
      flush(kind, items)
      items = ()
      kind = current
    }
    if current == "text" {
      par(rich(line))
    } else if current == "bullet" {
      items.push(line.slice(2))
    } else {
      items.push(line.slice(found.end))
    }
  }
  flush(kind, items)
}

// Une coordonnée : son icône, puis son texte, cliquable s'il a une adresse.
#let contact-item(item) = {
  let kind = item.at("kind", default: none)
  let label = text(fill: ink, item.text)
  let body = if item.url != none { link(item.url, label) } else { label }
  box({
    if kind != none and kind in icons {
      box(height: 0.85em, baseline: 0.12em, image(icons.at(kind), height: 100%))
      h(0.35em)
    }
    body
  })
}

#let contact-row(items) = items.map(contact-item).join(h(1em))

// Trait de séparation : une amorce dorée, puis un filet.
#let rule() = grid(
  columns: (1.8em, 1fr),
  align: bottom,
  rect(width: 100%, height: 1.5pt, fill: gold, stroke: none),
  rect(width: 100%, height: 0.5pt, fill: hairline, stroke: none),
)

// Le nom, le titre et les coordonnées. La photo est facultative.
#let header(name, headline, contact, photo: none, note: none) = {
  let lines = (text(size: 23pt, weight: "bold", fill: ink, name),)
  if headline != none { lines.push(text(size: 12.5pt, fill: muted, headline)) }
  if contact.len() > 0 { lines.push(text(size: 9pt, contact-row(contact))) }
  if note != none { lines.push(text(size: 9pt, fill: muted, note)) }
  let identity = stack(spacing: 8pt, ..lines)
  if photo == none {
    identity
  } else {
    grid(
      columns: (auto, 1fr),
      column-gutter: 1.2em,
      align: horizon,
      box(width: 2.5cm, height: 2.5cm, radius: 50%, clip: true, stroke: 1.5pt + gold,
        image(photo, width: 100%, height: 100%, fit: "cover")),
      identity,
    )
  }
}

#let section(title) = {
  block(sticky: true, above: 1.5em, below: 0.7em, stack(
    spacing: 5pt,
    text(size: 10.5pt, weight: "bold", fill: ink, tracking: 0.04em, upper(title)),
    rule(),
  ))
}
