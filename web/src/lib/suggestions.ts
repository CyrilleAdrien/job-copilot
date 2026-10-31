/** Listes proposées pendant la saisie du profil. Une valeur absente reste toujours possible. */

export const languageNames = [
  "Français",
  "Anglais",
  "Espagnol",
  "Allemand",
  "Italien",
  "Portugais",
  "Néerlandais",
  "Arabe",
  "Chinois (mandarin)",
  "Japonais",
  "Russe",
  "Polonais",
  "Turc",
  "Coréen",
  "Hindi",
  "Wolof",
  "Lingala",
  "Swahili",
];

export const languageLevels = [
  "Langue maternelle",
  "Bilingue",
  "C2 (maîtrise)",
  "C1 (avancé)",
  "B2 (indépendant)",
  "B1 (intermédiaire)",
  "A2 (élémentaire)",
  "A1 (débutant)",
];

export const roles = [
  "Ingénieur DevOps",
  "Ingénieur SRE",
  "Platform Engineer",
  "Ingénieur Cloud",
  "Data Engineer",
  "Data Analyst",
  "Data Scientist",
  "Analytics Engineer",
  "Machine Learning Engineer",
  "Développeur backend",
  "Développeur frontend",
  "Développeur full stack",
  "Ingénieur logiciel",
  "Administrateur systèmes",
  "Ingénieur sécurité",
  "Ingénieur réseau",
  "Chef de projet IT",
  "Product Owner",
];

export const technologies = [
  "Python",
  "SQL",
  "Java",
  "JavaScript",
  "TypeScript",
  "Go",
  "Bash",
  "Scala",
  "Rust",
  "C#",
  "Docker",
  "Kubernetes",
  "Helm",
  "Terraform",
  "Ansible",
  "AWS",
  "GCP",
  "Azure",
  "Linux",
  "Git",
  "GitLab CI",
  "GitHub Actions",
  "Jenkins",
  "Argo CD",
  "Prometheus",
  "Grafana",
  "ELK",
  "Datadog",
  "PostgreSQL",
  "MySQL",
  "MongoDB",
  "Redis",
  "Kafka",
  "Spark",
  "Airflow",
  "dbt",
  "Snowflake",
  "BigQuery",
  "Databricks",
  "Pandas",
  "Power BI",
  "Tableau",
  "FastAPI",
  "Django",
  "Spring",
  "React",
  "Next.js",
  "Node.js",
];

export const skillCategories = [
  "Langages",
  "Conteneurs et cloud",
  "CI/CD et automatisation",
  "Infrastructure as Code",
  "Supervision",
  "Bases de données",
  "Données et pipelines",
  "Visualisation",
  "Frameworks",
  "Méthodes",
];

export const cities = [
  "Paris",
  "Lyon",
  "Marseille",
  "Toulouse",
  "Lille",
  "Bordeaux",
  "Nantes",
  "Strasbourg",
  "Montpellier",
  "Rennes",
  "Nice",
  "Grenoble",
  "Angers",
  "Sophia Antipolis",
];

export const softSkills = [
  "Rigueur",
  "Autonomie",
  "Travail en équipe",
  "Communication",
  "Curiosité",
  "Esprit d'analyse",
  "Calme sous pression",
  "Adaptabilité",
  "Sens du service",
  "Pédagogie",
];

export const contractNames = ["CDI", "CDD", "Alternance", "Stage", "Freelance", "Intérim"];

/** Les suggestions qui commencent par la saisie, puis celles qui la contiennent. */
export function filterSuggestions(options: string[], query: string, exclude: string[] = [], limit = 6): string[] {
  const fold = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const q = fold(query.trim());
  const taken = new Set(exclude.map(fold));
  const available = options.filter((option) => !taken.has(fold(option)));
  if (!q) return available.slice(0, limit);
  const starts = available.filter((option) => fold(option).startsWith(q));
  const contains = available.filter((option) => !fold(option).startsWith(q) && fold(option).includes(q));
  return [...starts, ...contains].slice(0, limit);
}
