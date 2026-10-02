import { getDb } from "./db";

const KEY_IMAGE = "backgroundImage";
const KEY_POSITION = "backgroundPosition";
const KEY_DIM = "backgroundDim";

export interface BackgroundConfig {
  dataUrl: string | null;
  position: string;
  dim: number;
}

export const DEFAULT_BACKGROUND: BackgroundConfig = {
  dataUrl: null,
  position: "50% 50%",
  dim: 0.15,
};

export function clampDim(dim: number): number {
  if (!Number.isFinite(dim)) return DEFAULT_BACKGROUND.dim;
  return Math.min(0.7, Math.max(0, dim));
}

export async function getBackground(): Promise<BackgroundConfig> {
  const [image, position, dim] = await getDb().settings.bulkGet([
    KEY_IMAGE,
    KEY_POSITION,
    KEY_DIM,
  ]);
  return {
    dataUrl: image?.value || null,
    position: position?.value || DEFAULT_BACKGROUND.position,
    dim: dim ? clampDim(Number(dim.value)) : DEFAULT_BACKGROUND.dim,
  };
}

export async function setBackground(
  dataUrl: string,
  position: string,
  dim: number,
): Promise<void> {
  await getDb().settings.bulkPut([
    { key: KEY_IMAGE, value: dataUrl },
    { key: KEY_POSITION, value: position },
    { key: KEY_DIM, value: String(clampDim(dim)) },
  ]);
}

export async function clearBackground(): Promise<void> {
  await getDb().settings.bulkDelete([KEY_IMAGE, KEY_POSITION, KEY_DIM]);
}

export interface BackgroundStyle {
  backgroundImage?: string;
  backgroundSize?: string;
  backgroundPosition?: string;
  backgroundRepeat?: string;
  backgroundAttachment?: string;
}

export function backgroundStyle(cfg: BackgroundConfig): BackgroundStyle {
  if (!cfg.dataUrl) return {};
  const dim = clampDim(cfg.dim);
  return {
    backgroundImage: `linear-gradient(rgba(0,0,0,${dim}), rgba(0,0,0,${dim})), url("${cfg.dataUrl}")`,
    backgroundSize: "cover",
    backgroundPosition: cfg.position || DEFAULT_BACKGROUND.position,
    backgroundRepeat: "no-repeat",
    backgroundAttachment: "fixed",
  };
}

export function applyBackground(cfg: BackgroundConfig): void {
  if (typeof document === "undefined") return;
  const body = document.body;
  const style = backgroundStyle(cfg);
  if (!style.backgroundImage) {
    body.style.backgroundImage = "";
    body.style.backgroundSize = "";
    body.style.backgroundPosition = "";
    body.style.backgroundRepeat = "";
    body.style.backgroundAttachment = "";
    return;
  }
  body.style.backgroundImage = style.backgroundImage;
  body.style.backgroundSize = style.backgroundSize ?? "";
  body.style.backgroundPosition = style.backgroundPosition ?? "";
  body.style.backgroundRepeat = style.backgroundRepeat ?? "";
  body.style.backgroundAttachment = style.backgroundAttachment ?? "";
}

export async function loadAndApplyBackground(): Promise<void> {
  try {
    applyBackground(await getBackground());
  } catch {}
}

export async function compressImage(
  file: File,
  maxSize = 1600,
): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Gagal membaca gambar"));
    reader.readAsDataURL(file);
  });

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error("Gagal memuat gambar"));
    element.src = dataUrl;
  });

  const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas tidak didukung");
  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.82);
}
