// Lettre de motivation assortie au CV « classique ».
#let data = json(bytes(sys.inputs.data))
#let blue = rgb("#1f4e79")

#set document(title: data.subject, author: data.signature)
#set page(paper: "a4", margin: (x: 2.2cm, top: 2cm, bottom: 2cm))
#set text(font: "Carlito", size: 11pt, lang: data.language)
#set par(justify: true, leading: 0.7em)

#block(below: 1.5em)[
  #text(size: 14pt, weight: "bold", fill: blue, data.sender.at(0)) \
  #data.sender.slice(1).join(linebreak())
]

#align(right)[
  #if data.recipient.len() > 0 [
    *#data.recipient.at(0)* \
    #data.recipient.slice(1).join(linebreak())
  ]
  #v(1em)
  #data.place_date
]

#v(1.5em)
#block(stroke: (bottom: 0.7pt + blue), inset: (bottom: 3pt))[
  #text(weight: "bold", fill: blue)[#if data.language == "en" [Subject] else [Objet] : #data.subject]
]
#v(1em)

#{
  let parts = (data.greeting, ..data.paragraphs, data.closing)
  for (i, part) in parts.enumerate() {
    if i > 0 { v(0.9em) }
    par(part)
  }
}

#v(1.5em)
#align(right, strong(data.signature))
