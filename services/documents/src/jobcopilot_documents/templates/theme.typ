// Identité commune au CV et à la lettre : couleurs, contact, titres de section.
#let ink = rgb("#1F1F1F")
#let muted = rgb("#5F5F5F")
#let gold = rgb("#FFC412")
#let hairline = rgb("#DDDDDD")

#let icons = (
  location: "icons/map-pin.svg",
  phone: "icons/phone.svg",
  email: "icons/mail.svg",
  github: "icons/github.svg",
  linkedin: "icons/linkedin.svg",
  link: "icons/link.svg",
  licence: "icons/car.svg",
  birth: "icons/cake.svg",
  nationality: "icons/flag.svg",
)

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
