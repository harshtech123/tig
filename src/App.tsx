import { useState } from 'react';
import { BellRing, Home as HomeIcon, Plus, Settings as Cog, Users } from 'lucide-react';
import { useStore } from './store';
import { Toasts } from './components/ui';
import { Home } from './screens/Home';
import { Members, type Filter } from './screens/Members';
import { MemberDetail } from './screens/MemberDetail';
import { MemberForm } from './screens/MemberForm';
import { PaymentSheet } from './screens/PaymentSheet';
import { MessageSheet } from './screens/MessageSheet';
import { Settings } from './screens/Settings';

type Tab = 'home' | 'members' | 'settings';
type PageRoute = { kind: 'detail'; id: string } | { kind: 'form'; id?: string; key: number };
type SheetRoute = { kind: 'pay'; id: string } | { kind: 'msg'; id: string; via: 'wa' | 'sms' } | null;

export interface Nav {
  tab(t: Tab): void;
  members(f: Filter): void;
  detail(id: string): void;
  newClient(): void;
  editClient(id: string): void;
  pay(id: string): void;
  message(id: string, via: 'wa' | 'sms'): void;
}

export default function App() {
  const { ready, overdue, dueSoon } = useStore();
  const [tab, setTab] = useState<Tab>('home');
  const [filter, setFilter] = useState<Filter>('all');
  const [pages, setPages] = useState<PageRoute[]>([]);
  const [sheet, setSheet] = useState<SheetRoute>(null);

  const push = (p: PageRoute) => setPages((s) => [...s, p]);
  const pop = (p: PageRoute) => setPages((s) => s.filter((x) => x !== p));

  const nav: Nav = {
    tab: (t) => {
      setPages([]);
      setTab(t);
    },
    members: (f) => {
      setFilter(f);
      setTab('members');
    },
    detail: (id) => push({ kind: 'detail', id }),
    newClient: () => push({ kind: 'form', key: Date.now() }),
    editClient: (id) => push({ kind: 'form', id, key: Date.now() }),
    pay: (id) => setSheet({ kind: 'pay', id }),
    message: (id, via) => setSheet({ kind: 'msg', id, via }),
  };

  if (!ready)
    return (
      <div className="splash">
        <img src="logo.png" alt="TIG" />
      </div>
    );

  const alerts = overdue.length + dueSoon.length;

  return (
    <div className="app">
      {tab === 'home' && <Home nav={nav} />}
      {tab === 'members' && <Members nav={nav} filter={filter} setFilter={setFilter} />}
      {tab === 'settings' && <Settings />}

      <nav className="tabbar">
        <button className={`tab ${tab === 'home' ? 'on' : ''}`} onClick={() => nav.tab('home')}>
          <HomeIcon size={22} />
          Home
        </button>
        <button className={`tab ${tab === 'members' && filter !== 'attention' ? 'on' : ''}`} onClick={() => nav.members('all')}>
          <Users size={22} />
          Members
        </button>
        <button className="fab" aria-label="Add member" onClick={nav.newClient}>
          <Plus size={28} strokeWidth={2.6} />
        </button>
        <button className={`tab ${tab === 'members' && filter === 'attention' ? 'on' : ''}`} onClick={() => nav.members('attention')}>
          <BellRing size={22} />
          Due
          {alerts > 0 && <span className="badge">{alerts}</span>}
        </button>
        <button className={`tab ${tab === 'settings' ? 'on' : ''}`} onClick={() => nav.tab('settings')}>
          <Cog size={22} />
          Settings
        </button>
      </nav>

      {pages.map((p) =>
        p.kind === 'detail' ? (
          <MemberDetail key={'d' + p.id} id={p.id} nav={nav} onClose={() => pop(p)} />
        ) : (
          <MemberForm key={'f' + p.key} id={p.id} onClose={() => pop(p)} onSaved={(id) => nav.detail(id)} />
        ),
      )}

      {sheet?.kind === 'pay' && <PaymentSheet id={sheet.id} onClose={() => setSheet(null)} />}
      {sheet?.kind === 'msg' && (
        <MessageSheet
          id={sheet.id}
          via={sheet.via}
          onClose={() => setSheet(null)}
          onSettings={() => {
            setSheet(null);
            nav.tab('settings');
          }}
        />
      )}
      <Toasts />
    </div>
  );
}
