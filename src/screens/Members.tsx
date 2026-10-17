import { useMemo, useState } from 'react';
import { Search, UserPlus, X } from 'lucide-react';
import { useStore } from '../store';
import { ClientRow } from '../components/ui';
import { daysLeft, statusOf } from '../lib/client';
import type { Status } from '../lib/types';
import type { Nav } from '../App';

export type Filter = 'all' | 'attention' | Status;

export function Members({ nav, filter, setFilter }: { nav: Nav; filter: Filter; setFilter: (f: Filter) => void }) {
  const { clients, settings } = useStore();
  const [q, setQ] = useState('');

  const counts = useMemo(() => {
    const c = { all: clients.length, attention: 0, overdue: 0, due: 0, active: 0 };
    for (const x of clients) c[statusOf(x, settings.reminderDays)]++;
    c.attention = c.overdue + c.due;
    return c;
  }, [clients, settings.reminderDays]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const digits = needle.replace(/\D/g, '');
    return clients
      .filter((c) => {
        if (filter === 'all') return true;
        const st = statusOf(c, settings.reminderDays);
        return filter === 'attention' ? st !== 'active' : st === filter;
      })
      .filter((c) => !needle || c.name.toLowerCase().includes(needle) || (digits.length > 0 && c.mobile.includes(digits)))
      .sort((a, b) => daysLeft(a) - daysLeft(b) || a.name.localeCompare(b.name));
  }, [clients, filter, q, settings.reminderDays]);

  const chips: { k: Filter; label: string }[] = [
    { k: 'all', label: 'All' },
    { k: 'attention', label: 'Fees due' },
    { k: 'overdue', label: 'Overdue' },
    { k: 'due', label: 'Due soon' },
    { k: 'active', label: 'Active' },
  ];

  return (
    <div className="screen">
      <div className="brand-bar" style={{ paddingBottom: 12 }}>
        <div className="titles">
          <div className="eyebrow">{clients.length} total</div>
          <h1 className="h-xl">Members</h1>
        </div>
        <button className="icon-btn" style={{ width: 44, height: 44, color: 'var(--gold-2)' }} onClick={() => nav.newClient()} aria-label="Add member">
          <UserPlus size={20} />
        </button>
      </div>

      <label className="search">
        <Search size={18} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or mobile" inputMode="search" autoComplete="off" />
        {q && (
          <button onClick={() => setQ('')} aria-label="Clear">
            <X size={18} />
          </button>
        )}
      </label>

      <div className="chips">
        {chips.map((c) => (
          <button key={c.k} className={`chip ${filter === c.k ? 'on' : ''}`} onClick={() => setFilter(c.k)}>
            {c.label} <span className="count">{counts[c.k]}</span>
          </button>
        ))}
      </div>

      <div className="list" style={{ marginTop: 10 }}>
        {list.map((c, i) => (
          <ClientRow key={c.id} client={c} delay={Math.min(i, 10) * 25} onOpen={() => nav.detail(c.id)} />
        ))}
      </div>

      {list.length === 0 && (
        <div className="empty">
          <h3>{q ? 'No match' : 'Nobody here'}</h3>
          <p>{q ? `No member matches “${q}”.` : clients.length ? 'No members in this group.' : 'Tap + to add your first member.'}</p>
        </div>
      )}
    </div>
  );
}
