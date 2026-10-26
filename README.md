# job-copilot

Assistant de candidature open source, installé en local : recherche d'offres selon ton profil, CV et lettre sur mesure, suivi des candidatures, des réponses et des entretiens. Toutes les données restent sur ta machine.

Projet en cours de construction.

## Architecture

| Service | Rôle |
| --- | --- |
| `web` | Interface Next.js (`127.0.0.1:3000`) |
| `gateway` | Point d'entrée unique de l'API (FastAPI, `127.0.0.1:8000`) |
| `profile` | Profil, expériences, critères de recherche |
| `jobs` | Collecte et scoring des offres (France Travail, Adzuna) |
| `documents` | Génération des CV et lettres, stockage S3 |
| `applications` | Candidatures, statuts, statistiques |
| `mail` | Lecture IMAP et classement des réponses |
| `calendar` | Entretiens, synchro CalDAV et .ics |

Infrastructure locale : PostgreSQL 16 (un schéma par service), Redis 7 (cache et bus d'événements), SeaweedFS (stockage compatible S3) et Ollama (LLM local).

## Démarrage

Prérequis : Docker Desktop, et pour le développement [uv](https://docs.astral.sh/uv/) et Node.js 22.

```bash
make setup    # crée .env et l'environnement Python
make up       # construit et démarre la stack
make ready    # état de chaque service et de ses dépendances
make models   # télécharge le modèle LLM (environ 4,7 Go)
```

L'application s'ouvre sur http://localhost:3000. Le catalogue des composants est sur http://localhost:3000/design.

## Développement

```bash
make lint
make test
make web      # front en mode développement
```

Structure :

```
web/               interface Next.js (design system dans src/components/ui)
libs/common/       configuration et health checks partagés
services/<nom>/    un service FastAPI par dossier
services/Dockerfile image commune aux services
infra/postgres/    initialisation des schémas
```

## Design

Interface sobre inspirée d'Apple : fond blanc, bleu pour les actions, violet réservé à ce qui vient de l'IA, mode sombre natif. Icônes Lucide, police Inter, animations Motion qui respectent `prefers-reduced-motion`. Les tokens sont dans `web/src/app/globals.css`.

## Licence

MIT
