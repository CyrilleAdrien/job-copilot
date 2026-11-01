import { ApiError } from "@/lib/api";

export const AVATAR_SIZE = 320;
const MAX_SOURCE_BYTES = 25 * 1024 * 1024;

/** Le plus grand carré centré dans une image : le visage reste au milieu, sans déformation. */
export function centerSquare(width: number, height: number) {
  const side = Math.min(width, height);
  return { x: (width - side) / 2, y: (height - side) / 2, side };
}

/** Initiales d'un nom, en attendant une photo. */
export function initials(name: string | null) {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  const letters = words.length > 1 ? [words[0], words[words.length - 1]] : [words[0]];
  return letters.map((word) => [...word][0].toUpperCase()).join("");
}

/** Recadre et réduit la photo dans le navigateur : le serveur reçoit un JPEG léger. */
export async function prepareAvatar(file: File): Promise<Blob> {
  const unreadable = new ApiError("Image illisible : choisis un fichier JPEG, PNG ou WebP.", 415);
  if (file.size > MAX_SOURCE_BYTES) throw new ApiError("Image trop lourde : 25 Mo au maximum.", 413);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw unreadable;
  }
  const { x, y, side } = centerSquare(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = AVATAR_SIZE;
  const context = canvas.getContext("2d");
  if (!context) throw unreadable;
  // Le JPEG n'a pas de transparence : un fond blanc plutôt que du noir.
  context.fillStyle = "#fff";
  context.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
  context.drawImage(bitmap, x, y, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
  if (!blob) throw unreadable;
  return blob;
}
