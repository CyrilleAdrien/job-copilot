"""Version Word des documents : le même contenu que le PDF, modifiable dans un traitement de texte.

Le fichier reprend la structure et les couleurs du template, sans les icônes de contact. Il
nomme la police choisie : Word la remplace si elle n'est pas installée sur l'ordinateur.
"""

from io import BytesIO

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_TAB_ALIGNMENT
from docx.image.exceptions import UnrecognizedImageError
from docx.opc.constants import RELATIONSHIP_TYPE
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor
from docx.table import _Cell
from docx.text.paragraph import Paragraph

from jobcopilot_documents.compose import visible_cv
from jobcopilot_documents.schemas import FONTS, ContactItem, CvContent, CvSection, LetterContent

CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
DEFAULT_FONT = "Calibri"
INK = RGBColor(0x1F, 0x1F, 0x1F)
MUTED = RGBColor(0x5F, 0x5F, 0x5F)
GOLD = "FFC412"
SAFE_LINKS = ("http://", "https://", "mailto:", "tel:")
LABELS = {
    "fr": {
        "profile": "Profil",
        "skills": "Compétences",
        "experience": "Expérience professionnelle",
        "education": "Formation",
        "extras": "Informations complémentaires",
        "available": "Disponibilité",
        "subject": "Objet",
    },
    "en": {
        "profile": "Profile",
        "skills": "Skills",
        "experience": "Professional experience",
        "education": "Education",
        "extras": "Additional information",
        "available": "Availability",
        "subject": "Subject",
    },
}


def set_style_font(
    style, size: float, font: str = DEFAULT_FONT, *, bold: bool = False, color: RGBColor = INK
) -> None:
    """Fixe la police du style. Les attributs de thème du modèle Word l'emporteraient sinon."""
    style.font.name = font
    style.font.size = Pt(size)
    style.font.bold = bold
    style.font.italic = False
    style.font.color.rgb = color
    fonts = style.element.get_or_add_rPr().get_or_add_rFonts()
    for attribute in ("asciiTheme", "hAnsiTheme", "eastAsiaTheme", "cstheme"):
        fonts.attrib.pop(qn(f"w:{attribute}"), None)
    for attribute in ("ascii", "hAnsi", "eastAsia", "cs"):
        fonts.set(qn(f"w:{attribute}"), font)


def new_document(
    title: str, author: str, language: str, margin_x: float, size: float, chosen: str | None = None
):
    font = FONTS.get(chosen, DEFAULT_FONT)
    document = Document()
    properties = document.core_properties
    properties.title, properties.author, properties.last_modified_by = title, author, author
    properties.comments = ""
    properties.language = language
    section = document.sections[0]
    section.page_width, section.page_height = Cm(21), Cm(29.7)
    section.left_margin = section.right_margin = Cm(margin_x)
    section.top_margin, section.bottom_margin = Cm(1.3), Cm(1.2)

    styles = document.styles
    set_style_font(styles["Normal"], size, font)
    styles["Normal"].paragraph_format.space_after = Pt(3)
    styles["Normal"].paragraph_format.space_before = Pt(0)
    styles["Normal"].paragraph_format.line_spacing = 1.05
    # Des titres Word : le plan du document reste lisible par les logiciels de tri de CV.
    set_style_font(styles["Heading 1"], 23, font, bold=True)
    styles["Heading 1"].paragraph_format.space_before = Pt(0)
    styles["Heading 1"].paragraph_format.space_after = Pt(2)
    set_style_font(styles["Heading 2"], 10.5, font, bold=True)
    styles["Heading 2"].font.all_caps = True
    styles["Heading 2"].paragraph_format.space_before = Pt(11)
    styles["Heading 2"].paragraph_format.space_after = Pt(5)
    set_style_font(styles["List Bullet"], size, font)
    styles["List Bullet"].paragraph_format.space_after = Pt(2)
    return document


def add_link(
    paragraph: Paragraph, text: str, url: str, size: float | None = None, *, bold: bool = False
) -> None:
    run = paragraph.add_run(text)
    run.bold = bold or None
    if size:
        run.font.size = Pt(size)
    if not url.lower().startswith(SAFE_LINKS):
        return
    relation = paragraph.part.relate_to(url, RELATIONSHIP_TYPE.HYPERLINK, is_external=True)
    link = OxmlElement("w:hyperlink")
    link.set(qn("r:id"), relation)
    paragraph._p.remove(run._r)
    link.append(run._r)
    paragraph._p.append(link)


def add_rule(paragraph: Paragraph, color: str = GOLD) -> None:
    """Le trait sous un titre : le filet doré du template, sur toute la largeur."""
    border = OxmlElement("w:bottom")
    for name, value in (("val", "single"), ("sz", "6"), ("space", "3"), ("color", color)):
        border.set(qn(f"w:{name}"), value)
    borders = OxmlElement("w:pBdr")
    borders.append(border)
    properties = paragraph._p.get_or_add_pPr()
    properties.insert_element_before(
        borders,
        "w:shd", "w:tabs", "w:suppressAutoHyphens", "w:kinsoku", "w:wordWrap",
        "w:overflowPunct", "w:topLinePunct", "w:autoSpaceDE", "w:autoSpaceDN", "w:bidi",
        "w:adjustRightInd", "w:snapToGrid", "w:spacing", "w:ind", "w:contextualSpacing",
        "w:mirrorIndents", "w:suppressOverlap", "w:jc", "w:textDirection", "w:textAlignment",
        "w:textboxTightWrap", "w:outlineLvl", "w:divId", "w:cnfStyle", "w:rPr", "w:sectPr",
        "w:pPrChange",
    )  # fmt: skip


def add_section(document, title: str) -> None:
    add_rule(document.add_paragraph(title, style="Heading 2"))


def add_muted(paragraph: Paragraph, text: str, size: float | None = None) -> None:
    run = paragraph.add_run(text)
    run.font.color.rgb = MUTED
    if size:
        run.font.size = Pt(size)


def add_contact(paragraph: Paragraph, items: list[ContactItem]) -> None:
    for index, item in enumerate(items):
        if index:
            add_muted(paragraph, "  ·  ", 9)
        if item.url:
            add_link(paragraph, item.text, item.url, 9)
        else:
            paragraph.add_run(item.text).font.size = Pt(9)


def add_identity(container, name: str, headline, contact, note: str | None = None) -> None:
    """Remplit `container`, le document ou la cellule à côté de la photo."""
    # Une cellule neuve contient déjà un paragraphe vide : il sert de première ligne.
    cell = isinstance(container, _Cell)
    first = container.paragraphs[0] if cell else container.add_paragraph()
    first.style = "Heading 1"
    first.add_run(name)
    if headline:
        add_muted(container.add_paragraph(), headline, 12.5)
    if contact:
        add_contact(container.add_paragraph(), contact)
    if note:
        add_muted(container.add_paragraph(), note, 9)


def round_picture(run) -> None:
    """La photo est carrée : Word la recadre en cercle, comme le template."""
    for geometry in run._r.iter(qn("a:prstGeom")):
        geometry.set("prst", "ellipse")


def add_cv_header(document, cv: CvContent, photo: bytes | None, note: str | None) -> None:
    if not (photo and cv.show_photo):
        add_identity(document, cv.name, cv.headline, cv.contact, note)
        return
    table = document.add_table(rows=1, cols=2)
    table.autofit = False
    image_cell, text_cell = table.rows[0].cells
    image_cell.width, text_cell.width = Cm(3), Cm(14.8)
    try:
        run = image_cell.paragraphs[0].add_run()
        run.add_picture(BytesIO(photo), width=Cm(2.5))
        round_picture(run)
    except UnrecognizedImageError:
        pass
    add_identity(text_cell, cv.name, cv.headline, cv.contact, note)


def line_with_date(document, title: str, when: str | None, width: float) -> None:
    paragraph = document.add_paragraph()
    paragraph.paragraph_format.keep_with_next = True
    paragraph.paragraph_format.space_after = Pt(0)
    paragraph.add_run(title).bold = True
    if when:
        paragraph.paragraph_format.tab_stops.add_tab_stop(Cm(width), WD_TAB_ALIGNMENT.RIGHT)
        add_muted(paragraph, f"\t{when}")


def add_rich(paragraph: Paragraph, text: str) -> Paragraph:
    """Le gras posé dans l'éditeur : **ainsi**. Un ** isolé reste du texte."""
    parts = text.split("**")
    if len(parts) % 2 == 0:
        parts = [text]
    for index, part in enumerate(parts):
        if part:
            paragraph.add_run(part).bold = True if index % 2 else None
    return paragraph


def labeled(document, label: str, text: str) -> None:
    paragraph = document.add_paragraph()
    paragraph.add_run(f"{label} : ").bold = True
    add_rich(paragraph, text)


def to_bytes(document) -> bytes:
    buffer = BytesIO()
    document.save(buffer)
    return buffer.getvalue()


def add_profile(document, cv: CvContent, title: str, _width: float) -> None:
    if not cv.summary:
        return
    add_section(document, title)
    for part in cv.summary.split("\n"):
        if part.strip():
            add_rich(document.add_paragraph(), part.strip())


def add_skills(document, cv: CvContent, title: str, _width: float) -> None:
    if not cv.skills:
        return
    add_section(document, title)
    for category in cv.skills:
        labeled(document, category.name, ", ".join(category.items))


def add_experience(document, cv: CvContent, title: str, width: float) -> None:
    if not cv.experiences:
        return
    add_section(document, title)
    for experience in cv.experiences:
        line_with_date(document, experience.title, experience.period, width)
        where = document.add_paragraph()
        where.paragraph_format.keep_with_next = True
        parts = [experience.company, experience.location]
        add_muted(where, " · ".join(part for part in parts if part))
        if experience.context:
            add_rich(document.add_paragraph(), experience.context)
        for group in experience.groups:
            if group.title:
                heading = document.add_paragraph()
                heading.paragraph_format.keep_with_next = True
                heading.paragraph_format.space_before = Pt(6)
                heading.add_run(group.title).bold = True
            for bullet in group.bullets:
                add_rich(document.add_paragraph(style="List Bullet"), bullet)


def add_education(document, cv: CvContent, title: str, width: float) -> None:
    if not cv.education:
        return
    add_section(document, title)
    for item in cv.education:
        when = item.period or (str(item.year) if item.year else None)
        line_with_date(document, item.degree, when, width)
        add_muted(
            document.add_paragraph(),
            " · ".join(part for part in (item.school, item.location) if part),
        )
        if item.details:
            add_rich(document.add_paragraph(), item.details)


def add_extras(document, cv: CvContent, title: str, _width: float) -> None:
    if not cv.extras:
        return
    add_section(document, title)
    for line in cv.extras:
        labeled(document, line.label, line.text)


MAIN_BLOCKS = {
    "profile": add_profile,
    "skills": add_skills,
    "experience": add_experience,
    "education": add_education,
    "extras": add_extras,
}


def add_other_section(document, section: CvSection) -> None:
    add_section(document, section.title)
    for entry in section.entries:
        paragraph = document.add_paragraph()
        if entry.url:
            add_link(paragraph, entry.title, entry.url, bold=True)
        else:
            paragraph.add_run(entry.title).bold = True
        if entry.meta:
            add_muted(paragraph, " · " + " · ".join(entry.meta))
        if entry.text:
            add_rich(document.add_paragraph(), entry.text)
    for bullet in section.bullets:
        add_rich(document.add_paragraph(style="List Bullet"), bullet)


def cv_to_docx(cv: CvContent, photo: bytes | None = None) -> bytes:
    cv = visible_cv(cv)
    labels = LABELS[cv.language]
    width = 21 - 2 * 1.6
    document = new_document(f"{cv.name} - CV", cv.name, cv.language, 1.6, 10, cv.font)

    notes = list(cv.details)
    if cv.highlight:
        notes.append(f"{labels['available']} : {cv.highlight}")
    add_cv_header(document, cv, photo, " · ".join(notes) or None)

    def main_block(key: str) -> None:
        MAIN_BLOCKS[key](document, cv, cv.titles.get(key, labels[key]), width)

    if not cv.order:
        # Les documents enregistrés avant le choix de l'ordre gardent l'ordre classique.
        for key in ("profile", "skills", "experience", "education"):
            main_block(key)
        for section in cv.sections:
            add_other_section(document, section)
        main_block("extras")
        return to_bytes(document)

    for key in cv.order:
        if key in MAIN_BLOCKS:
            main_block(key)
        else:
            for section in cv.sections:
                if section.key == key:
                    add_other_section(document, section)
    return to_bytes(document)


def letter_to_docx(letter: LetterContent) -> bytes:
    labels = LABELS[letter.language]
    document = new_document(letter.subject, letter.signature, letter.language, 2.2, 11, letter.font)
    document.styles["Normal"].paragraph_format.space_after = Pt(8)
    section = document.sections[0]
    section.top_margin, section.bottom_margin = Cm(1.8), Cm(2)

    name = letter.sender[0] if letter.sender else letter.signature
    if letter.contact:
        add_identity(document, name, letter.headline, letter.contact)
    else:
        # Lettres créées avant cet en-tête : l'expéditeur reste une liste de lignes.
        document.add_paragraph(name, style="Heading 1")
        for line in letter.sender[1:]:
            document.add_paragraph(line)
    add_rule(document.paragraphs[-1])

    for index, line in enumerate(letter.recipient):
        paragraph = document.add_paragraph()
        paragraph.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        paragraph.paragraph_format.space_after = Pt(0)
        if index == 0:
            paragraph.paragraph_format.space_before = Pt(14)
        paragraph.add_run(line).bold = index == 0
    date_line = document.add_paragraph()
    date_line.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    date_line.paragraph_format.space_before = Pt(10)
    add_muted(date_line, letter.place_date)

    subject = document.add_paragraph()
    subject.paragraph_format.space_before = Pt(12)
    subject.add_run(f"{labels['subject']} : {letter.subject}").bold = True
    for part in (letter.greeting, *letter.paragraphs, letter.closing):
        document.add_paragraph(part)
    signature = document.add_paragraph()
    signature.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    signature.paragraph_format.space_before = Pt(14)
    signature.add_run(letter.signature).bold = True
    return to_bytes(document)
