import type { Profile } from "@/lib/profile";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details: { loc: string; msg: string }[] = [],
  ) {
    super(message);
  }
}

async function parseError(response: Response): Promise<ApiError> {
  const body = await response.json().catch(() => null);
  const detail = body?.detail;
  if (typeof detail === "string") return new ApiError(detail, response.status);
  if (detail?.message) return new ApiError(detail.message, response.status, detail.errors ?? []);
  if (Array.isArray(detail)) {
    const errors = detail.map((error: { loc: string[]; msg: string }) => ({
      loc: error.loc.slice(1).join("."),
      msg: error.msg,
    }));
    return new ApiError("Certains champs sont invalides.", response.status, errors);
  }
  return new ApiError("Une erreur inattendue est survenue.", response.status);
}

export async function fetchProfile(): Promise<Profile | null> {
  const response = await fetch("/api/profile/", { cache: "no-store" });
  if (response.status === 404) return null;
  if (!response.ok) throw await parseError(response);
  return response.json();
}

export async function saveProfile(profile: Profile): Promise<Profile> {
  const response = await fetch("/api/profile/", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(profile),
  });
  if (!response.ok) throw await parseError(response);
  return response.json();
}

export async function importProfile(yaml: string): Promise<Profile> {
  const response = await fetch("/api/profile/import", {
    method: "POST",
    headers: { "content-type": "application/yaml" },
    body: yaml,
  });
  if (!response.ok) throw await parseError(response);
  return response.json();
}

export const profileExportUrl = "/api/profile/export";
