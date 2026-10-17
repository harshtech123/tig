import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import * as db from './lib/db';
import * as sync from './lib/sync';
import type { Backup, Client, Payment, Settings } from './lib/types';
import { statusOf, daysLeft } from './lib/client';
import { refreshAlerts } from './lib/notify';

interface Toast {
  id: number;
  text: string;
  tone: 'ok' | 'err' | 'info';
}

interface Store {
  ready: boolean;
  clients: Client[];
  settings: Settings;
  overdue: Client[];
  dueSoon: Client[];
  saveClient(c: Client): Promise<void>;
  removeClient(id: string): Promise<void>;
  addPayment(clientId: string, p: Payment): Promise<void>;
  removePayment(clientId: string, paymentId: string): Promise<void>;
  updateSettings(p: Partial<Settings>): Promise<void>;
  buildBackup(): Backup;
  applyBackup(b: Backup): Promise<void>;
  toast(text: string, tone?: Toast['tone']): void;
  toasts: Toast[];
}

const Ctx = createContext<Store>(null!);
export const useStore = () => useContext(Ctx);
export const useSync = () => useSyncExternalStore(sync.subscribe, sync.getSyncState);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [settings, setSettings] = useState<Settings>(db.DEFAULT_SETTINGS);
  const [toasts, setToasts] = useState<Toast[]>([]);
  // Re-evaluate "due" lists when the app comes back to the foreground on a new day.
  const [tick, setTick] = useState(0);

  const toast = useCallback((text: string, tone: Toast['tone'] = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800);
  }, []);

  const { overdue, dueSoon } = useMemo(() => {
    const o: Client[] = [];
    const d: Client[] = [];
    for (const c of clients) {
      const s = statusOf(c, settings.reminderDays);
      if (s === 'overdue') o.push(c);
      else if (s === 'due') d.push(c);
    }
    o.sort((a, b) => daysLeft(a) - daysLeft(b));
    d.sort((a, b) => daysLeft(a) - daysLeft(b));
    return { overdue: o, dueSoon: d };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients, settings.reminderDays, tick]);

  const buildBackup = useCallback((): Backup => {
    const { googleClientId: _g, ...rest } = settings;
    return { app: 'tig-gym', version: 1, savedAt: Date.now(), clients, settings: rest };
  }, [clients, settings]);

  const applyBackup = useCallback(async (b: Backup) => {
    await db.replaceAllClients(b.clients ?? []);
    const next = { ...db.DEFAULT_SETTINGS, ...b.settings, googleClientId: settings.googleClientId };
    await db.saveSettings(next);
    setClients(b.clients ?? []);
    setSettings(next);
  }, [settings.googleClientId]);

  // Sync engine reads the latest data through these handlers.
  useEffect(() => {
    if (ready) sync.init(settings.googleClientId, { build: buildBackup, apply: applyBackup });
  }, [ready, buildBackup, applyBackup, settings.googleClientId]);

  useEffect(() => {
    (async () => {
      const [c, s] = await Promise.all([db.loadClients(), db.loadSettings()]);
      setClients(c);
      setSettings(s);
      setReady(true);
      navigator.storage?.persist?.();
    })();
    const onVis = () => document.visibilityState === 'visible' && setTick((t) => t + 1);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  useEffect(() => {
    if (ready) refreshAlerts(overdue, dueSoon);
  }, [ready, overdue, dueSoon]);

  const saveClient = useCallback(async (c: Client) => {
    const next = { ...c, updatedAt: Date.now() };
    await db.putClient(next);
    setClients((all) => {
      const i = all.findIndex((x) => x.id === c.id);
      return i < 0 ? [...all, next] : all.map((x) => (x.id === c.id ? next : x));
    });
    sync.markDirty();
  }, []);

  const removeClient = useCallback(async (id: string) => {
    await db.deleteClient(id);
    setClients((all) => all.filter((x) => x.id !== id));
    sync.markDirty();
  }, []);

  const addPayment = useCallback(async (clientId: string, p: Payment) => {
    const c = clients.find((x) => x.id === clientId);
    if (c) await saveClient({ ...c, payments: [...c.payments, p] });
  }, [clients, saveClient]);

  const removePayment = useCallback(async (clientId: string, paymentId: string) => {
    const c = clients.find((x) => x.id === clientId);
    if (c) await saveClient({ ...c, payments: c.payments.filter((p) => p.id !== paymentId) });
  }, [clients, saveClient]);

  const updateSettings = useCallback(async (p: Partial<Settings>) => {
    const next = { ...settings, ...p };
    await db.saveSettings(next);
    setSettings(next);
    if ('googleClientId' in p) sync.setClientId(next.googleClientId);
    if (Object.keys(p).some((k) => k !== 'googleClientId')) sync.markDirty();
  }, [settings]);

  const value: Store = {
    ready, clients, settings, overdue, dueSoon, saveClient, removeClient, addPayment, removePayment,
    updateSettings, buildBackup, applyBackup, toast, toasts,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
