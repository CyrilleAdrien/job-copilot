# Guide d'utilisation

Le détail de chaque écran et de l'API servie par la gateway. Pour installer l'outil, voir le [README](../README.md) ; pour la carte des services, [architecture.md](architecture.md).

## Premier lancement

Tant qu'aucun mode n'est choisi et qu'aucun profil n'existe, l'application ouvre l'assistant `/configuration`. Il propose de configurer l'outil ou de l'essayer en démonstration.

- **Configuration** : système, modèle d'IA, profil (indispensables), puis sources d'offres, boîte mail et calendrier (facultatifs). Chaque étape montre son mode d'emploi à côté du formulaire de Réglages correspondant. « Terminer » enregistre le mode réel.
- **Démonstration** : profil d'exemple, boîte et calendrier fictifs, offres fictives, rédaction sans IA. Le mode est rangé dans Redis (persistant) et lu par chaque service à chaque appel : aucun redémarrage n'est nécessaire. « Démonstration · Quitter » efface tout, puis rouvre l'assistant. Les drapeaux de `.env` (`JOBS_DEMO`, `MAIL_DEMO`, `CALENDAR_DEMO`, `LLM_PROVIDER=demo`) forcent toujours la démonstration, pour les stacks de test.

Un écran dont la configuration manque reste dans le menu, avec un cadenas. Ouvert, il dit ce qui manque, avec un lien vers l'étape et vers l'aide : Offres demande un profil et une source, la Boîte de réception une boîte connectée, le tableau de bord, les Candidatures et le Calendrier un profil.

La page **Aide** (`/aide`) reprend chaque étape : à quoi elle sert, quoi faire dans l'ordre, les instructions de chaque fournisseur de mail et de calendrier, son état, et un lien vers Réglages.

| Méthode | Chemin | Rôle |
| --- | --- | --- |
| `GET` | `/api/system/mode` | Mode choisi (`real`, `demo` ou `null`) et démonstration imposée par `.env` |
| `PUT` | `/api/system/mode` | Choisir le mode ; quitter la démonstration exige d'effacer ses données (409) |
| `POST` | `/api/system/demo` | Lancer la démonstration : profil, boîte, calendrier et offres fictifs. Peut être relancé |
| `POST` | `/api/system/llm/pull` | Télécharger un modèle dans Ollama, progression en NDJSON |

## Profil

Au premier lancement, http://job-copilot.localhost:3000/bienvenue propose deux chemins : remplir le profil en cinq étapes (identité, recherches, expériences, compétences, parcours) ou importer un `profile.yaml`. Chaque recherche a son propre CV, vide ou copié d'une autre recherche : le nom, le contact, la photo, les liens, le permis et les langues restent communs. Le formulaire couvre toutes les sections d'un CV : coordonnées complètes, permis, formation, certifications, formations suivies, projets, bénévolat, publications, récompenses, références, langues, savoir-être, centres d'intérêt et sections libres. Les langues, niveaux, technologies, postes et villes sont proposés pendant la saisie. Le fichier [`examples/profile.example.yaml`](../examples/profile.example.yaml) montre le format complet ; un ancien fichier, avec une seule section `search` ou un CV commun, reste accepté : son CV est copié dans chaque recherche. L'onglet CV de l'écran Profil permet de choisir, pour chaque recherche, ce qui s'affiche, l'ordre des rubriques, leur nom, la police et les couleurs, sans passer par l'IA. Par défaut, l'adresse complète, la date de naissance, la nationalité et les références restent masquées. Une fois un CV généré, le bouton Modifier ouvre le studio en plein écran : le texte d'un côté (gras, italique, souligné, listes à puces ou numérotées), l'aperçu de l'autre, et un onglet Personnaliser pour l'en-tête, les rubriques, les couleurs de fond, de texte et de traits, et la police parmi dix polices libres, dont des équivalents de Calibri, Arial et Times New Roman. Chaque modification s'annule et se rétablit. Fermer sans enregistrer demande confirmation, et le téléchargement attend la fin de l'enregistrement. Le même studio sert à la mise en page du CV de chaque recherche. L'écran Profil permet aussi de choisir une photo, affichée sur tout le site et sur les CV. Elle ne figure pas dans ce fichier.

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

La barre du haut cherche dans les offres de la période affichée, par poste, entreprise, lieu ou résumé, sans tenir compte des accents. Le bouton **Créer** ouvre une nouvelle candidature, un message, un événement ou une recherche.

Sans clé, `JOBS_DEMO=true` active des offres fictives pour essayer l'outil. Une collecte reste en cache 15 minutes dans Redis, un délai réglable dans Réglages. Le bouton Actualiser force une nouvelle collecte. Aucune recherche ne tourne en tâche de fond : elle part quand tu ouvres les offres.

| Méthode | Chemin | Rôle |
| --- | --- | --- |
| `GET` | `/api/jobs/offers?search=devops&sort=date\|relevance&max_age_days=7` | Offres de la recherche et de la fenêtre, triées (première recherche si `search` est absent) |
| `GET` | `/api/jobs/offers/{id}?search=devops` | Détail d'une offre avec sa description complète |
| `POST` | `/api/jobs/refresh?search=devops&force=true` | Collecter les offres de la recherche auprès des sources |
| `GET` | `/api/jobs/sources` | Sources connues et configurées |

## CV et lettre

Depuis une offre, « Préparer la candidature » ouvre sa fiche et génère un CV et, si tu le souhaites, une lettre de motivation. La langue suit celle de l'offre (français ou anglais), ou se choisit à la main. La progression s'affiche étape par étape (lecture de l'offre, sélection des expériences, rédaction, mise en page), puis l'aperçu des pages apparaît. La lettre se relit et se modifie avant téléchargement : chaque enregistrement refait le PDF dans une nouvelle version.

Le LLM tourne en local avec Ollama (Qwen 2.5 7B par défaut, téléchargé depuis Réglages ou avec `make models`). Il choisit les expériences utiles et reformule les missions du profil, sans rien ajouter. Un contrôle compare ensuite le texte généré au profil et signale les chiffres absents du profil ou les missions sans équivalent, à vérifier avant d'envoyer. Avec `LLM_PROVIDER=demo`, la génération se fait sans LLM : le contenu du profil est repris tel quel.

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
- Les clés France Travail et Adzuna saisies dans Réglages sont chiffrées en base de la même façon ; celles de `.env` servent de repli.
- `web` et `gateway` ne sont publiés que sur `127.0.0.1`. L'API n'a pas de compte : elle refuse donc les noms d'hôte étrangers et les écritures venues d'un autre site.

## Réglages

L'onglet Réglages réunit toute la configuration, dans l'ordre où chaque étape dépend de la précédente. Chacune affiche son état, et une étape verrouillée dit ce qui manque avant elle.

| Étape | Contenu | Dépend de |
| --- | --- | --- |
| 1. Système | État des services, de la base, de Redis, du stockage et de la clé de chiffrement | rien |
| 2. Modèle IA | Modèle Ollama utilisé par tous les services, avec un test | Ollama lancé |
| 3. Profil | Identité et critères de recherche | service profil |
| 4. Sources d'offres | Clés France Travail et Adzuna, délai entre deux recherches | profil, service des offres |
| 5. Boîte mail | Lecture, envoi, tests | service mail |
| 6. Calendrier | CalDAV et abonnement .ics (facultatif) | service calendrier |
| 7. Mes données | Export et suppression | rien |

Les clés saisies ici sont testées auprès de la source, chiffrées avec `SECRET_KEY` et absentes de l'export. Elles priment sur celles de `.env`. `SECRET_KEY`, la base et les ports restent dans `.env`, car les services en ont besoin pour démarrer. L'intervalle de lecture des boîtes (`MAIL_SYNC_MINUTES`) y reste aussi pour l'instant.

L'écran présente les étapes à gauche et le contenu de celle choisie à droite. Une étape qui demande une action s'ouvre seule.

## Écrire et répondre aux mails

La boîte de réception se filtre par texte, période, statut de la réponse, statut de la candidature, rattachement et boîte. Le dossier Envoyés se filtre aussi par état de distribution.

La boîte de réception se lit comme une messagerie : une ligne par mail, en gras s'il reste à vérifier, et les dossiers À vérifier, Envoyés et Traités. Les actions (statut, rattachement, catégorie, réponse) apparaissent à l'ouverture du mail. « Nouveau message » écrit à n'importe quelle adresse.

Chaque mail part d'une boîte connectée, en SMTP chiffré, avec le même mot de passe d'application que la lecture, et porte le nom de ton profil.

- **À la connexion**, l'envoi est testé sans envoyer de mail. Le serveur et le port se corrigent dans Réglages, étape Boîte mail, qui permet aussi de relancer le test.
- **Le destinataire** d'une réponse est l'adresse demandée par le mail (`Reply-To`), sinon l'expéditeur. Une faute de frappe dans un domaine courant (`@gamil.com`) bloque l'envoi jusqu'à ce que tu la corriges ou la confirmes.
- **« Accepté par le serveur »** veut dire que ton fournisseur a pris le mail en charge, pas qu'il est arrivé. Si un avis de non-distribution revient, le mail passe à « Non distribué » à la lecture suivante, avec la raison. Un domaine qui existe peut aussi accepter le mail sans rien dire.
- **Si la connexion est coupée pendant l'envoi**, le mail est marqué « incertain » : l'app ne le renvoie pas d'elle-même. Vérifie ton dossier Envoyés. Un second clic sur le même brouillon ne repart pas non plus.
- **Le dossier Envoyés de ta messagerie** reçoit une copie, sauf chez Gmail et Outlook, qui la font eux-mêmes. Une copie ratée n'annule pas l'envoi.
- **« Rédiger avec l'IA »** met en forme tes idées avec Ollama, en local. Tu donnes l'intention (« oui, mardi 14 h ») ; le texte remplit le formulaire et rien ne part sans ton clic. Le code pose la salutation et la signature, et refuse un texte écrit du côté du recruteur ou qui accepte quelque chose que tu n'as pas dit. Tout chiffre que tu n'as pas fourni devient `[à compléter]`, ce qui bloque l'envoi. Relis quand même : un petit modèle peut encore oublier une idée ou ajouter une phrase.
