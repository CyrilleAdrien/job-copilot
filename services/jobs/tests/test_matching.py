from datetime import UTC, datetime

from jobcopilot_jobs import api as jobs_api
from jobcopilot_jobs.matching import dedup_key, normalize, score_offer
from jobcopilot_jobs.models import OfferRow
from jobcopilot_jobs.schemas import Criteria

CRITERIA = Criteria(
    roles=["Ingénieur DevOps"],
    technologies=["Kubernetes", "Terraform", "GitLab CI", "Python", "AWS"],
    excluded_keywords=["ESN"],
    seniority="graduate",
    contract_types=["cdi"],
    remote="hybrid",
)


def test_normalize_strips_accents_and_punctuation():
    assert normalize("Ingénieur DevOps (H/F) – CI/CD") == "ingenieur devops h f ci cd"
    assert normalize("C#/.NET") == "c# net"


def test_dedup_key_ignores_case_accents_and_postcode():
    first = dedup_key("Ingénieur DevOps", "Nimbus", "75 - Paris")
    assert first == dedup_key("ingenieur devops", "NIMBUS", "Paris 9e")


def test_relevant_offer_scores_high():
    match = score_offer(
        CRITERIA,
        "Ingénieur DevOps junior",
        "Stack : Kubernetes, Terraform, GitLab CI, Python et AWS. Télétravail 2 jours.",
        "cdi",
    )
    assert match.score == 100
    assert match.matched == CRITERIA.technologies
    assert match.remote == "hybrid"


def test_senior_offer_is_penalised_for_a_graduate():
    junior = score_offer(CRITERIA, "Ingénieur DevOps junior", "Kubernetes", "cdi")
    senior = score_offer(CRITERIA, "Ingénieur DevOps senior", "Kubernetes", "cdi")
    assert senior.score < junior.score - 20


def test_excluded_keyword_drops_the_offer():
    assert score_offer(CRITERIA, "Ingénieur DevOps", "Rejoignez notre ESN", "cdi").excluded


def test_unrelated_offer_is_off_topic():
    match = score_offer(CRITERIA, "Comptable", "Cabinet d'expertise comptable", "cdi")
    assert not match.on_topic


def test_full_remote_is_detected():
    match = score_offer(CRITERIA, "Ingénieur DevOps", "Poste en full remote", None)
    assert match.remote == "remote"


def test_skills_mode_requires_the_minimum_of_chosen_skills():
    criteria = CRITERIA.model_copy(
        update={
            "match_mode": "skills",
            "focus_skills": ["Spark", "Airflow", "Python"],
            "min_skills": 2,
        }
    )
    one = score_offer(criteria, "Ingénieur DevOps", "Python au quotidien.", "cdi")
    two = score_offer(criteria, "Ingénieur DevOps", "Python et Airflow.", "cdi")
    assert one.matched == ["Python"] and not one.enough_skills
    assert two.matched == ["Airflow", "Python"] and two.enough_skills


def test_skills_mode_threshold_never_exceeds_the_number_of_skills():
    criteria = CRITERIA.model_copy(
        update={"match_mode": "skills", "focus_skills": ["Spark"], "min_skills": 3}
    )
    assert score_offer(criteria, "Ingénieur DevOps", "Spark", "cdi").enough_skills


def test_domain_mode_ignores_the_threshold():
    criteria = CRITERIA.model_copy(update={"min_skills": 5})
    assert score_offer(criteria, "Ingénieur DevOps", "", "cdi").enough_skills


def test_generic_title_words_do_not_match_another_job():
    data = CRITERIA.model_copy(update={"roles": ["Data Engineer"], "technologies": ["Python"]})
    assert not score_offer(data, "Platform Engineer", "Python et Kubernetes.", "cdi").on_topic
    assert score_offer(data, "Senior Data Engineer", "", "cdi").on_topic


def test_shared_technologies_alone_do_not_make_an_offer_on_topic():
    match = score_offer(CRITERIA, "Data Analyst", "Python, AWS et Terraform.", "cdi")
    assert match.matched and not match.on_topic


def test_offers_above_the_wanted_level_are_set_aside():
    def senior(title: str, description: str = "", seniority: str = "graduate") -> bool:
        criteria = CRITERIA.model_copy(update={"seniority": seniority})
        return score_offer(criteria, title, description, "cdi").too_senior

    assert senior("Ingénieur DevOps senior")
    assert senior("Lead DevOps")
    assert senior("Ingénieur DevOps", "Vous justifiez de 5 ans d'expérience minimum.")
    assert senior("DevOps Engineer", "7+ years of experience with Kubernetes.")
    assert not senior("Ingénieur DevOps junior")
    assert not senior("Ingénieur DevOps", "Une première expérience de 1 an en alternance.")
    assert not senior("Ingénieur DevOps", "Kubernetes, Terraform.")
    # « confirmé » vise un profil intermédiaire, pas un senior.
    assert not senior("Ingénieur DevOps confirmé", seniority="mid")
    assert not senior("Ingénieur DevOps senior", seniority="senior")


def test_window_counts_match_a_full_scoring_and_each_offer_is_scored_once(monkeypatch):
    def row(number: int, title: str, description: str) -> OfferRow:
        return OfferRow(
            id=number,
            source="demo",
            external_id=str(number),
            title=title,
            company="Nimbus",
            description=description,
            url="https://example.org",
            published_at=datetime.now(UTC),
        )

    criteria = CRITERIA.model_copy(update={"match_mode": "skills", "min_skills": 2})
    rows = [
        row(1, "Ingénieur DevOps", "Kubernetes et Terraform"),  # gardée
        row(2, "Ingénieur DevOps", "Kubernetes seulement"),  # pas assez de compétences
        row(3, "Ingénieur DevOps senior", "Kubernetes et Terraform, 8 ans d'expérience"),  # niveau
        row(4, "Comptable", "Kubernetes et Terraform"),  # autre métier : pas comptée
        row(5, "Ingénieur DevOps", "Kubernetes, Terraform, ESN"),  # mot exclu : pas comptée
    ]
    calls = []
    real = jobs_api.score_offer

    def counting(*args):
        calls.append(args[1])
        return real(*args)

    monkeypatch.setattr(jobs_api, "score_offer", counting)
    offers, below_threshold, above_level = jobs_api.score_window(rows, criteria, {1})

    assert [(offer.id, offer.favorite) for offer in offers] == [(1, True)]
    assert (below_threshold, above_level) == (1, 1)
    assert len(calls) == len(rows)
