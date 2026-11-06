import type { StepId } from "@/lib/system";

export type HelpLink = { label: string; url: string };

/** Une étape de configuration expliquée : à quoi elle sert, puis quoi faire, dans l'ordre. */
export type HelpTopic = {
  id: StepId;
  why: string;
  how: string[];
  links?: HelpLink[];
  tip?: string;
  /** Les instructions par fournisseur viennent du service concerné (Gmail, iCloud...). */
  providers?: "mail" | "calendar";
};

export const HELP_TOPICS: HelpTopic[] = [
  {
    id: "systeme",
    why: "Les services de l'application, la base de données, le cache et le stockage des fichiers. Tout tourne sur ton ordinateur, dans Docker.",
    how: [
      "Dans le dossier du projet, lance make up : la stack démarre et la clé de chiffrement est créée dans .env.",
      "Ici, chaque service doit apparaître en vert. Sinon, make ready dit lequel ne répond pas et make logs explique pourquoi.",
      "Garde le fichier .env : la clé qu'il contient déchiffre tes mots de passe. Perdue, il suffit de reconnecter tes comptes.",
    ],
  },
  {
    id: "modele",
    why: "Le modèle d'IA rédige les CV, les lettres et les réponses, et classe les mails des recruteurs. Il tourne sur ton ordinateur avec Ollama : rien ne part ailleurs.",
    how: [
      "Sur Linux et Windows, Ollama tourne déjà dans Docker. Sur Mac, installe Ollama pour macOS, qui utilise la puce Apple : dans .env, supprime la ligne COMPOSE_PROFILES=ollama et ajoute OLLAMA_URL=http://host.docker.internal:11434, puis relance make up.",
      "Télécharge le modèle depuis cette étape : environ 4,7 Go pour qwen2.5:7b. Un téléchargement interrompu reprend où il s'était arrêté.",
      "Clique sur Tester le modèle. La première réponse prend plus de temps : le modèle se charge en mémoire.",
    ],
    links: [
      { label: "Ollama pour macOS", url: "https://ollama.com/download" },
      { label: "Autres modèles", url: "https://ollama.com/library" },
    ],
    tip: "Un modèle 7B demande environ 8 Go de mémoire libre. Sur une machine plus modeste, choisis un modèle plus léger.",
  },
  {
    id: "profil",
    why: "Ton profil donne les critères de recherche des offres et le contenu de chaque CV. L'IA ne fait que choisir et reformuler ce qu'il contient : elle n'invente rien.",
    how: [
      "Remplis-le en cinq étapes, ou importe un fichier profile.yaml.",
      "Crée une recherche par métier visé, par exemple DevOps et Data Engineer : chacune a ses postes, ses technologies, ses filtres et son CV.",
      "Choisis comment retenir les offres : tout le métier, ou seulement celles qui citent tes compétences, avec un seuil réglable.",
      "Exporte ton profil en profile.yaml de temps en temps : c'est ta sauvegarde.",
    ],
  },
  {
    id: "sources",
    why: "Les offres viennent des APIs officielles de France Travail et d'Adzuna, gratuites après inscription. Une seule source suffit pour commencer.",
    how: [
      "France Travail : crée un compte sur francetravail.io, puis une application avec l'API « Offres d'emploi v2 ». Copie l'identifiant client et la clé secrète.",
      "Adzuna : crée un compte développeur, puis copie l'Application ID et l'Application key.",
      "Colle les clés dans cette étape. Elles sont testées auprès de la source, puis enregistrées chiffrées sur ton ordinateur.",
    ],
    links: [
      { label: "francetravail.io", url: "https://francetravail.io" },
      { label: "developer.adzuna.com", url: "https://developer.adzuna.com" },
    ],
  },
  {
    id: "boite-mail",
    why: "La boîte mail permet de retrouver les réponses des recruteurs, de les rattacher à la bonne candidature et de mettre son statut à jour. Tu peux aussi répondre depuis l'application.",
    how: [
      "Choisis l'adresse à connecter. Nous te recommandons une adresse dédiée à tes candidatures (voir plus bas).",
      "Crée un mot de passe d'application chez ton fournisseur, en suivant ses étapes ci-dessous. Ton vrai mot de passe n'est jamais demandé.",
      "Connecte la boîte dans cette étape : la lecture est testée, puis l'envoi. La boîte est relue toutes les 15 minutes, ou à la demande.",
    ],
    providers: "mail",
  },
  {
    id: "calendrier",
    why: "Facultatif : les entretiens sont recopiés dans ton calendrier iCloud ou Google. Sans cela, ils restent visibles dans l'application et dans un flux .ics.",
    how: [
      "Crée un mot de passe d'application chez ton fournisseur, en suivant ses étapes ci-dessous.",
      "Connecte le calendrier dans cette étape, puis choisis celui qui recevra les entretiens.",
      "Sans compte CalDAV, abonne ton calendrier au flux .ics proposé dans cette même étape.",
    ],
    providers: "calendar",
  },
];

/** Questions fréquentes, après les étapes. */
export const HELP_FAQ: { question: string; answer: string }[] = [
  {
    question: "Où sont mes données ?",
    answer:
      "Sur ton ordinateur uniquement : dans la base et le stockage de la stack Docker. Aucun compte, aucun serveur central. Les mots de passe et les clés sont chiffrés avec la clé de ton fichier .env.",
  },
  {
    question: "Comment sauvegarder ou tout effacer ?",
    answer:
      "Réglages, étape Mes données : exporte une archive .zip (profil, offres, candidatures, mails, CV, lettres), ou supprime tout en un clic. Ta vraie boîte mail et ton calendrier en ligne ne sont pas touchés.",
  },
  {
    question: "À quoi sert le mode démonstration ?",
    answer:
      "À essayer l'outil sans aucun compte : un profil d'exemple, des offres, des réponses de recruteurs et un calendrier fictifs, sans IA. Pour passer à tes vrais comptes, clique sur Démonstration · Quitter en haut de l'écran : les données fictives sont effacées et l'assistant reprend.",
  },
  {
    question: "Est-ce que l'outil postule à ma place ?",
    answer:
      "Non. Il prépare l'offre, le CV et la lettre, puis tu valides chaque envoi. Aucun robot ne se connecte à LinkedIn ou à Indeed, dont les conditions d'utilisation l'interdisent.",
  },
  {
    question: "Comment mettre l'application à jour ?",
    answer: "Dans le dossier du projet : git pull, puis make up. Tes données restent dans les volumes Docker.",
  },
];
