// Lettre de motivation assortie au CV : même en-tête, mêmes couleurs.
#import "theme.typ": *

#let data = json(bytes(sys.inputs.data))

#set document(title: data.subject, author: data.signature)
#set page(paper: "a4", margin: (x: 2.2cm, top: 1.8cm, bottom: 2cm), fill: page-fill)
#set text(font: fonts-for(data), size: 11pt, fill: ink, lang: data.language)
#set par(leading: 0.68em)

#{
  let contact = data.at("contact", default: ())
  if contact.len() > 0 {
    header(data.sender.at(0), data.at("headline", default: none), contact)
  } else {
    // Lettres créées avant cet en-tête : l'expéditeur reste une liste de lignes.
    block(below: 0.6em)[
      #text(size: 16pt, weight: "bold", data.sender.at(0)) \
      #data.sender.slice(1).join(linebreak())
    ]
  }
}
#v(0.9em)
#rule()
#v(1.2em)

#align(right)[
  #if data.recipient.len() > 0 [
    *#data.recipient.at(0)* \
    #data.recipient.slice(1).join(linebreak())
  ]
  #v(0.8em)
  #text(fill: muted, data.place_date)
]

#v(1.2em)
#text(weight: "bold")[#if data.language == "en" [Subject] else [Objet] : #data.subject]
#v(0.9em)

#{
  let parts = (data.greeting, ..data.paragraphs, data.closing)
  for (i, part) in parts.enumerate() {
    if i > 0 { v(0.85em) }
    par(part)
  }
}

#v(1.4em)
#align(right, strong(data.signature))
