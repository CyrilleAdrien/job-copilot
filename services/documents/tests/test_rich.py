from io import BytesIO

import pytest
from docx import Document

from jobcopilot_documents.compose import build_cv
from jobcopilot_documents.render import render_sync
from jobcopilot_documents.rich import Run, parse_blocks, parse_inline
from jobcopilot_documents.word import cv_to_docx


def test_inline_styles():
    assert parse_inline("un **gras** et *penché* et __souligné__") == [
        Run("un "),
        Run("gras", bold=True),
        Run(" et "),
        Run("penché", italic=True),
        Run(" et "),
        Run("souligné", underline=True),
    ]


def test_styles_combine():
    assert parse_inline("***deux***") == [Run("deux", bold=True, italic=True)]


@pytest.mark.parametrize("text", ["5 * 3 * 2", "snake_case_name", "note ** seule", "C*", "a_b"])
def test_technical_text_stays_as_it_is(text):
    assert parse_inline(text) == [Run(text)]


def test_escaped_characters():
    assert parse_inline(r"\*\*pas gras\*\*") == [Run("**pas gras**")]
    assert parse_inline(r"snake\_case") == [Run("snake_case")]


def test_blocks():
    assert parse_blocks("Intro\n- un\n\n1. deux\n12. trois\n\\- texte") == [
        ("text", "Intro"),
        ("bullet", "un"),
        ("number", "deux"),
        ("number", "trois"),
        ("text", "\\- texte"),
    ]


def paragraphs(cv):
    return Document(BytesIO(cv_to_docx(cv))).paragraphs


def test_word_applies_every_style_and_list(profile):
    cv = build_cv(profile, [0], None, "fr")
    cv.summary = "Un **gras**, *penché*, __souligné__\n- une puce\n1. premier\n2. second"
    found = paragraphs(cv)
    line = next(p for p in found if p.text == "Un gras, penché, souligné")
    assert [r.text for r in line.runs if r.bold] == ["gras"]
    assert [r.text for r in line.runs if r.italic] == ["penché"]
    assert [r.text for r in line.runs if r.underline] == ["souligné"]
    assert next(p for p in found if p.text == "une puce").style.name == "List Bullet"
    assert any(p.text == "1.\tpremier" for p in found)
    assert any(p.text == "2.\tsecond" for p in found)


def test_template_renders_every_style_and_list(profile):
    cv = build_cv(profile, [0], None, "fr")
    plain = render_sync("cv", cv)
    cv.summary = "Un **gras**, *penché*, __souligné__\n- une puce\n1. premier\n2. second\n\\- texte"
    cv.experiences[0].groups[0].bullets = [
        "Une **réalisation** forte",
        "snake_case et 5 * 3",
        "note ** seule",
    ]
    rendered = render_sync("cv", cv)
    assert rendered.startswith(b"%PDF")
    assert rendered != plain
