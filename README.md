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

## Profil

Au premier lancement, http://localhost:3000/bienvenue propose deux chemins : remplir le profil en quatre étapes (identité, recherche, expériences, compétences) ou importer un `profile.yaml`. Le fichier [`examples/profile.example.yaml`](examples/profile.example.yaml) montre le format complet. Le profil s'exporte depuis l'écran Profil pour être sauvegardé ou modifié à la main.

L'API du profil est servie par la gateway :

| Méthode | Chemin | Rôle |
| --- | --- | --- |
| `GET` | `/api/profile/` | Lire le profil (404 tant qu'il n'existe pas) |
| `PUT` | `/api/profile/` | Remplacer le profil |
| `GET` | `/api/profile/export` | Télécharger le `profile.yaml` |
| `POST` | `/api/profile/import` | Importer un `profile.yaml` (`content-type: application/yaml`) |

## Offres

L'écran Offres interroge les sources à partir des critères du profil (postes, lieux, rayon, contrats) et affiche les offres les plus récentes d'abord. La fenêtre de publication (24 h, 3, 7, 14 ou 30 jours) part de celle du profil et se change à la volée. Le tri par pertinence utilise un score de 0 à 100, calculé sans LLM : intitulé (40), technologies citées (35), séniorité (10), contrat (10), télétravail (5). Les offres qui contiennent un mot exclu ou qui ne correspondent ni au poste ni aux technologies sont écartées. Une même offre publiée sur deux sources n'apparaît qu'une fois.

Les deux sources sont gratuites. Renseigne leurs clés dans `.env`, puis relance avec `make up` :

| Source | Inscription | Variables |
| --- | --- | --- |
| France Travail | [francetravail.io](https://francetravail.io), application avec l'API « Offres d'emploi v2 » | `FRANCE_TRAVAIL_CLIENT_ID`, `FRANCE_TRAVAIL_CLIENT_SECRET` |
| Adzuna | [developer.adzuna.com](https://developer.adzuna.com) | `ADZUNA_APP_ID`, `ADZUNA_APP_KEY` |

Sans clé, `JOBS_DEMO=true` active des offres fictives pour essayer l'outil. Une collecte est mise en cache 15 minutes dans Redis. Le bouton Actualiser force une nouvelle collecte.

| Méthode | Chemin | Rôle |
| --- | --- | --- |
| `GET` | `/api/jobs/offers?sort=date\|relevance&max_age_days=7` | Offres de la fenêtre, triées |
| `GET` | `/api/jobs/offers/{id}` | Détail d'une offre avec sa description complète |
| `POST` | `/api/jobs/refresh?force=true` | Collecter les offres auprès des sources |
| `GET` | `/api/jobs/sources` | Sources connues et configurées |

## Développement

```bash
make test-db  # Postgres jetable pour les tests, une fois
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
examples/          profil d'exemple au format YAML
```

## Design

Interface sobre inspirée d'Apple : fond blanc, bleu pour les actions, violet réservé à ce qui vient de l'IA, mode sombre natif. Icônes Lucide, police Inter, animations Motion qui respectent `prefers-reduced-motion`. Les tokens sont dans `web/src/app/globals.css`.

## Licence

MIT
