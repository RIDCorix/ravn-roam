export interface CompressImageOptions {
  maxSide?: number;
  maxDataUrlLength?: number;
  fallbackQuality?: number;
}

export async function compressImageToDataUrl(
  file: File,
  {
    maxSide = 1600,
    maxDataUrlLength = 7_500_000,
    fallbackQuality,
  }: CompressImageOptions = {},
): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("not_image");
  }
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas_unavailable");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  for (const quality of [0.82, 0.72, 0.62, 0.52]) {
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    if (dataUrl.length <= maxDataUrlLength) return dataUrl;
  }

  if (fallbackQuality != null) {
    return canvas.toDataURL("image/jpeg", fallbackQuality);
  }
  throw new Error("image_too_large");
}
