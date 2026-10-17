// Auto-backup engine: every local change marks the data "dirty"; a single debounced
// upload then overwrites the one backup file in Google Drive. Bursts of edits
// therefore produce one upload, not one per tap.
import * as drive from './drive';
import type { Backup } from './types';

export type SyncStatus = 'off' | 'idle' | 'pending' | 'syncing' | 'needs-auth' | 'conflict' | 'error';

export interface SyncState {
  connected: boolean;
  email: string;
  fileId?: string;
  /** Drive's modifiedTime of the version we last wrote or restored. */
  remoteModified?: string;
  lastSyncedAt?: number;
  dirty: boolean;
  status: SyncStatus;
  error?: string;
}

const KEY = 'tig.sync';
const DEBOUNCE_MS = 4000;

let state: SyncState = load();
const listeners = new Set<() => void>();
let timer: number | undefined;
let handlers: { build: () => Backup; apply: (b: Backup) => Promise<void> } | null = null;
let clientId = '';

function load(): SyncState {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (s) return { ...s, status: s.connected ? (s.dirty ? 'pending' : 'idle') : 'off', error: undefined };
  } catch {
    /* ignore */
  }
  return { connected: false, email: '', dirty: false, status: 'off' };
}

function set(p: Partial<SyncState>) {
  state = { ...state, ...p };
  const { status: _s, error: _e, ...persist } = state;
  localStorage.setItem(KEY, JSON.stringify(persist));
  listeners.forEach((l) => l());
}

export const getSyncState = () => state;
export function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

let started = false;

/** Called whenever the data changes so uploads always serialize the latest state. */
export function init(id: string, h: typeof handlers) {
  handlers = h;
  clientId = id;
  if (started) return;
  started = true;
  // Load Google sign-in early so a later tap can open its popup immediately.
  if (id) drive.prepare(id).catch(() => {});
  if (state.connected && id && state.dirty) schedule(1500);
}

export function setClientId(id: string) {
  clientId = id;
  if (id) drive.prepare(id).catch(() => {});
}

export function markDirty() {
  set({ dirty: true, status: state.connected ? 'pending' : 'off' });
  if (state.connected) schedule(DEBOUNCE_MS);
}

function schedule(ms: number) {
  clearTimeout(timer);
  timer = window.setTimeout(() => flush(), ms);
}

/** Upload if there are unsaved changes. Never opens a popup — if the token expired, asks for a tap. */
export async function flush(force = false) {
  if (!state.connected || !handlers || (!state.dirty && !force) || state.status === 'syncing' || state.status === 'conflict') return;
  const token = drive.cachedToken();
  if (!token) return set({ status: 'needs-auth' });
  set({ status: 'syncing', error: undefined });
  try {
    if (state.fileId && !force) {
      const meta = await drive.getMeta(token, state.fileId);
      if (meta && state.remoteModified && meta.modifiedTime !== state.remoteModified) {
        return set({ status: 'conflict' });
      }
      if (!meta) set({ fileId: undefined });
    }
    const meta = await drive.upload(token, JSON.stringify(handlers.build()), state.fileId);
    set({ fileId: meta.id, remoteModified: meta.modifiedTime, lastSyncedAt: Date.now(), dirty: false, status: 'idle' });
  } catch (e) {
    set({ status: drive.cachedToken() ? 'error' : 'needs-auth', error: (e as Error).message });
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && state.dirty) flush();
  });
  window.addEventListener('online', () => state.dirty && flush());
}

/** Tap handler for "Sync now" / "Tap to reconnect". */
export async function syncNow() {
  try {
    if (!drive.cachedToken()) await drive.requestToken(state.email);
    if (state.status === 'needs-auth' || state.status === 'error') set({ status: state.dirty ? 'pending' : 'idle' });
    await flush(true);
  } catch (e) {
    set({ status: 'needs-auth', error: (e as Error).message });
  }
}

export interface ConnectResult {
  existing?: { backup: Backup; meta: drive.RemoteMeta };
}

/** Tap handler. Signs in and looks for an existing backup before writing anything. */
export async function connect(): Promise<ConnectResult> {
  if (!clientId) throw new Error('Add your Google Client ID first');
  await drive.prepare(clientId);
  const token = await drive.requestToken(undefined, !state.email);
  const email = await drive.userEmail(token).catch(() => '');
  const meta = await drive.findBackup(token);
  set({ email, fileId: meta?.id });
  if (meta) {
    const backup = await drive.download<Backup>(token, meta.id);
    return { existing: { backup, meta } };
  }
  set({ connected: true, remoteModified: undefined });
  await flush(true);
  return {};
}

/** Replace this phone's data with the Drive backup. */
export async function restore(existing?: { backup: Backup; meta: drive.RemoteMeta }) {
  if (!handlers) return;
  let ex = existing;
  if (!ex) {
    const token = drive.cachedToken() ?? (await drive.requestToken(state.email));
    const meta = await drive.findBackup(token);
    if (!meta) throw new Error('No backup found in Google Drive');
    ex = { meta, backup: await drive.download<Backup>(token, meta.id) };
  }
  if (ex.backup?.app !== 'tig-gym') throw new Error('Backup file is not a TIG Gym backup');
  await handlers.apply(ex.backup);
  clearTimeout(timer);
  set({ connected: true, fileId: ex.meta.id, remoteModified: ex.meta.modifiedTime, dirty: false, lastSyncedAt: Date.now(), status: 'idle' });
}

/** Keep this phone's data and overwrite the Drive backup with it. */
export async function overwriteRemote() {
  set({ connected: true, status: 'pending', dirty: true });
  await flush(true);
}

export function disconnect() {
  clearTimeout(timer);
  drive.forgetToken();
  set({ connected: false, email: '', fileId: undefined, remoteModified: undefined, status: 'off' });
}
