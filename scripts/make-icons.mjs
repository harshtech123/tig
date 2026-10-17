// Generates PWA / iOS icons from the gym logo (tig.png).
import sharp from 'sharp';

const SRC = 'tig.png';
const BG = { r: 0, g: 0, b: 0, alpha: 1 };

async function icon(size, logoScale, out) {
  const inner = Math.round(size * logoScale);
  const logo = await sharp(SRC).resize(inner, inner, { kernel: 'lanczos3' }).sharpen().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: BG } })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(out);
}

await icon(180, 1, 'public/apple-touch-icon.png');
await icon(192, 1, 'public/icon-192.png');
await icon(512, 1, 'public/icon-512.png');
await icon(512, 0.8, 'public/icon-maskable-512.png');
await sharp(SRC).resize(64, 64).png().toFile('public/favicon.png');
await sharp(SRC).png().toFile('public/logo.png');
const { data } = await sharp(SRC).extract({ left: 0, top: 0, width: 4, height: 4 }).raw().toBuffer({ resolveWithObject: true });
console.log('corner pixel', [...data.slice(0, 3)]);
