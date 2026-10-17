import { useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, ChevronLeft, CloudOff, Cloud, CloudUpload, Info, Loader2, MessageSquare, X } from 'lucide-react';
import type { Client, Status } from '../lib/types';
import { daysLeft, dueDate as dueDateOf, initials, periodProgress, statusOf } from '../lib/client';
import { fmtShort, relDays } from '../lib/dates';
import { useStore, useSync } from '../store';
import { WhatsAppIcon } from './icons';

const GRADS = [
  ['#f6d27a', '#c8902f'],
  ['#5fe0d6', '#1a9c95'],
  ['#ffb38a', '#e0703a'],
  ['#b7a6ff', '#6f5bd6'],
  ['#9be38a', '#3fa34d'],
  ['#ff9ab0', '#d8506e'],
];

function hash(s: string) {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}

export const STATUS_COLOR: Record<Status, string> = { overdue: 'var(--red)', due: 'var(--amber)', active: 'var(--green)' };

export function Avatar({ client, size = 48 }: { client: Pick<Client, 'name' | 'photo' | 'id'>; size?: number }) {
  const [a, b] = GRADS[hash(client.id || client.name) % GRADS.length];
  return (
    <div className="avatar" style={{ width: size, height: size, fontSize: size * 0.36, background: `linear-gradient(140deg, ${a}, ${b})` }}>
      {client.photo ? <img src={client.photo} alt="" /> : initials(client.name) || '?'}
    </div>
  );
}

/** Avatar wrapped in a progress ring that drains as the paid period runs out. */
export function RingAvatar({ client, size = 56, stroke = 3 }: { client: Client; size?: number; stroke?: number }) {
  const { settings } = useStore();
  const status = statusOf(client, settings.reminderDays);
  const p = status === 'overdue' ? 1 : periodProgress(client);
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  return (
    <div className="ring-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={STATUS_COLOR[status]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - Math.max(0.02, p))}
        />
      </svg>
      <Avatar client={client} size={size - stroke * 2 - 6} />
    </div>
  );
}

export function StatusPill({ client }: { client: Client }) {
  const { settings } = useStore();
  const s = statusOf(client, settings.reminderDays);
  const d = daysLeft(client);
  const label = s === 'overdue' ? `${-d}d overdue` : d === 0 ? 'Due today' : s === 'due' ? `Due in ${d}d` : `${d}d left`;
  return <span className={`pill ${s}`}>{label}</span>;
}

export function ClientRow({ client, onOpen, onMessage, delay = 0 }: { client: Client; onOpen: () => void; onMessage?: (via: 'wa' | 'sms') => void; delay?: number }) {
  const d = daysLeft(client);
  return (
    <div className="row fade-up" style={{ animationDelay: `${delay}ms` }} onClick={onOpen} role="button">
      <RingAvatar client={client} size={54} />
      <div className="main">
        <div className="name">{client.name}</div>
        <div className="sub">
          {onMessage
            ? d < 0
              ? `${-d} day${d === -1 ? '' : 's'} overdue · ${fmtShort(dueDateOf(client))}`
              : `Due ${relDays(d)} · ${fmtShort(dueDateOf(client))}`
            : `Due ${fmtShort(dueDateOf(client))} · ${client.mobile}`}
        </div>
      </div>
      {onMessage ? (
        <div className="quick-actions" onClick={(e) => e.stopPropagation()}>
          <button className="qa wa" aria-label="WhatsApp" onClick={() => onMessage('wa')}>
            <WhatsAppIcon size={19} />
          </button>
          <button className="qa sms" aria-label="SMS" onClick={() => onMessage('sms')}>
            <MessageSquare size={18} />
          </button>
        </div>
      ) : (
        <div className="end">
          <StatusPill client={client} />
        </div>
      )}
    </div>
  );
}

export function useClosing(onClose: () => void, ms = 230): [boolean, () => void] {
  const [closing, setClosing] = useState(false);
  return [
    closing,
    () => {
      if (closing) return;
      setClosing(true);
      setTimeout(onClose, ms);
    },
  ];
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: (close: () => void) => ReactNode }) {
  const [closing, close] = useClosing(onClose);
  return (
    <>
      <div className={`backdrop ${closing ? 'closing' : ''}`} onClick={close} />
      <div className={`sheet ${closing ? 'closing' : ''}`} role="dialog" aria-label={title}>
        <div className="grab" />
        <div className="sheet-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={close} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        {children(close)}
      </div>
    </>
  );
}

export function Page({ title, onClose, right, children }: { title?: string; onClose: () => void; right?: ReactNode; children: (close: () => void) => ReactNode }) {
  const [closing, close] = useClosing(onClose, 240);
  return (
    <div className={`page ${closing ? 'closing' : ''}`}>
      <div className="nav-bar">
        <button className="icon-btn" onClick={close} aria-label="Back">
          <ChevronLeft size={22} />
        </button>
        <div className="nav-title">{title}</div>
        <div style={{ minWidth: 40, display: 'flex', justifyContent: 'flex-end' }}>{right}</div>
      </div>
      {children(close)}
    </div>
  );
}

export function Toasts() {
  const { toasts } = useStore();
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.tone}`}>
          {t.tone === 'ok' ? <CheckCircle2 size={18} /> : t.tone === 'err' ? <AlertTriangle size={18} /> : <Info size={18} />}
          {t.text}
        </div>
      ))}
    </div>
  );
}

export function SyncChip({ onClick }: { onClick?: () => void }) {
  const s = useSync();
  const map = {
    off: { cls: '', icon: <CloudOff size={14} />, text: 'Backup off' },
    idle: { cls: 'ok', icon: <Cloud size={14} />, text: 'Backed up' },
    pending: { cls: '', icon: <CloudUpload size={14} />, text: 'Saving…' },
    syncing: { cls: '', icon: <Loader2 size={14} className="spin" />, text: 'Syncing' },
    'needs-auth': { cls: 'warn', icon: <CloudUpload size={14} />, text: 'Tap to back up' },
    conflict: { cls: 'err', icon: <AlertTriangle size={14} />, text: 'Backup conflict' },
    error: { cls: 'err', icon: <AlertTriangle size={14} />, text: 'Backup failed' },
  }[s.status];
  return (
    <button className={`sync-chip ${map.cls}`} onClick={onClick}>
      {map.icon}
      {map.text}
    </button>
  );
}

export function Confirm({ title, text, okText, danger, onOk, onClose }: { title: string; text: string; okText: string; danger?: boolean; onOk: () => void; onClose: () => void }) {
  return (
    <Sheet title={title} onClose={onClose}>
      {(close) => (
        <div className="confirm">
          <p>{text}</p>
          <div className="btn-row">
            <button className="btn ghost" onClick={close}>
              Cancel
            </button>
            <button
              className={`btn ${danger ? 'danger' : 'primary'}`}
              onClick={() => {
                onOk();
                close();
              }}
            >
              {okText}
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
