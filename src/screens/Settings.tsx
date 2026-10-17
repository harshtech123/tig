import { useRef, useState, type ReactNode } from 'react';
import { BellRing, CalendarPlus, ChevronDown, CloudDownload, FileDown, FileUp, ImagePlus, Loader2, LogOut, RefreshCw, RotateCcw } from 'lucide-react';
import { useStore, useSync } from '../store';
import { Confirm, Sheet, SyncChip } from '../components/ui';
import * as sync from '../lib/sync';
import { compressImage } from '../lib/image';
import { addToCalendar } from '../lib/ics';
import { downloadBlob } from '../lib/messaging';
import { notificationsSupported, requestNotifications } from '../lib/notify';
import { DEFAULT_SMS, DEFAULT_WHATSAPP } from '../lib/db';
import { today } from '../lib/dates';
import type { Backup } from '../lib/types';

function ago(ts?: number) {
  if (!ts) return 'never';
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/** Text field that saves when you leave it, so typing doesn't trigger a backup per letter. */
function SavedInput({ value, onSave, area, ...rest }: { value: string; onSave: (v: string) => void; area?: boolean } & React.InputHTMLAttributes<HTMLInputElement>) {
  const [v, setV] = useState(value);
  const commit = () => v !== value && onSave(v);
  return area ? (
    <textarea className="input" value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} rows={7} />
  ) : (
    <input className="input" value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} {...rest} />
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <div className="section-title">
        <span>{title}</span>
      </div>
      {children}
    </>
  );
}

export function Settings() {
  const store = useStore();
  const { settings, updateSettings, toast, clients } = store;
  const s = useSync();
  const [busy, setBusy] = useState('');
  const [found, setFound] = useState<sync.ConnectResult['existing'] | null>(null);
  const [confirm, setConfirm] = useState<'disconnect' | 'restore' | 'import' | null>(null);
  const [pendingImport, setPendingImport] = useState<Backup | null>(null);
  const [showSetup, setShowSetup] = useState(!settings.googleClientId);
  const [perm, setPerm] = useState(notificationsSupported() ? Notification.permission : 'unsupported');
  const qrRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label);
    try {
      await fn();
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy('');
    }
  }

  const connect = () =>
    run('connect', async () => {
      const r = await sync.connect();
      if (r.existing) setFound(r.existing);
      else toast('Google Drive connected · backed up');
    });

  const origin = location.origin;

  return (
    <div className="screen">
      <div className="brand-bar" style={{ paddingBottom: 4 }}>
        <div className="titles">
          <div className="eyebrow">Admin</div>
          <h1 className="h-xl">Settings</h1>
        </div>
      </div>

      {/* ---------- Backup ---------- */}
      <Section title="Google Drive backup">
        <div className="card" style={{ padding: 16 }}>
          {s.status === 'conflict' && (
            <div className="banner warn">
              <div>
                <b>The Drive backup was changed from another device.</b> Choose which copy to keep.
                <div className="btn-row mt">
                  <button className="btn sm ghost" onClick={() => setConfirm('restore')}>
                    Use Drive copy
                  </button>
                  <button className="btn sm primary" onClick={() => run('sync', sync.overwriteRemote)}>
                    Keep this phone
                  </button>
                </div>
              </div>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <b style={{ display: 'block' }}>{s.connected ? s.email || 'Connected' : 'Not connected'}</b>
              <span className="muted" style={{ fontSize: 13 }}>
                {s.connected ? `Last backup ${ago(s.lastSyncedAt)} · auto-saves after every change` : 'Free, private backup in your Google Drive'}
              </span>
            </div>
            {s.connected && <SyncChip onClick={() => run('sync', sync.syncNow)} />}
          </div>
          {s.error && s.status !== 'idle' && <div className="err">{s.error}</div>}

          <div className="btn-row mt">
            {!s.connected ? (
              <button className="btn primary" disabled={!settings.googleClientId || busy === 'connect'} onClick={connect}>
                {busy === 'connect' ? <Loader2 size={18} className="spin" /> : <CloudDownload size={18} />} Connect Google Drive
              </button>
            ) : (
              <>
                <button className="btn sm ghost" onClick={() => run('sync', sync.syncNow)}>
                  {busy === 'sync' ? <Loader2 size={16} className="spin" /> : <RefreshCw size={16} />} Back up now
                </button>
                <button className="btn sm ghost" onClick={() => setConfirm('restore')}>
                  <RotateCcw size={16} /> Restore
                </button>
              </>
            )}
          </div>
          {s.connected && (
            <button className="btn sm danger block mt" onClick={() => setConfirm('disconnect')}>
              <LogOut size={16} /> Disconnect
            </button>
          )}

          <button className="hint" style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 14 }} onClick={() => setShowSetup(!showSetup)}>
            <ChevronDown size={16} style={{ transform: showSetup ? 'rotate(180deg)' : '', transition: 'transform .2s' }} /> One-time Google setup {settings.googleClientId ? '✓' : ''}
          </button>
          {showSetup && (
            <div style={{ marginTop: 10 }}>
              <ol className="steps">
                <li>
                  Open <b>console.cloud.google.com</b> → create a project (free).
                </li>
                <li>
                  <b>APIs &amp; Services → Library</b> → enable <b>Google Drive API</b>.
                </li>
                <li>
                  <b>OAuth consent screen</b> → External → add your Gmail as a <b>Test user</b> → <b>Publish app</b>.
                </li>
                <li>
                  <b>Credentials → Create OAuth client ID → Web application</b>. Authorised JavaScript origin: <code>{origin}</code>
                </li>
                <li>Paste the Client ID below.</li>
              </ol>
              <label className="field mt">
                <span>Google Client ID</span>
                <SavedInput
                  value={settings.googleClientId}
                  placeholder="xxxx.apps.googleusercontent.com"
                  autoCapitalize="off"
                  autoCorrect="off"
                  onSave={(v) => updateSettings({ googleClientId: v.trim() }).then(() => toast('Client ID saved'))}
                />
              </label>
            </div>
          )}
        </div>

        <div className="card group mt">
          <button
            className="group-row"
            onClick={() => {
              const blob = new Blob([JSON.stringify(store.buildBackup())], { type: 'application/json' });
              downloadBlob(blob, `tig-gym-backup-${today()}.json`);
              toast('Backup file saved');
            }}
          >
            <span className="ic" style={{ background: 'rgba(34,184,176,.14)', color: 'var(--teal-2)' }}>
              <FileDown size={18} />
            </span>
            <span className="tx">
              <b>Export backup file</b>
              <span>Save to Files / iCloud Drive — works without Google</span>
            </span>
          </button>
          <button className="group-row" onClick={() => importRef.current?.click()}>
            <span className="ic" style={{ background: 'rgba(232,181,74,.14)', color: 'var(--gold-2)' }}>
              <FileUp size={18} />
            </span>
            <span className="tx">
              <b>Import backup file</b>
              <span>Replace this phone's data from a .json backup</span>
            </span>
          </button>
          <input
            ref={importRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              try {
                const b = JSON.parse(await f.text()) as Backup;
                if (b.app !== 'tig-gym') throw new Error();
                setPendingImport(b);
                setConfirm('import');
              } catch {
                toast('That is not a TIG Gym backup file', 'err');
              }
            }}
          />
        </div>
      </Section>

      {/* ---------- Payments ---------- */}
      <Section title="Payment details">
        <div className="card" style={{ padding: 16 }}>
          <label className="field">
            <span>Your UPI ID</span>
            <SavedInput value={settings.upiId} placeholder="tiggym@okaxis" autoCapitalize="off" autoCorrect="off" inputMode="email" onSave={(v) => updateSettings({ upiId: v.trim() })} />
          </label>
          <label className="field">
            <span>Payee name (shown in UPI apps)</span>
            <SavedInput value={settings.payeeName} onSave={(v) => updateSettings({ payeeName: v.trim() })} />
          </label>
          <div className="field">
            <span>
              QR code <em>· optional — we generate one from your UPI ID</em>
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {settings.qrImage ? <img className="qr-thumb" src={settings.qrImage} alt="QR" /> : null}
              <button className="btn sm ghost" onClick={() => qrRef.current?.click()}>
                <ImagePlus size={16} /> {settings.qrImage ? 'Replace' : 'Upload my QR'}
              </button>
              {settings.qrImage && (
                <button className="btn sm danger" onClick={() => updateSettings({ qrImage: undefined })}>
                  Remove
                </button>
              )}
            </div>
            <input
              ref={qrRef}
              type="file"
              accept="image/*"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) await updateSettings({ qrImage: await compressImage(f) });
              }}
            />
          </div>
          <label className="field" style={{ marginBottom: 0 }}>
            <span>Country code</span>
            <SavedInput value={settings.countryCode} inputMode="numeric" onSave={(v) => updateSettings({ countryCode: v.replace(/\D/g, '') || '91' })} />
          </label>
        </div>
      </Section>

      {/* ---------- Reminders ---------- */}
      <Section title="Reminders">
        <div className="card" style={{ padding: 16 }}>
          <div className="field">
            <span>Remind me this many days before the due date</span>
            <div className="seg">
              {[1, 2, 3, 5, 7].map((d) => (
                <button key={d} className={settings.reminderDays === d ? 'on' : ''} onClick={() => updateSettings({ reminderDays: d })}>
                  {d}
                  <small>{d === 1 ? 'day' : 'days'}</small>
                </button>
              ))}
            </div>
          </div>
          <div className="btn-row">
            <button
              className="btn sm ghost"
              disabled={perm === 'granted' || perm === 'unsupported'}
              onClick={async () => {
                const r = await requestNotifications();
                setPerm(r);
              }}
            >
              <BellRing size={16} /> {perm === 'granted' ? 'Alerts on' : perm === 'unsupported' ? 'Install app first' : 'Enable alerts'}
            </button>
            <button
              className="btn sm ghost"
              disabled={!clients.length}
              onClick={() => {
                addToCalendar(clients, settings, 'tig-gym-due-dates.ics');
                toast('Opening Calendar…', 'info');
              }}
            >
              <CalendarPlus size={16} /> All to Calendar
            </button>
          </div>
          <p className="hint">
            Alerts and the app-icon badge update each time you open the app. For alerts while the app is closed, add due dates to the iPhone Calendar; iOS then reminds you {settings.reminderDays} day{settings.reminderDays > 1 ? 's' : ''} before and on the day.
          </p>
        </div>
      </Section>

      {/* ---------- Templates ---------- */}
      <Section title="Message templates">
        <div className="card" style={{ padding: 16 }}>
          <label className="field">
            <span>WhatsApp</span>
            <SavedInput area key={'wa' + settings.whatsappTemplate.length} value={settings.whatsappTemplate} onSave={(v) => updateSettings({ whatsappTemplate: v })} />
          </label>
          <label className="field">
            <span>SMS</span>
            <SavedInput area key={'sms' + settings.smsTemplate.length} value={settings.smsTemplate} onSave={(v) => updateSettings({ smsTemplate: v })} />
          </label>
          <p className="hint">
            Placeholders: <code>{'{name}'}</code> <code>{'{amount}'}</code> <code>{'{due}'}</code> <code>{'{date}'}</code> <code>{'{upi}'}</code> <code>{'{gym}'}</code>
          </p>
          <button className="btn sm ghost mt" onClick={() => updateSettings({ whatsappTemplate: DEFAULT_WHATSAPP, smsTemplate: DEFAULT_SMS })}>
            <RotateCcw size={16} /> Reset to default
          </button>
        </div>
      </Section>

      <div className="empty" style={{ paddingTop: 30 }}>
        <img src="logo.png" alt="" style={{ width: 72, borderRadius: 18 }} />
        <div style={{ fontSize: 13 }}>TIG Gym Manager · v1.0 · data stays on this iPhone</div>
      </div>

      {found && (
        <Sheet title="Backup found" onClose={() => setFound(null)}>
          {(close) => (
            <div>
              <p className="muted" style={{ marginTop: 0 }}>
                Your Google Drive already has a backup with <b style={{ color: 'var(--text)' }}>{found.backup.clients?.length ?? 0} members</b>, saved {ago(found.backup.savedAt)}. This phone has{' '}
                <b style={{ color: 'var(--text)' }}>{clients.length}</b>.
              </p>
              <button
                className="btn primary block"
                onClick={() =>
                  run('restore', async () => {
                    await sync.restore(found);
                    toast('Restored from Google Drive');
                    close();
                  })
                }
              >
                <CloudDownload size={18} /> Restore backup to this phone
              </button>
              <button
                className="btn ghost block mt"
                onClick={() =>
                  run('sync', async () => {
                    await sync.overwriteRemote();
                    toast('Backup replaced with this phone’s data');
                    close();
                  })
                }
              >
                Replace backup with this phone's data
              </button>
            </div>
          )}
        </Sheet>
      )}
      {confirm === 'disconnect' && (
        <Confirm title="Disconnect Drive?" text="Automatic backup stops. Your backup stays safe in Google Drive." okText="Disconnect" danger onClose={() => setConfirm(null)} onOk={() => sync.disconnect()} />
      )}
      {confirm === 'restore' && (
        <Confirm
          title="Restore from Drive?"
          text="This phone's data will be replaced with the latest Google Drive backup."
          okText="Restore"
          onClose={() => setConfirm(null)}
          onOk={() =>
            run('restore', async () => {
              await sync.restore();
              toast('Restored from Google Drive');
            })
          }
        />
      )}
      {confirm === 'import' && pendingImport && (
        <Confirm
          title="Import backup?"
          text={`Replace this phone's data with ${pendingImport.clients.length} members from the file.`}
          okText="Import"
          onClose={() => setConfirm(null)}
          onOk={async () => {
            await store.applyBackup(pendingImport);
            sync.markDirty();
            toast('Backup imported');
          }}
        />
      )}
    </div>
  );
}
