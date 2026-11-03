from datetime import date
from io import BytesIO

import httpx
from docx import Document

from jobcopilot_documents.compose import (
    build_cv,
    build_letter,
    period,
    place_date,
    visible_cv,
)
from jobcopilot_documents.language import detect_language
from jobcopilot_documents.render import render_sync
from jobcopilot_documents.schemas import (
    FONTS,
    Award,
    Course,
    CustomSection,
    CvDraft,
    DraftExperience,
    Education,
    Group,
    LetterDraft,
    Link,
    Profile,
)
from jobcopilot_documents.upstream import fetch_photo, search_view
from jobcopilot_documents.word import cv_to_docx, letter_to_docx


def test_period():
    assert period("2024-09", None, "fr") == "09/2024 – aujourd'hui"
    assert period("2022-01", "2023-06", "en") == "01/2022 – 06/2023"


def test_place_date():
    assert place_date("Lyon", "fr", date(2026, 11, 1)) == "Lyon, le 1er novembre 2026"
    assert place_date("Lyon", "en", date(2026, 11, 3)) == "Lyon, November 3, 2026"


def test_detect_language():
    assert detect_language("Vous rejoindrez une équipe pour opérer nos clusters") == "fr"
    assert detect_language("You will join our team and run the platform with us") == "en"


def test_cv_keeps_selected_experiences_and_rewritten_groups(profile):
    draft = CvDraft(
        headline="Ingénieur DevOps Kubernetes",
        summary="Résumé ciblé.",
        experiences=[
            DraftExperience(index=0, groups=[Group(title="Cloud", bullets=["Migré 30 services."])])
        ],
    )
    cv = build_cv(profile, [0], draft, "fr")
    assert cv.headline == "Ingénieur DevOps Kubernetes"
    assert [e.company for e in cv.experiences] == ["Nimbus"]
    assert cv.experiences[0].title == "Ingénieur DevOps (Alternance)"
    assert cv.experiences[0].groups[0].bullets == ["Migré 30 services."]
    assert cv.details == ["CDI"]
    assert cv.highlight == "Disponible immédiatement"
    assert cv.contact[-1].url == "https://github.com/alex"
    assert [line.label for line in cv.extras] == ["Langues", "Qualités", "Centres d'intérêt"]


def test_cv_without_draft_keeps_profile_content(profile):
    cv = build_cv(profile, [0, 1], None, "fr")
    assert cv.summary == profile.identity.summary
    assert len(cv.experiences) == 2


def test_cv_lists_secondary_sections_in_order(profile):
    cv = build_cv(profile, [0], None, "en")
    assert [section.title for section in cv.sections] == [
        "Projects",
        "Certifications",
        "Volunteering",
    ]
    project, certification, volunteering = (section.entries[0] for section in cv.sections)
    assert project.meta == ["FastAPI, Next.js"]
    assert project.url == "https://github.com/alex/job-copilot"
    assert certification.meta == ["CNCF", "2025"]
    assert volunteering.meta == ["Asso", "01/2023 – present"]


def test_cv_contract_follows_the_chosen_search(profile):
    assert build_cv(profile, [0], None, "fr", "freelance").details == ["Freelance"]
    assert build_cv(profile, [0], None, "fr", "inconnue").details == ["CDI"]


def test_rendered_documents_are_pdf(profile, offer):
    cv = build_cv(profile, [0, 1], None, "fr")
    draft = LetterDraft(
        subject="Candidature",
        greeting="Madame, Monsieur,",
        paragraphs=["Un."],
        closing="Cordialement,",
    )
    letter = build_letter(profile, offer, draft, "fr", date(2026, 10, 26))
    assert letter.recipient == ["Helio", "Paris"]
    assert render_sync("cv", cv).startswith(b"%PDF")
    assert render_sync("letter", letter).startswith(b"%PDF")


def test_contact_lists_coordinates_with_their_icon(profile):
    profile.identity.driving_licence = "B"
    profile.identity.links = [
        Link(label="GitHub", url="https://github.com/alex"),
        Link(label="LinkedIn", url="https://www.linkedin.com/in/alex"),
        Link(label="Faux", url="https://github.com.evil.io/x"),
        Link(label="Piège", url="javascript:alert(1)"),
    ]
    items = build_cv(profile, [0], None, "fr").contact
    assert [item.kind for item in items] == [
        "location", "email", "phone", "github", "linkedin", "link", "link", "licence",
    ]  # fmt: skip
    assert items[1].url == "mailto:alex@example.org"
    assert items[2].url == "tel:0600000000"
    assert items[6].url is None
    assert items[7].text == "Permis B"


def with_details(profile) -> Profile:
    data = profile.model_dump()
    data["identity"] |= {
        "address": "1 rue de la Paix",
        "birth_date": "1998-03-01",
        "nationality": "Française",
        "driving_licence": "B",
    }
    data["referees"] = [{"name": "Sam Durand", "role": "Responsable"}]
    return Profile.model_validate(data)


def test_cv_leaves_out_private_details_by_default(profile):
    cv = build_cv(with_details(profile), [0], None, "fr")
    shown = visible_cv(cv).model_dump_json()
    for private in ("rue de la Paix", "1998", "Française", "Sam Durand"):
        assert private not in shown
    # Le contenu les garde : on peut les réafficher sans générer de nouveau.
    assert "rue de la Paix" in cv.model_dump_json()
    assert "rue de la Paix" not in word_text(cv_to_docx(cv))


def laid_out(profile, **layout) -> Profile:
    data = profile.model_dump()
    data["searches"][0]["cv_layout"] = {"hidden": [], "order": [], "labels": {}} | layout
    return Profile.model_validate(data)


def test_cv_shows_private_details_when_asked(profile):
    cv = visible_cv(build_cv(laid_out(with_details(profile)), [0], None, "fr", "devops"))
    items = {item.kind: item.text for item in cv.contact}
    assert items["address"] == "1 rue de la Paix"
    assert items["location"] == "Lyon"
    assert items["birth"] == "1er mars 1998"
    assert items["nationality"] == "Française"
    referees = next(section for section in cv.sections if section.key == "referees")
    assert referees.title == "Références"
    assert referees.entries[0].meta == ["Responsable"]


def test_cv_hides_each_chosen_element(profile):
    hidden = [
        "photo", "location", "email", "phone", "links", "licence", "availability", "contracts",
        "profile", "skills", "experience", "education", "projects", "languages", "soft_skills",
        "interests", "certifications", "volunteering", "address", "birth_date", "nationality",
        "referees",
    ]  # fmt: skip
    built = build_cv(laid_out(with_details(profile), hidden=hidden), [0, 1], None, "fr", "devops")
    cv = visible_cv(built)
    assert cv.show_photo is False
    assert cv.contact == []
    assert cv.details == []
    assert cv.highlight is None
    assert cv.summary is None
    assert cv.skills == cv.experiences == cv.education == cv.extras == []
    assert cv.sections == []
    assert render_sync("cv", built).startswith(b"%PDF")
    assert len(built.experiences) == 2


def test_masking_never_changes_the_profile_used_by_the_writer(profile):
    before = profile.model_dump_json()
    build_cv(laid_out(profile, hidden=["experience"]), [0], None, "fr", "devops")
    assert profile.model_dump_json() == before


def test_order_is_followed_and_completed(profile):
    cv = build_cv(
        laid_out(profile, order=["projects", "experience", "ancienne"]), [0], None, "fr", "devops"
    )
    assert cv.order[:3] == ["projects", "experience", "profile"]
    assert "ancienne" not in cv.order
    assert cv.order[-1] == "extras"
    assert len(cv.order) == len(set(cv.order))


def pdf_text_order(cv) -> list[str]:
    """Les titres de section, dans l'ordre où le Word les écrit : même ordre que le template."""
    document = Document(BytesIO(cv_to_docx(cv)))
    return [p.text for p in document.paragraphs if p.style.name == "Heading 2"]


def test_word_follows_the_order_and_section_names(profile):
    layout = {
        "order": ["projects", "experience"],
        "labels": {
            "projects": {"fr": "Réalisations", "en": None},
            "experience": {"fr": "Parcours", "en": "Career"},
            "custom:Conférences": {"fr": "Interventions"},
        },
    }
    profile.custom_sections = [CustomSection(title="Conférences", items=["DevOps Days"])]
    titles = pdf_text_order(build_cv(laid_out(profile, **layout), [0], None, "fr", "devops"))
    assert titles[:2] == ["Réalisations", "Parcours"]
    assert "Interventions" in titles
    english = pdf_text_order(build_cv(laid_out(profile, **layout), [0], None, "en", "devops"))
    # Sans nom pour cette langue, la rubrique garde son nom par défaut.
    assert english[:2] == ["Projects", "Career"]


def test_template_renders_any_order_and_old_documents(profile):
    new = build_cv(
        laid_out(profile, order=["extras", "projects", "experience"]), [0], None, "fr", "devops"
    )
    assert render_sync("cv", new).startswith(b"%PDF")
    old = new.model_copy(update={"order": [], "titles": {}})
    assert render_sync("cv", old).startswith(b"%PDF")
    assert Document(BytesIO(cv_to_docx(old))).paragraphs


def test_cv_includes_education_details_and_new_sections(profile):
    profile.education = [
        Education(
            degree="Master", school="ESEO", location="Paris", start="2024-09", end="2026-08",
            details="Mention bien",
        )
    ]  # fmt: skip
    profile.courses = [Course(name="Kubernetes", institution="CNCF", year=2025)]
    profile.awards = [Award(title="Prix", issuer="BPCE", year=2025, description="Pour X")]
    profile.custom_sections = [CustomSection(title="Conférences", items=["DevOps Days"])]
    cv = build_cv(profile, [0], None, "fr")
    assert cv.education[0].period == "09/2024 – 08/2026"
    assert cv.education[0].location == "Paris"
    assert cv.education[0].details == "Mention bien"
    titles = [section.title for section in cv.sections]
    assert titles[-3:] == ["Formations suivies", "Récompenses", "Conférences"]
    assert cv.sections[-1].bullets == ["DevOps Days"]


def test_letter_shares_the_cv_header_and_keeps_only_the_city(profile, offer):
    profile.identity.location = "Clamart, France"
    draft = LetterDraft(subject="S", greeting="G", paragraphs=["P"], closing="C")
    letter = build_letter(profile, offer, draft, "fr", date(2026, 11, 3))
    assert letter.place_date == "Clamart, le 3 novembre 2026"
    assert letter.headline == profile.identity.headline
    assert letter.contact[0].kind == "location"


def test_photo_appears_in_the_rendered_cv(profile):
    cv = build_cv(profile, [0], None, "fr")
    png = (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00"
        b"\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\xf8\xcf\xc0\xf0\x1f\x00\x05\x00\x01\xff"
        b"\x89\x99=\x1d\x00\x00\x00\x00IEND\xaeB`\x82"
    )
    with_photo = render_sync("cv", cv, png)
    assert with_photo.startswith(b"%PDF")
    assert len(with_photo) > len(render_sync("cv", cv))
    # Un ancien document, enregistré sans photo, reste sans photo.
    old = cv.model_copy(update={"show_photo": False})
    assert len(render_sync("cv", old, png)) < len(with_photo)


async def test_unreadable_photo_is_ignored():
    async def answer(content: bytes, status: int = 200):
        transport = httpx.MockTransport(lambda _: httpx.Response(status, content=content))
        async with httpx.AsyncClient(transport=transport) as client:
            return await fetch_photo(client)

    assert await answer(b"\x89PNG\r\n\x1a\nrest") == b"\x89PNG\r\n\x1a\nrest"
    assert await answer(b"not an image") is None
    assert await answer(b"\x89PNG\r\n\x1a\n", 404) is None


def word_text(data: bytes) -> str:
    return "\n".join(p.text for p in Document(BytesIO(data)).paragraphs)


def test_word_cv_holds_the_same_content_as_the_pdf(profile):
    profile.custom_sections = [CustomSection(title="Conférences", items=["DevOps Days"])]
    cv = build_cv(profile, [0], None, "fr")
    text = word_text(cv_to_docx(cv))
    for expected in (
        cv.name, cv.headline, cv.summary, cv.experiences[0].title, cv.experiences[0].period,
        cv.education[0].degree, "Conférences", "DevOps Days", "alex@example.org",
    ):  # fmt: skip
        assert expected in text
    document = Document(BytesIO(cv_to_docx(cv)))
    assert document.core_properties.author == cv.name
    assert [p.text for p in document.paragraphs if p.style.name == "Heading 1"] == [cv.name]


def test_word_cv_shows_the_photo_only_when_asked(profile):
    png = (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00"
        b"\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\xf8\xcf\xc0\xf0\x1f\x00\x05\x00\x01\xff"
        b"\x89\x99=\x1d\x00\x00\x00\x00IEND\xaeB`\x82"
    )
    cv = build_cv(profile, [0], None, "fr")
    assert len(Document(BytesIO(cv_to_docx(cv, png))).inline_shapes) == 1
    hidden = cv.model_copy(update={"show_photo": False})
    assert len(Document(BytesIO(cv_to_docx(hidden, png))).inline_shapes) == 0
    assert word_text(cv_to_docx(hidden, png)).startswith(cv.name)


def test_word_cv_ignores_an_unreadable_photo_and_unsafe_links(profile):
    cv = build_cv(profile, [0], None, "fr")
    cv.contact[0].url = "javascript:alert(1)"
    data = cv_to_docx(cv, b"not an image")
    document = Document(BytesIO(data))
    urls = [rel.target_ref for rel in document.part.rels.values() if rel.is_external]
    assert not any(url.startswith("javascript") for url in urls)
    assert len(document.inline_shapes) == 0


def test_word_letter_holds_its_paragraphs(profile, offer):
    draft = LetterDraft(
        subject="Candidature", greeting="Madame,", paragraphs=["Un."], closing="Fin"
    )
    letter = build_letter(profile, offer, draft, "fr", date(2026, 11, 3))
    text = word_text(letter_to_docx(letter))
    for expected in ("Objet : Candidature", "Madame,", "Un.", "Fin", "Helio", letter.signature):
        assert expected in text


def test_search_view_uses_the_cv_of_the_chosen_search():
    data = {
        "identity": {"full_name": "Alex"},
        "languages": [{"name": "Français", "level": "Natif"}],
        "searches": [
            {"id": "old", "archived": True, "name": "Old", "cv": {"headline": "Ancien"}},
            {
                "id": "nurse",
                "name": "Soins",
                "cv": {"headline": "Infirmière", "summary": "Soins.", "skills": [{"name": "A"}]},
            },
            {
                "id": "sales",
                "name": "Vente",
                "cv": {"headline": "", "experiences": [{"title": "V"}]},
            },
        ],
    }
    nurse = search_view(data, "nurse")
    assert nurse["identity"] == {"full_name": "Alex", "headline": "Infirmière", "summary": "Soins."}
    assert nurse["skills"] == [{"name": "A"}]
    assert nurse["languages"] == data["languages"]
    sales = search_view(data, "sales")
    assert sales["identity"]["headline"] == "Vente"
    assert sales["experiences"] == [{"title": "V"}]
    assert "skills" not in sales
    # Recherche inconnue ou absente : la première active, jamais une archivée.
    assert search_view(data, "inconnue")["identity"]["headline"] == "Infirmière"
    assert search_view(data)["identity"]["headline"] == "Infirmière"
    # La recherche principale passe avant l'ordre de la liste.
    data["searches"][2]["primary"] = True
    assert search_view(data)["identity"]["headline"] == "Vente"
    assert search_view(data, "nurse")["identity"]["headline"] == "Infirmière"


def test_every_font_is_embedded_and_really_used(profile):
    sizes = set()
    for font in FONTS:
        data = profile.model_dump()
        data["searches"][0]["cv_layout"] = {"font": font}
        cv = build_cv(Profile.model_validate(data), [0], None, "fr", "devops")
        assert cv.font == font
        sizes.add(len(render_sync("cv", cv)))
    assert len(sizes) == len(FONTS)


def test_unknown_font_falls_back(profile):
    data = profile.model_dump()
    data["searches"][0]["cv_layout"] = {"font": "Comic Sans"}
    assert build_cv(Profile.model_validate(data), [0], None, "fr", "devops").font is None


def test_word_uses_the_font_name_people_know(profile):
    data = profile.model_dump()
    data["searches"][0]["cv_layout"] = {"font": "Arimo"}
    cv = build_cv(Profile.model_validate(data), [0], None, "fr", "devops")
    assert Document(BytesIO(cv_to_docx(cv))).styles["Normal"].font.name == "Arial"
    assert (
        Document(BytesIO(cv_to_docx(cv.model_copy(update={"font": None}))))
        .styles["Normal"]
        .font.name
        == "Calibri"
    )


def test_letter_follows_font_and_hidden_details(profile, offer):
    data = with_details(profile).model_dump()
    data["searches"][0]["cv_layout"] = {"font": "Lato", "hidden": ["phone", "birth_date"]}
    draft = LetterDraft(subject="S", greeting="G", paragraphs=["P"], closing="C")
    letter = build_letter(
        Profile.model_validate(data), offer, draft, "fr", date(2026, 11, 3), "devops"
    )
    assert letter.font == "Lato"
    kinds = {item.kind for item in letter.contact}
    assert "phone" not in kinds and "birth" not in kinds and "address" in kinds
    assert render_sync("letter", letter).startswith(b"%PDF")


def test_bold_is_rendered_in_pdf_and_word(profile):
    cv = build_cv(profile, [0], None, "fr")
    cv.summary = "Un **passage important** du résumé."
    plain = cv.model_copy(update={"summary": "Un passage important du résumé."})
    assert render_sync("cv", cv) != render_sync("cv", plain)
    paragraph = next(p for p in Document(BytesIO(cv_to_docx(cv))).paragraphs if "passage" in p.text)
    assert paragraph.text == "Un passage important du résumé."
    assert [run.text for run in paragraph.runs if run.bold] == ["passage important"]


def test_lone_stars_stay_text(profile):
    cv = build_cv(profile, [0], None, "fr")
    cv.summary = "Note ** sans fin"
    assert "Note ** sans fin" in word_text(cv_to_docx(cv))
    assert render_sync("cv", cv).startswith(b"%PDF")


def test_changing_names_and_hidden_after_generation(profile):
    cv = build_cv(profile, [0, 1], None, "fr")
    edited = cv.model_copy(
        update={
            "hidden": ["projects", "phone"],
            "titles": {
                "certifications": "Titres",
                "experience": "Parcours",
                "languages": "Idiomes",
            },
        }
    )
    shown = visible_cv(edited)
    assert "Projets" not in [part.title for part in shown.sections]
    assert "Titres" in [part.title for part in shown.sections]
    assert "Idiomes" in [line.label for line in shown.extras]
    assert "phone" not in [item.kind for item in shown.contact]
    assert "Parcours" in word_text(cv_to_docx(edited))
