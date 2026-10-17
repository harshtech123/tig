import { openDB, type IDBPDatabase } from 'idb';
import type { Client, Settings } from './types';

export const DEFAULT_WHATSAPP = `Hi {name} 👋

Friendly reminder from *{gym}* 💪
Your membership fee of *{amount}* {due}.

Pay via UPI: *{upi}*
or scan the QR code attached.

Thank you! See you at the gym 🏋️`;

export const DEFAULT_SMS = `Hi {name}, your {gym} membership fee of {amount} {due}. Pay via UPI: {upi}. Thank you!`;

export const DEFAULT_SETTINGS: Settings = {
  gymName: 'The Iron Garage Gym',
  upiId: '',
  payeeName: 'The Iron Garage Gym',
  countryCode: '91',
  reminderDays: 2,
  whatsappTemplate: DEFAULT_WHATSAPP,
  smsTemplate: DEFAULT_SMS,
  googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '',
};

let dbp: Promise<IDBPDatabase> | null = null;

function db() {
  dbp ??= openDB('tig-gym', 1, {
    upgrade(d) {
      d.createObjectStore('clients', { keyPath: 'id' });
      d.createObjectStore('kv');
    },
  });
  return dbp;
}

export async function loadClients(): Promise<Client[]> {
  return (await db()).getAll('clients');
}

export async function putClient(c: Client) {
  await (await db()).put('clients', c);
}

export async function deleteClient(id: string) {
  await (await db()).delete('clients', id);
}

export async function replaceAllClients(clients: Client[]) {
  const tx = (await db()).transaction('clients', 'readwrite');
  await tx.store.clear();
  for (const c of clients) await tx.store.put(c);
  await tx.done;
}

export async function loadSettings(): Promise<Settings> {
  const s = await (await db()).get('kv', 'settings');
  return { ...DEFAULT_SETTINGS, ...(s ?? {}) };
}

export async function saveSettings(s: Settings) {
  await (await db()).put('kv', s, 'settings');
}

export function uid(): string {
  return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36);
}
