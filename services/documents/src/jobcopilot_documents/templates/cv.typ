// CV sur une colonne. Le contenu vient du service, ce fichier ne décide que de la mise en page.
#import "theme.typ": *

#let data = json(bytes(sys.inputs.data))
#let photo = if "photo" in sys.inputs { bytes(json(bytes(sys.inputs.photo))) } else { none }
#let labels = if data.language == "en" {
  (profile: "Profile", skills: "Skills", experience: "Professional experience",
   education: "Education", extras: "Additional information", available: "Availability")
} else {
  (profile: "Profil", skills: "Compétences", experience: "Expérience professionnelle",
   education: "Formation", extras: "Informations complémentaires", available: "Disponibilité")
}
// Le nom choisi par la personne, sinon le nom par défaut.
#let title-of(key) = data.at("titles", default: (:)).at(key, default: labels.at(key))

#set document(title: data.name + " - CV", author: data.name)
#set page(paper: "a4", margin: (x: 1.6cm, top: 1.3cm, bottom: 1.2cm))
#set text(font: "Carlito", size: 10pt, fill: ink, lang: data.language)
#set par(leading: 0.5em, spacing: 0.6em)
#set list(indent: 0.2em, body-indent: 0.5em, spacing: 0.5em, marker: text(fill: gold, size: 8pt, baseline: -0.05em)[●])

#let sep = text(fill: muted)[ · ]
#let secondary(body) = text(fill: muted, body)
// Une ligne avec les dates à droite.
#let line-with-date(left, right) = grid(columns: (1fr, auto), column-gutter: 1em, left, secondary(right))

#{
  let notes = data.details
  if data.highlight != none { notes.push(labels.available + " : " + data.highlight) }
  header(
    data.name,
    data.headline,
    data.contact,
    photo: if data.at("show_photo", default: false) { photo },
    note: if notes.len() > 0 { notes.join(" · ") },
  )
}

// Chaque rubrique est une fonction : `order` décide de leur place, sans changer leur rendu.
#let profile-block() = if data.summary != none and data.summary != "" [
  #section(title-of("profile"))
  #for part in data.summary.split("\n").filter(x => x.trim() != "") {
    par(part)
  }
]

#let skills-block() = if data.skills.len() > 0 [
  #section(title-of("skills"))
  #for category in data.skills {
    block(above: 0.5em, below: 0.5em)[*#category.name :* #category.items.join(", ")]
  }
]

#let experience-block() = if data.experiences.len() > 0 [
  #section(title-of("experience"))
  #for (i, exp) in data.experiences.enumerate() {
    if i > 0 { v(0.7em) }
    block(sticky: true, below: 0.5em, stack(
      spacing: 5pt,
      line-with-date(strong(exp.title), exp.period),
      secondary((exp.company, exp.location).filter(x => x != none).join(" · ")),
    ))
    if exp.context != none and exp.context != "" {
      block(above: 0.5em, below: 0.5em, exp.context)
    }
    for group in exp.groups {
      if group.title != none {
        block(sticky: true, above: 0.9em, below: 0.5em, text(weight: "bold", group.title))
      }
      for bullet in group.bullets [
        - #bullet
      ]
    }
  }
]

#let education-block() = if data.education.len() > 0 [
  #section(title-of("education"))
  #for item in data.education {
    let when = item.at("period", default: none)
    if when == none and item.year != none { when = str(item.year) }
    let details = item.at("details", default: none)
    let lines = (
      line-with-date(strong(item.degree), if when != none { when } else { "" }),
      secondary((item.school, item.at("location", default: none)).filter(x => x != none).join(" · ")),
    )
    if details != none and details != "" { lines.push(par(details)) }
    block(above: 0.7em, below: 0.7em, breakable: false, stack(spacing: 5pt, ..lines))
  }
]

#let other-block(part) = [
  #section(part.title)
  #for entry in part.entries {
    block(above: 0.6em, below: 0.6em, breakable: false, {
      let title = if entry.url != none { link(entry.url, strong(entry.title)) } else { strong(entry.title) }
      (title, ..entry.meta.map(secondary)).join(sep)
      if entry.text != none and entry.text != "" { block(above: 0.45em, below: 0pt, entry.text) }
    })
  }
  #for bullet in part.at("bullets", default: ()) [
    - #bullet
  ]
]

#let extras-block() = if data.extras.len() > 0 [
  #section(title-of("extras"))
  #for line in data.extras {
    block(above: 0.5em, below: 0.5em)[*#line.label :* #line.text]
  }
]

#let main-blocks = (
  profile: profile-block,
  skills: skills-block,
  experience: experience-block,
  education: education-block,
  extras: extras-block,
)
// Les documents enregistrés avant le choix de l'ordre gardent l'ordre classique.
#let order = data.at("order", default: ())
#if order.len() == 0 {
  profile-block()
  skills-block()
  experience-block()
  education-block()
  for part in data.sections { other-block(part) }
  extras-block()
} else {
  for key in order {
    if key in main-blocks {
      main-blocks.at(key)()
    } else {
      for part in data.sections.filter(part => part.at("key", default: none) == key) {
        other-block(part)
      }
    }
  }
}
