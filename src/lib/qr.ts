import QRCode from 'qrcode';
import { loadImage } from './image';
import { fmtMoney } from './dates';
import type { Settings } from './types';

export function upiUri(s: Settings, amount: number, note: string): string {
  const p = new URLSearchParams({ pa: s.upiId.trim(), pn: s.payeeName || s.gymName, cu: 'INR', tn: note });
  if (amount > 0) p.set('am', amount.toFixed(2));
  return 'upi://pay?' + p.toString().replace(/\+/g, '%20');
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

interface CardInput {
  settings: Settings;
  name: string;
  amount: number;
  dueText: string;
}

/** Renders a branded "scan to pay" image ready to share on WhatsApp. */
export async function renderPayCard({ settings, name, amount, dueText }: CardInput): Promise<Blob> {
  const W = 1080, H = 1560;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  await Promise.all([document.fonts.load('80px "Bebas Neue"'), document.fonts.load('600 40px "Inter Variable"')]);

  // Backdrop
  ctx.fillStyle = '#050607';
  ctx.fillRect(0, 0, W, H);
  const glow = (x: number, y: number, r: number, color: string) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  };
  glow(140, 120, 700, 'rgba(232,181,74,0.28)');
  glow(980, 1400, 800, 'rgba(34,184,176,0.25)');

  // Logo + heading
  const logo = await loadImage(new URL('logo.png', document.baseURI).href);
  ctx.save();
  roundRect(ctx, W / 2 - 110, 60, 220, 220, 48);
  ctx.clip();
  ctx.drawImage(logo, W / 2 - 110, 60, 220, 220);
  ctx.restore();
  ctx.strokeStyle = 'rgba(232,181,74,0.45)';
  ctx.lineWidth = 3;
  roundRect(ctx, W / 2 - 110, 60, 220, 220, 48);
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#F6D27A';
  ctx.font = '84px "Bebas Neue"';
  ctx.fillText(settings.gymName.toUpperCase(), W / 2, 360, W - 120);
  ctx.fillStyle = 'rgba(244,245,246,0.75)';
  ctx.font = '500 38px "Inter Variable", -apple-system, sans-serif';
  ctx.fillText(`Membership fee · ${name}`, W / 2, 420, W - 120);

  // QR panel
  const size = 640, px = (W - size) / 2, py = 470;
  ctx.save();
  ctx.shadowColor = 'rgba(34,184,176,0.45)';
  ctx.shadowBlur = 60;
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, px, py, size, size, 44);
  ctx.fill();
  ctx.restore();

  if (settings.qrImage) {
    const q = await loadImage(settings.qrImage);
    const inner = size - 60;
    const sc = Math.min(inner / q.naturalWidth, inner / q.naturalHeight);
    const w = q.naturalWidth * sc, h = q.naturalHeight * sc;
    ctx.drawImage(q, px + (size - w) / 2, py + (size - h) / 2, w, h);
  } else {
    const qc = document.createElement('canvas');
    await QRCode.toCanvas(qc, upiUri(settings, amount, `${settings.gymName} fee - ${name}`), {
      width: size - 60,
      margin: 0,
      errorCorrectionLevel: 'M',
      color: { dark: '#0b0d0e', light: '#ffffff' },
    });
    ctx.drawImage(qc, px + 30, py + 30);
  }

  // Amount + due text
  let y = py + size + 130;
  if (amount > 0) {
    ctx.fillStyle = '#ffffff';
    ctx.font = '150px "Bebas Neue"';
    ctx.fillText(fmtMoney(amount), W / 2, y);
  }
  y += 62;
  ctx.fillStyle = '#5FE0D6';
  ctx.font = '600 40px "Inter Variable", -apple-system, sans-serif';
  ctx.fillText(dueText, W / 2, y, W - 120);

  // UPI pill
  if (settings.upiId) {
    y += 60;
    const label = `UPI: ${settings.upiId}`;
    ctx.font = '600 38px "Inter Variable", -apple-system, sans-serif';
    const tw = Math.min(ctx.measureText(label).width, W - 200) + 80;
    ctx.fillStyle = 'rgba(232,181,74,0.14)';
    ctx.strokeStyle = 'rgba(232,181,74,0.6)';
    ctx.lineWidth = 3;
    roundRect(ctx, (W - tw) / 2, y, tw, 76, 38);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#F6D27A';
    ctx.fillText(label, W / 2, y + 51, W - 200);
  }

  ctx.fillStyle = 'rgba(244,245,246,0.45)';
  ctx.font = '500 30px "Inter Variable", -apple-system, sans-serif';
  ctx.fillText('Scan with any UPI app · GPay · PhonePe · Paytm', W / 2, H - 50);

  return new Promise((res) => c.toBlob((b) => res(b!), 'image/png'));
}
