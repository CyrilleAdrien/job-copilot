# job-copilot

Assistant de candidature open source, installé en local : recherche d'offres selon ton profil, CV et lettre sur mesure, suivi des candidatures, des réponses et des entretiens. Toutes les données restent sur ta machine.

Projet en cours de construction.

## Architecture

| Service | Rôle |
| --- | --- |
| `web` | Interface Next.js (`127.0.0.1:3000`) |
| `gateway` | Point d'entrée unique de l'API (FastAPI, `127.0.0.1:8000`) |
| `profile` | Profil, expériences, recherches |
| `jobs` | Collecte et scoring des offres (France Travail, Adzuna) |
| `documents` | Génération des CV et lettres, stockage S3 |
| `applications` | Candidatures, statuts, statistiques |
| `mail` | Lecture IMAP et classement des réponses, envoi SMTP des réponses écrites dans l'app |
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

**Sur Mac**, Docker n'a pas accès au GPU : dans un conteneur, un modèle 7B tourne sur le processeur et met plusieurs minutes par réponse. Installe plutôt [Ollama pour macOS](https://ollama.com/download), qui utilise le GPU Apple Silicon, puis, dans `.env`, supprime la ligne `COMPOSE_PROFILES=ollama` et ajoute `OLLAMA_URL=http://host.docker.internal:11434`. Relance ensuite `make up` puis `make models`. Le conteneur Ollama n'est plus démarré et les services joignent l'Ollama du Mac.

## Profil

Au premier lancement, http://localhost:3000/bienvenue propose deux chemins : remplir le profil en cinq étapes (identité, recherches, expériences, compétences, parcours) ou importer un `profile.yaml`. Le formulaire couvre toutes les sections d'un CV : formation, certifications, projets, bénévolat, publications, langues, savoir-être et centres d'intérêt. Les langues, niveaux, technologies, postes et villes sont proposés pendant la saisie. Le fichier [`examples/profile.example.yaml`](examples/profile.example.yaml) montre le format complet ; un ancien fichier avec une seule section `search` reste accepté. L'écran Profil permet aussi de choisir une photo, affichée sur tout le site : elle ne figure ni sur les CV ni dans ce fichier.

L'écran Profil affiche le profil mis en page comme un CV, en français ou en anglais, avec le même template que les CV générés. Il s'exporte en `profile.yaml` pour être sauvegardé ou modifié à la main.

Un profil peut contenir plusieurs **recherches**, par exemple « DevOps » et « Data Engineer ». Chacune a ses postes, ses technologies, ses filtres et sa façon de retenir les offres :

- `match_mode: domain` (« Tout le métier ») garde toutes les offres du métier ;
- `match_mode: skills` (« Mes compétences ») ne garde que les offres qui citent au moins `min_skills` compétences parmi `focus_skills` (ou parmi les technologies si la liste est vide). Le seuil se règle avec un curseur.

L'API du profil est servie par la gateway :

| Méthode | Chemin | Rôle |
| --- | --- | --- |
| `GET` | `/api/profile/` | Lire le profil (404 tant qu'il n'existe pas) |
| `PUT` | `/api/profile/` | Remplacer le profil |
| `GET` | `/api/profile/export` | Télécharger le `profile.yaml` |
| `POST` | `/api/profile/import` | Importer un `profile.yaml` (`content-type: application/yaml`) |
| `GET` | `/api/documents/profile-preview?language=fr` | Nombre de pages du profil mis en page comme un CV |
| `GET` | `/api/documents/profile-preview/pdf` | Ce CV en PDF |
| `GET` | `/api/documents/profile-preview/pages/{n}` | Une page en PNG |

## Offres

L'écran Offres interroge les sources à partir des critères de la recherche choisie (postes, lieux, rayon, contrats) et affiche les offres les plus récentes d'abord. Quand le profil contient plusieurs recherches, un sélecteur passe de l'une à l'autre. La fenêtre de publication (24 h, 3, 7, 14 ou 30 jours) part de celle du profil et se change à la volée. Le tri par pertinence utilise un score de 0 à 100, calculé sans LLM : intitulé (40), technologies citées (35), séniorité (10), contrat (10), télétravail (5). Les offres qui contiennent un mot exclu, ou dont l'intitulé ne correspond pas au poste, sont écartées. Les mots généraux (ingénieur, engineer, développeur...) ne suffisent pas : « Platform Engineer » ne remonte pas dans une recherche « Data Engineer ». En mode « Mes compétences », l'écran indique combien d'offres du métier ont été masquées par le seuil. Une même offre publiée sur deux sources n'apparaît qu'une fois.

Les deux sources sont gratuites. Renseigne leurs clés dans `.env`, puis relance avec `make up` :

| Source | Inscription | Variables |
| --- | --- | --- |
| France Travail | [francetravail.io](https://francetravail.io), application avec l'API « Offres d'emploi v2 » | `FRANCE_TRAVAIL_CLIENT_ID`, `FRANCE_TRAVAIL_CLIENT_SECRET` |
| Adzuna | [developer.adzuna.com](https://developer.adzuna.com) | `ADZUNA_APP_ID`, `ADZUNA_APP_KEY` |

Sans clé, `JOBS_DEMO=true` active des offres fictives pour essayer l'outil. Une collecte est mise en cache 15 minutes dans Redis. Le bouton Actualiser force une nouvelle collecte.

| Méthode | Chemin | Rôle |
| --- | --- | --- |
| `GET` | `/api/jobs/offers?search=devops&sort=date\|relevance&max_age_days=7` | Offres de la recherche et de la fenêtre, triées (première recherche si `search` est absent) |
| `GET` | `/api/jobs/offers/{id}?search=devops` | Détail d'une offre avec sa description complète |
| `POST` | `/api/jobs/refresh?search=devops&force=true` | Collecter les offres de la recherche auprès des sources |
| `GET` | `/api/jobs/sources` | Sources connues et configurées |

## CV et lettre

Depuis une offre, « Préparer la candidature » ouvre sa fiche et génère un CV et, si tu le souhaites, une lettre de motivation. La langue suit celle de l'offre (français ou anglais), ou se choisit à la main. La progression s'affiche étape par étape (lecture de l'offre, sélection des expériences, rédaction, mise en page), puis l'aperçu des pages apparaît. La lettre se relit et se modifie avant téléchargement : chaque enregistrement refait le PDF dans une nouvelle version.

Le LLM tourne en local avec Ollama (`make models` télécharge `OLLAMA_MODEL`, Qwen 2.5 7B par défaut). Il choisit les expériences utiles et reformule les missions du profil, sans rien ajouter. Un contrôle compare ensuite le texte généré au profil et signale les chiffres absents du profil ou les missions sans équivalent, à vérifier avant d'envoyer. Avec `LLM_PROVIDER=demo`, la génération se fait sans LLM : le contenu du profil est repris tel quel.

La mise en page est faite par [Typst](https://typst.app) : le template `cv` reprend une mise en page sobre sur une colonne (en-tête centré, titres de section soulignés, missions groupées par thème), avec la police Carlito fournie dans le dépôt (licence OFL). Les PDF sont rangés dans le stockage S3 local (SeaweedFS).

| Méthode | Chemin | Rôle |
| --- | --- | --- |
| `POST` | `/api/documents/generations` | Lancer une génération (`offer_id`, `letter`, `language`) |
| `GET` | `/api/documents/generations/{id}/events` | Suivre la progression (Server-Sent Events) |
| `GET` | `/api/documents/generations?offer_id=` | Dernières générations d'une offre |
| `GET` | `/api/documents/documents/{id}/pdf` | Télécharger le PDF |
| `GET` | `/api/documents/documents/{id}/pages/{n}` | Aperçu PNG d'une page |
| `PUT` | `/api/documents/documents/{id}/content` | Modifier le contenu et refaire le PDF |
| `GET` | `/api/documents/llm` | Modèle configuré et disponibilité |

## Tes données

Tout reste sur ta machine. L'écran **Réglages** permet :

- d'**exporter** une archive `.zip` : un JSON par service, le `profile.yaml`, la photo, les CV et les lettres. Un service injoignable fait échouer l'export plutôt que de donner une archive incomplète ; un fichier illisible est listé dans `manifest.json`.
- de **tout supprimer** : base, fichiers et cache, après une confirmation. Ta vraie boîte mail, ton calendrier en ligne et les mails déjà envoyés ne sont pas touchés.

## Sécurité

- Les mots de passe d'application (mail, CalDAV) sont chiffrés en base (Fernet) avec `SECRET_KEY`, générée par `make secret` et conservée dans `.env` (lisible par toi seul). Ils ne sortent jamais par l'API ni par l'export. Si tu perds cette clé, reconnecte tes comptes.
- Les clés France Travail et Adzuna restent dans `.env` : elles ne sont pas stockées en base.
- `web` et `gateway` ne sont publiés que sur `127.0.0.1`. L'API n'a pas de compte : elle refuse donc les noms d'hôte étrangers et les écritures venues d'un autre site.

## Écrire et répondre aux mails

La boîte de réception se lit comme une messagerie : une ligne par mail, en gras s'il reste à vérifier, et les dossiers À vérifier, Envoyés et Traités. Les actions (statut, rattachement, catégorie, réponse) apparaissent à l'ouverture du mail. « Nouveau message » écrit à n'importe quelle adresse.

Chaque mail part d'une boîte connectée, en SMTP chiffré, avec le même mot de passe d'application que la lecture, et porte le nom de ton profil.

- **À la connexion**, l'envoi est testé sans envoyer de mail. Le serveur et le port se corrigent dans les réglages de la boîte de réception, qui permettent aussi de relancer le test.
- **Le destinataire** d'une réponse est l'adresse demandée par le mail (`Reply-To`), sinon l'expéditeur. Une faute de frappe dans un domaine courant (`@gamil.com`) bloque l'envoi jusqu'à ce que tu la corriges ou la confirmes.
- **« Accepté par le serveur »** veut dire que ton fournisseur a pris le mail en charge, pas qu'il est arrivé. Si un avis de non-distribution revient, le mail passe à « Non distribué » à la lecture suivante, avec la raison. Un domaine qui existe peut aussi accepter le mail sans rien dire.
- **Si la connexion est coupée pendant l'envoi**, le mail est marqué « incertain » : l'app ne le renvoie pas d'elle-même. Vérifie ton dossier Envoyés. Un second clic sur le même brouillon ne repart pas non plus.
- **Le dossier Envoyés de ta messagerie** reçoit une copie, sauf chez Gmail et Outlook, qui la font eux-mêmes. Une copie ratée n'annule pas l'envoi.
- **« Rédiger avec l'IA »** met en forme tes idées avec Ollama, en local. Tu donnes l'intention (« oui, mardi 14 h ») ; le texte remplit le formulaire et rien ne part sans ton clic. Le code pose la salutation et la signature, et refuse un texte écrit du côté du recruteur ou qui accepte quelque chose que tu n'as pas dit. Tout chiffre que tu n'as pas fourni devient `[à compléter]`, ce qui bloque l'envoi. Relis quand même : un petit modèle peut encore oublier une idée ou ajouter une phrase.

## Développement

```bash
make test-db  # Postgres jetable pour les tests, une fois
make lint
make test
make web      # front en mode développement
make e2e      # parcours complet Playwright, sur une stack jetable
```

`make e2e` lance une stack à part (projet `job-copilot-e2e`, ports 3100 et 8100) puis la détruit : tes données ne sont pas touchées. Le parcours refuse de démarrer sur une stack qui n'est pas vide et en démonstration.

Structure :

```
web/               interface Next.js (design system dans src/components/ui, parcours dans e2e)
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
