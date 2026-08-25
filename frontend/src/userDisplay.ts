import { User } from "./api";

export function userInitials(user: Pick<User, "first_name" | "last_name">): string {
  return `${user.first_name[0] ?? ""}${user.last_name[0] ?? ""}`.toUpperCase();
}

// A small fixed palette, picked deterministically from the user's id so the
// same person always gets the same color (no avatar-color column needed).
const AVATAR_COLORS = ["#1979d9", "#0f7a3d", "#a35b00", "#7c3aed", "#c2185b", "#0891b2"];

export function userAvatarColor(user: Pick<User, "id">): string {
  return AVATAR_COLORS[user.id % AVATAR_COLORS.length];
}

function resizeImageElement(img: HTMLImageElement, maxSize: number): string {
  const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.85);
}

/** Downscales an uploaded image file client-side (e.g. an avatar or a messenger attachment) so the data URL stays small. */
export function resizeImageToDataUrl(file: File, maxSize: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        try {
          resolve(resizeImageElement(img, maxSize));
        } catch (e) {
          reject(e);
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/** Same downscale, starting from an existing data URL (e.g. a raw screen-capture frame) instead of a File. */
export function resizeDataUrl(dataUrl: string, maxSize: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = reject;
    img.onload = () => {
      try {
        resolve(resizeImageElement(img, maxSize));
      } catch (e) {
        reject(e);
      }
    };
    img.src = dataUrl;
  });
}
