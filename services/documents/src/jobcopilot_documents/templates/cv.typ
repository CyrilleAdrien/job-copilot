// CV « classique » : une colonne, en-tête centré, titres de section bleus soulignés,
// compétences par catégorie, missions groupées par thème.
#let data = json(bytes(sys.inputs.data))
#let blue = rgb("#1f4e79")
#let labels = if data.language == "en" {
  (profile: "Profile", skills: "Technical skills", experience: "Professional experience",
   education: "Education", extras: "Soft skills, languages and interests")
} else {
  (profile: "Profil", skills: "Compétences techniques", experience: "Expérience professionnelle",
   education: "Formation", extras: "Savoir-être, langues et intérêts")
}

#set document(title: data.name + " - CV", author: data.name)
#set page(paper: "a4", margin: (x: 1.5cm, top: 1.1cm, bottom: 1cm))
#set text(font: "Carlito", size: 10pt, lang: data.language)
#set par(justify: true, leading: 0.55em, spacing: 0.65em)
#set list(indent: 0.35em, body-indent: 0.5em, spacing: 0.6em, marker: text(size: 7pt, baseline: -0.1em)[●])

#let section(title) = {
  v(0.9em)
  block(below: 0.45em, stroke: (bottom: 0.7pt + blue), inset: (bottom: 2.5pt), width: 100%)[
    #text(fill: blue, weight: "bold", size: 10.5pt, upper(title))
  ]
}
#let sep = h(0.5em) + text(fill: luma(140))[|] + h(0.5em)

#align(center)[
  #text(size: 19pt, weight: "bold", fill: blue, upper(data.name)) \
  #v(-0.2em)
  #text(size: 12pt, weight: "bold", data.headline) \
  #v(0.15em)
  #text(size: 9pt)[
    #data.contact.map(item => if item.url != none { link(item.url, item.text) } else { item.text }).join(sep) \
    #{
      let parts = data.details
      if data.highlight != none { parts.push(strong(data.highlight)) }
      parts.join(sep)
    }
  ]
]

#if data.summary != none and data.summary != "" [
  #section(labels.profile)
  #data.summary
]

#if data.skills.len() > 0 [
  #section(labels.skills)
  #for category in data.skills [
    - *#category.name :* #category.items.join(", ")
  ]
]

#if data.experiences.len() > 0 [
  #section(labels.experience)
  #for (i, exp) in data.experiences.enumerate() [
    #if i > 0 { v(0.5em) }
    #block(below: 0.35em)[
      *#exp.title* #sep #text(fill: blue, weight: "bold", exp.company) \
      #text(style: "italic")[#{ (exp.location, exp.period).filter(x => x != none).join(sep) }]
      #if exp.context != none and exp.context != "" [ \ #emph(exp.context) ]
    ]
    #for group in exp.groups [
      #if group.title != none [
        #block(above: 0.5em, below: 0.35em, text(fill: blue, weight: "bold", style: "italic", group.title))
      ]
      #for bullet in group.bullets [
        - #bullet
      ]
    ]
  ]
]

#if data.education.len() > 0 [
  #section(labels.education)
  #for item in data.education [
    #{
      let parts = (strong(item.degree), item.school)
      if item.year != none { parts.push(str(item.year)) }
      parts.join(sep)
    } \
  ]
]

#for part in data.sections [
  #section(part.title)
  #for entry in part.entries [
    - #{
        let title = if entry.url != none { link(entry.url, strong(entry.title)) } else { strong(entry.title) }
        (title, ..entry.meta).join(sep)
      }
      #if entry.text != none and entry.text != "" [ \ #entry.text ]
  ]
]

#if data.extras.len() > 0 [
  #section(labels.extras)
  #for line in data.extras [
    - *#line.label :* #line.text
  ]
]
