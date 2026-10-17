// Google Drive backup using the hidden per-app folder (appDataFolder).
// No server: the browser gets a short-lived OAuth token via Google Identity Services.

const SCOPE = 'https://www.googleapis.com/auth/drive.appdata openid email';
const FILE_NAME = 'tig-gym-backup.json';
const TOKEN_KEY = 'tig.drive.token';

interface TokenClient {
  requestAccessToken(o?: { prompt?: string; login_hint?: string }): void;
  callback: (r: { access_token?: string; expires_in?: number; error?: string }) => void;
  error_callback?: (e: { type: string }) => void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(cfg: object): TokenClient;
          revoke(token: string, cb?: () => void): void;
        };
      };
    };
  }
}

let gisPromise: Promise<void> | null = null;
let client: TokenClient | null = null;
let clientFor = '';

export function loadGis(): Promise<void> {
  gisPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      gisPromise = null;
      reject(new Error('Could not load Google sign-in (offline?)'));
    };
    document.head.appendChild(s);
  });
  return gisPromise;
}

/** Call early (e.g. on app start) so the later token request can open its popup within the tap. */
export async function prepare(clientId: string) {
  await loadGis();
  if (client && clientFor === clientId) return;
  client = window.google!.accounts.oauth2.initTokenClient({ client_id: clientId, scope: SCOPE, callback: () => {} });
  clientFor = clientId;
}

export function cachedToken(): string | null {
  try {
    const t = JSON.parse(localStorage.getItem(TOKEN_KEY) ?? 'null');
    if (t && t.exp > Date.now() + 60_000) return t.token;
  } catch {
    /* ignore */
  }
  return null;
}

/** Must be called synchronously from a tap (Safari blocks popups otherwise). */
export function requestToken(loginHint?: string, consent = false): Promise<string> {
  if (!client) return Promise.reject(new Error('Google sign-in not ready yet, try again'));
  return new Promise((resolve, reject) => {
    client!.callback = (r) => {
      if (r.error || !r.access_token) return reject(new Error(r.error ?? 'Sign-in failed'));
      localStorage.setItem(TOKEN_KEY, JSON.stringify({ token: r.access_token, exp: Date.now() + (r.expires_in ?? 3600) * 1000 }));
      resolve(r.access_token);
    };
    client!.error_callback = (e) => reject(new Error(e.type === 'popup_closed' ? 'Sign-in cancelled' : 'Sign-in popup blocked'));
    client!.requestAccessToken({ prompt: consent ? 'consent' : '', login_hint: loginHint });
  });
}

export function forgetToken() {
  const t = cachedToken();
  localStorage.removeItem(TOKEN_KEY);
  if (t) window.google?.accounts.oauth2.revoke(t);
}

async function api(token: string, url: string, init: RequestInit = {}) {
  const r = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) } });
  if (r.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    throw new Error('Google session expired');
  }
  if (!r.ok) throw new Error(`Google Drive error ${r.status}`);
  return r;
}

export async function userEmail(token: string): Promise<string> {
  const r = await api(token, 'https://www.googleapis.com/oauth2/v3/userinfo');
  return (await r.json()).email ?? '';
}

export interface RemoteMeta {
  id: string;
  modifiedTime: string;
}

export async function findBackup(token: string): Promise<RemoteMeta | null> {
  const q = encodeURIComponent(`name='${FILE_NAME}' and trashed=false`);
  const r = await api(token, `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${q}&fields=files(id,modifiedTime)&orderBy=modifiedTime desc`);
  return (await r.json()).files?.[0] ?? null;
}

export async function getMeta(token: string, id: string): Promise<RemoteMeta | null> {
  try {
    const r = await api(token, `https://www.googleapis.com/drive/v3/files/${id}?fields=id,modifiedTime,trashed`);
    const m = await r.json();
    return m.trashed ? null : m;
  } catch (e) {
    if (String(e).includes('404')) return null;
    throw e;
  }
}

export async function download<T>(token: string, id: string): Promise<T> {
  const r = await api(token, `https://www.googleapis.com/drive/v3/files/${id}?alt=media`);
  return r.json();
}

/** Creates the backup file once, then overwrites the same file on every later save. */
export async function upload(token: string, json: string, id?: string): Promise<RemoteMeta> {
  if (id) {
    const r = await api(token, `https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media&fields=id,modifiedTime`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: json,
    });
    return r.json();
  }
  const boundary = 'tig' + Math.random().toString(36).slice(2);
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify({ name: FILE_NAME, parents: ['appDataFolder'], mimeType: 'application/json' }) +
    `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${json}\r\n--${boundary}--`;
  const r = await api(token, 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,modifiedTime', {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
  return r.json();
}
