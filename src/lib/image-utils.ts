"use client";

/**
 * Уменьшение изображений в браузере: загруженные файлы превращаются в небольшие JPEG (data URL),
 * чтобы данные демо-режима помещались в localStorage. Внешние картинки не используются.
 */

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_SOURCE_BYTES = 8 * 1024 * 1024;

export async function resizeImage(file: File, maxSide: number, quality = 0.72): Promise<string> {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) throw new Error("Допустимы только JPG, PNG или WebP");
  if (file.size > MAX_SOURCE_BYTES) throw new Error("Файл больше 8 МБ");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Не удалось прочитать изображение"));
      i.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Браузер не поддерживает обработку изображений");
    ctx.fillStyle = "#0b1020";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}
