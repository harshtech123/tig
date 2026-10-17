import type { Client, Settings } from './types';
import { daysLeft, dueDate, feeAmount, fullNumber } from './client';
import { fmtDate, fmtMoney } from './dates';

export function dueText(c: Client): string {
  const d = daysLeft(c);
  const date = fmtDate(dueDate(c), { day: 'numeric', month: 'short' });
  if (d === 0) return 'is due today';
  if (d > 0) return `is due on ${date}`;
  return `was due on ${date} (${-d} day${d === -1 ? '' : 's'} overdue)`;
}

export function fillTemplate(tpl: string, c: Client, s: Settings, amount = feeAmount(c)): string {
  const vars: Record<string, string> = {
    name: c.name.trim().split(/\s+/)[0],
    fullname: c.name.trim(),
    amount: fmtMoney(amount),
    due: dueText(c),
    date: fmtDate(dueDate(c)),
    upi: s.upiId || '(UPI ID)',
    gym: s.gymName,
  };
  return tpl.replace(/\{(\w+)\}/g, (m, k) => vars[k] ?? m);
}

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export function whatsappUrl(c: Client, s: Settings, text: string): string {
  return `https://wa.me/${fullNumber(c.mobile, s.countryCode)}?text=${encodeURIComponent(text)}`;
}

export function smsUrl(c: Client, s: Settings, text: string): string {
  const num = '+' + fullNumber(c.mobile, s.countryCode);
  return `sms:${num}${isIOS ? '&' : '?'}body=${encodeURIComponent(text)}`;
}

export function telUrl(c: Client, s: Settings): string {
  return `tel:+${fullNumber(c.mobile, s.countryCode)}`;
}

export function openUrl(url: string) {
  const a = document.createElement('a');
  a.href = url;
  a.target = url.startsWith('http') ? '_blank' : '_self';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Opens the iOS share sheet with the QR card + message. Returns false if sharing files is unsupported. */
export async function shareImageWithText(blob: Blob, filename: string, text: string): Promise<'shared' | 'cancelled' | 'unsupported'> {
  const file = new File([blob], filename, { type: blob.type });
  if (!navigator.canShare?.({ files: [file] })) return 'unsupported';
  try {
    await navigator.share({ files: [file], text });
    return 'shared';
  } catch (e) {
    return (e as DOMException)?.name === 'AbortError' ? 'cancelled' : 'unsupported';
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
