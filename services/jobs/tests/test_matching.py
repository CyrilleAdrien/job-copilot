from jobcopilot_jobs.matching import dedup_key, normalize, score_offer
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
