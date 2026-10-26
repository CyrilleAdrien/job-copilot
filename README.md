# job-copilot

Assistant de candidature open source, installé en local : recherche d'offres selon ton profil, CV et lettre sur mesure, suivi des candidatures, des réponses et des entretiens. Toutes les données restent sur ta machine.

Projet en cours de construction.

## Architecture

| Service | Rôle |
| --- | --- |
| `gateway` | Point d'entrée unique de l'API (FastAPI), seul port exposé (`127.0.0.1:8000`) |
| `profile` | Profil, expériences, critères de recherche |
| `jobs` | Collecte et scoring des offres (France Travail, Adzuna) |
| `documents` | Génération des CV et lettres, stockage S3 |
| `applications` | Candidatures, statuts, statistiques |
| `mail` | Lecture IMAP et classement des réponses |
| `calendar` | Entretiens, synchro CalDAV et .ics |

Infrastructure locale : PostgreSQL 16 (un schéma par service), Redis 7 (cache et bus d'événements), SeaweedFS (stockage compatible S3) et Ollama (LLM local).

## Démarrage

Prérequis : Docker Desktop, et [uv](https://docs.astral.sh/uv/) pour le développement.

```bash
make setup    # crée .env et l'environnement Python
make up       # construit et démarre la stack
make ready    # état de chaque service et de ses dépendances
make models   # télécharge le modèle LLM (environ 4,7 Go)
```

## Développement

```bash
make lint
make test
```

Structure :

```
libs/common/       configuration et health checks partagés
services/<nom>/    un service FastAPI par dossier
services/Dockerfile image commune aux services
infra/postgres/    initialisation des schémas
```

## Licence

MIT
