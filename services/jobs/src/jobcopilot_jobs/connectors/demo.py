"""Source de démonstration (JOBS_DEMO=true) : des offres fictives pour essayer l'outil sans clé."""

import hashlib
from datetime import UTC, datetime, timedelta

from jobcopilot_jobs.schemas import Query, RawOffer

COMPANIES = [
    ("Nimbus Data", "Paris"),
    ("Atelier Numérique", "Lyon"),
    ("Helio Systems", "Nantes"),
    ("Brume Cloud", "Paris"),
    ("Quartz Logistique", "Lille"),
    ("Orbe Santé", "Bordeaux"),
    ("Marée Énergie", "Rennes"),
    ("Studio Lumen", "Toulouse"),
]
# (variante d'intitulé, ancienneté en heures, contrat, technologies citées, télétravail).
# Les technologies mêlent DevOps et données, pour essayer plusieurs profils de recherche.
VARIANTS = [
    (
        "{role}",
        2,
        "cdi",
        ["Python", "Docker", "Kubernetes", "Airflow"],
        "Télétravail partiel possible.",
    ),
    ("{role} junior", 9, "cdi", ["Linux", "Ansible", "GitLab CI"], ""),
    (
        "{role} confirmé",
        22,
        "cdi",
        ["Terraform", "AWS", "Kubernetes", "dbt", "SQL"],
        "Full remote.",
    ),
    ("{role} (H/F)", 40, "cdd", ["Docker", "PostgreSQL"], ""),
    ("{role} senior", 70, "cdi", ["Kubernetes", "Grafana", "Prometheus"], ""),
    (
        "{role}",
        110,
        "freelance",
        ["Python", "AWS", "Airflow", "dbt"],
        "Télétravail 3 jours par semaine.",
    ),
    ("Lead {role}", 200, "cdi", ["Terraform", "Kubernetes"], ""),
    ("{role}", 330, "alternance", ["Linux", "Docker"], ""),
]


class Demo:
    name = "demo"
    label = "Démonstration"

    def configured(self) -> bool:
        return True

    async def search(self, query: Query) -> list[RawOffer]:
        anchor = datetime.now(UTC).replace(minute=0, second=0, microsecond=0)
        offers = []
        shift = int(hashlib.sha1(query.keywords.encode()).hexdigest(), 16)
        for index, (title, hours, contract, techs, remote) in enumerate(VARIANTS):
            if hours > query.max_age_days * 24:
                continue
            company, city = COMPANIES[(index + shift) % len(COMPANIES)]
            seed = hashlib.sha1(f"{query.keywords}|{index}".encode()).hexdigest()[:12]
            offers.append(
                RawOffer(
                    source=self.name,
                    external_id=seed,
                    title=title.format(role=query.keywords),
                    company=company,
                    location=city,
                    contract=contract,
                    salary="45 000 – 55 000 € par an" if index % 3 == 0 else None,
                    description=(
                        f"{company} renforce son équipe technique. Environnement : "
                        f"{', '.join(techs)}. {remote}\n"
                        "Offre fictive générée par le mode démonstration de job-copilot."
                    ),
                    url=f"https://example.org/offres/{seed}",
                    published_at=anchor - timedelta(hours=hours),
                )
            )
        return offers
