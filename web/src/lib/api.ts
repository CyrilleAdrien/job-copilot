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

export async function parseError(response: Response): Promise<ApiError> {
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

async function searchAction(id: string, action: "archive" | "restore" | "delete"): Promise<Profile> {
  const path = `/api/profile/searches/${encodeURIComponent(id)}`;
  const response = await fetch(action === "delete" ? path : `${path}/${action}`, {
    method: action === "delete" ? "DELETE" : "POST",
  });
  if (!response.ok) throw await parseError(response);
  return response.json();
}

export const archiveSearch = (id: string) => searchAction(id, "archive");
export const restoreSearch = (id: string) => searchAction(id, "restore");
export const deleteSearch = (id: string) => searchAction(id, "delete");

export const profileExportUrl = "/api/profile/export";

/** Adresse de la photo de profil, qui change avec la photo ; null s'il n'y en a pas. */
export async function fetchPhotoUrl(): Promise<string | null> {
  const response = await fetch("/api/profile/photo/info", { cache: "no-store" });
  if (!response.ok) throw await parseError(response);
  const { updated_at: updatedAt } = await response.json();
  return updatedAt ? `/api/profile/photo?v=${encodeURIComponent(updatedAt)}` : null;
}

export async function uploadPhoto(photo: Blob): Promise<void> {
  const response = await fetch("/api/profile/photo", {
    method: "PUT",
    headers: { "content-type": photo.type },
    body: photo,
  });
  if (!response.ok) throw await parseError(response);
}

export async function deletePhoto(): Promise<void> {
  const response = await fetch("/api/profile/photo", { method: "DELETE" });
  if (!response.ok) throw await parseError(response);
}

export type DataExport = { blob: Blob; filename: string };

/** L'archive complète : un JSON par service, le profil, la photo et les PDF. */
export async function exportAllData(): Promise<DataExport> {
  const response = await fetch("/api/data/export", { cache: "no-store" });
  if (!response.ok) throw await parseError(response);
  const match = /filename="([^"]+)"/.exec(response.headers.get("content-disposition") ?? "");
  return { blob: await response.blob(), filename: match?.[1] ?? "job-copilot.zip" };
}

export async function eraseAllData(): Promise<void> {
  const response = await fetch("/api/data", { method: "DELETE" });
  if (!response.ok) throw await parseError(response);
}
