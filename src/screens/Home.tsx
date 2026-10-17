import { useMemo } from 'react';
import { BellRing, PartyPopper, Share, Users } from 'lucide-react';
import { useStore } from '../store';
import { ClientRow, SyncChip } from '../components/ui';
import { daysLeft } from '../lib/client';
import { fmtMoney, today } from '../lib/dates';
import { isStandalone, notificationsSupported, requestNotifications } from '../lib/notify';
import type { Status } from '../lib/types';
import type { Nav } from '../App';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export function Home({ nav }: { nav: Nav }) {
  const { clients, overdue, dueSoon, settings, toast } = useStore();
  const now = today();
  const month = now.slice(0, 7);

  const { collected, payCount, upcoming } = useMemo(() => {
    let collected = 0;
    let payCount = 0;
    for (const c of clients)
      for (const p of c.payments)
        if (p.paidOn.startsWith(month)) {
          collected += p.amount;
          payCount++;
        }
    const upcoming = clients
      .filter((c) => {
        const d = daysLeft(c, now);
        return d > settings.reminderDays && d <= 7;
      })
      .sort((a, b) => daysLeft(a) - daysLeft(b));
    return { collected, payCount, upcoming };
  }, [clients, month, now, settings.reminderDays]);

  const active = clients.length - overdue.length;
  const monthName = new Date().toLocaleDateString('en-IN', { month: 'long' });
  const attention = [...overdue, ...dueSoon];
  const showInstall = !isStandalone();
  const showNotif = isStandalone() && notificationsSupported() && Notification.permission === 'default';

  const stats: { key: Status; n: number; label: string; color: string }[] = [
    { key: 'overdue', n: overdue.length, label: 'Overdue', color: 'var(--red)' },
    { key: 'due', n: dueSoon.length, label: 'Due soon', color: 'var(--amber)' },
    { key: 'active', n: clients.length - overdue.length - dueSoon.length, label: 'Active', color: 'var(--green)' },
  ];

  return (
    <div className="screen">
      <div className="brand-bar fade-up">
        <img src="logo.png" alt="TIG" />
        <div className="titles">
          <div className="eyebrow">{greeting()}</div>
          <h1 className="h-lg gold-text">The Iron Garage</h1>
        </div>
        <SyncChip onClick={() => nav.tab('settings')} />
      </div>

      {showInstall && (
        <div className="banner info fade-up">
          <Share size={20} />
          <div>
            <b>Install the app:</b> in Safari tap <b>Share</b> → <b>Add to Home Screen</b> for full-screen use and alerts.
          </div>
        </div>
      )}
      {showNotif && (
        <button
          className="banner warn fade-up"
          onClick={async () => {
            const r = await requestNotifications();
            toast(r === 'granted' ? 'Fee alerts enabled' : 'Alerts not allowed', r === 'granted' ? 'ok' : 'err');
          }}
        >
          <BellRing size={20} />
          <div>
            <b>Turn on fee alerts</b> — get a reminder and an icon badge when fees are due.
          </div>
        </button>
      )}

      <div className="hero fade-up" style={{ animationDelay: '60ms' }}>
        <div className="eyebrow" style={{ position: 'relative', zIndex: 1 }}>
          Collected in {monthName}
        </div>
        <div className="big gold-text" style={{ position: 'relative', zIndex: 1 }}>
          {fmtMoney(collected)}
        </div>
        <div className="hero-row">
          <div className="hero-stat">
            <b>{clients.length}</b>
            <span>Members</span>
          </div>
          <div className="hero-stat">
            <b>{active}</b>
            <span>Paid up</span>
          </div>
          <div className="hero-stat">
            <b>{payCount}</b>
            <span>Payments</span>
          </div>
        </div>
      </div>

      <div className="stat-grid">
        {stats.map((s, i) => (
          <button key={s.key} className="stat card fade-up" style={{ animationDelay: `${120 + i * 50}ms` }} onClick={() => nav.members(s.key)}>
            <div className="dot" style={{ background: s.color, color: s.color }} />
            <div className="n">{s.n}</div>
            <div className="l">{s.label}</div>
          </button>
        ))}
      </div>

      {clients.length === 0 ? (
        <div className="empty fade-up" style={{ animationDelay: '200ms' }}>
          <img src="logo.png" alt="" />
          <h3>Welcome, coach</h3>
          <p>Add your first member to start tracking fees.</p>
          <button className="btn primary mt" onClick={() => nav.newClient()}>
            <Users size={18} /> Add member
          </button>
        </div>
      ) : (
        <>
          <div className="section-title">
            <span>Needs attention</span>
            {attention.length > 0 && <span style={{ color: 'var(--amber)' }}>{attention.length}</span>}
          </div>
          {attention.length === 0 ? (
            <div className="card all-clear fade-up">
              <div className="ic">
                <PartyPopper size={24} />
              </div>
              <b style={{ color: 'var(--text)' }}>All clear!</b>
              <div>No fees due in the next {settings.reminderDays} days.</div>
            </div>
          ) : (
            <div className="list">
              {attention.map((c, i) => (
                <ClientRow key={c.id} client={c} delay={i * 40} onOpen={() => nav.detail(c.id)} onMessage={(via) => nav.message(c.id, via)} />
              ))}
            </div>
          )}

          {upcoming.length > 0 && (
            <>
              <div className="section-title">
                <span>Coming up this week</span>
              </div>
              <div className="list">
                {upcoming.map((c, i) => (
                  <ClientRow key={c.id} client={c} delay={i * 40} onOpen={() => nav.detail(c.id)} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
