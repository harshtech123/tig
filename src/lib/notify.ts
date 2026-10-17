import type { Client } from './types';

const SHOWN_KEY = 'tig.notified';

export function notificationsSupported() {
  return 'Notification' in window;
}

export function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
}

export async function requestNotifications(): Promise<NotificationPermission | 'unsupported'> {
  if (!notificationsSupported()) return 'unsupported';
  return Notification.requestPermission();
}

/** Updates the Home Screen icon badge and posts one summary alert per day. */
export async function refreshAlerts(overdue: Client[], dueSoon: Client[]) {
  const count = overdue.length + dueSoon.length;
  try {
    if (count) await navigator.setAppBadge?.(count);
    else await navigator.clearAppBadge?.();
  } catch {
    /* badge unsupported */
  }
  if (!count || !notificationsSupported() || Notification.permission !== 'granted') return;

  const key = new Date().toDateString() + ':' + [...overdue, ...dueSoon].map((c) => c.id).sort().join(',');
  if (localStorage.getItem(SHOWN_KEY) === key) return;
  localStorage.setItem(SHOWN_KEY, key);

  const parts = [];
  if (dueSoon.length) parts.push(`${dueSoon.length} due soon: ${dueSoon.slice(0, 3).map((c) => c.name.split(' ')[0]).join(', ')}${dueSoon.length > 3 ? '…' : ''}`);
  if (overdue.length) parts.push(`${overdue.length} overdue`);
  const reg = await navigator.serviceWorker?.getRegistration();
  const opts = { body: parts.join(' · '), icon: 'icon-192.png', badge: 'icon-192.png', tag: 'tig-due' };
  if (reg) reg.showNotification('💰 Fees reminder', opts);
  else new Notification('💰 Fees reminder', opts);
}
