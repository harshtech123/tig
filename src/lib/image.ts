/** Center-crops and compresses a picked photo into a small square JPEG data URL. */
export async function compressPhoto(file: File, size = 360, quality = 0.8): Promise<string> {
  const img = await loadImage(URL.createObjectURL(file));
  const s = Math.min(img.naturalWidth, img.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, size, size);
  URL.revokeObjectURL(img.src);
  return canvas.toDataURL('image/jpeg', quality);
}

/** Keeps aspect ratio; used for the gym's own QR image. */
export async function compressImage(file: File, max = 900): Promise<string> {
  const img = await loadImage(URL.createObjectURL(file));
  const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(img.src);
  return canvas.toDataURL('image/png');
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
