import { useState } from 'react';
import { CalendarPlus, IndianRupee, MessageSquare, Pencil, Phone, Trash2, X } from 'lucide-react';
import { useStore } from '../store';
import { Confirm, Page, RingAvatar, StatusPill } from '../components/ui';
import { WhatsAppIcon } from '../components/icons';
import { dueDate, feeAmount, sortedPayments, totalPaid } from '../lib/client';
import { fmtDate, fmtMoney, fmtShort } from '../lib/dates';
import { openUrl, telUrl } from '../lib/messaging';
import { addToCalendar } from '../lib/ics';
import type { Nav } from '../App';

export function MemberDetail({ id, nav, onClose }: { id: string; nav: Nav; onClose: () => void }) {
  const { clients, settings, removeClient, removePayment, toast } = useStore();
  const [confirm, setConfirm] = useState<null | { kind: 'client' } | { kind: 'payment'; pid: string }>(null);
  const c = clients.find((x) => x.id === id);

  return (
    <Page
      onClose={onClose}
      right={
        c && (
          <button className="icon-btn" onClick={() => nav.editClient(c.id)} aria-label="Edit">
            <Pencil size={18} />
          </button>
        )
      }
    >
      {(close) =>
        !c ? null : (
          <>
            <div className="profile fade-up">
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <RingAvatar client={c} size={136} stroke={5} />
              </div>
              <div className="nm">{c.name}</div>
              <div className="ph">+{settings.countryCode} {c.mobile}</div>
              <div style={{ marginTop: 10 }}>
                <StatusPill client={c} />
              </div>
            </div>

            <div className="card due-card fade-up" style={{ animationDelay: '60ms' }}>
              <div>
                <div className="k">Next due</div>
                <div className="v">{fmtDate(dueDate(c))}</div>
              </div>
              <div>
                <div className="k">Fee</div>
                <div className="v gold-text">{fmtMoney(feeAmount(c))}</div>
              </div>
              <div>
                <div className="k">Member since</div>
                <div className="v" style={{ fontSize: 16 }}>{fmtDate(c.startDate)}</div>
              </div>
              <div>
                <div className="k">Total paid</div>
                <div className="v" style={{ fontSize: 16 }}>
                  {fmtMoney(totalPaid(c))} <small>· {c.payments.length}×</small>
                </div>
              </div>
            </div>

            <div className="action-grid fade-up" style={{ animationDelay: '100ms' }}>
              <button className="action" onClick={() => nav.message(c.id, 'wa')}>
                <span className="ic" style={{ background: 'rgba(37,211,102,.14)', color: 'var(--wa)' }}>
                  <WhatsAppIcon size={21} />
                </span>
                WhatsApp
              </button>
              <button className="action" onClick={() => nav.message(c.id, 'sms')}>
                <span className="ic" style={{ background: 'rgba(34,184,176,.14)', color: 'var(--teal-2)' }}>
                  <MessageSquare size={20} />
                </span>
                SMS
              </button>
              <button className="action" onClick={() => openUrl(telUrl(c, settings))}>
                <span className="ic" style={{ background: 'rgba(255,255,255,.07)', color: 'var(--text)' }}>
                  <Phone size={19} />
                </span>
                Call
              </button>
              <button
                className="action"
                onClick={() => {
                  addToCalendar([c], settings, `tig-${c.name.replace(/\W+/g, '-')}.ics`);
                  toast('Opening Calendar…', 'info');
                }}
              >
                <span className="ic" style={{ background: 'rgba(232,181,74,.14)', color: 'var(--gold-2)' }}>
                  <CalendarPlus size={20} />
                </span>
                Remind
              </button>
            </div>

            <button className="btn primary block fade-up" style={{ marginTop: 16, animationDelay: '140ms' }} onClick={() => nav.pay(c.id)}>
              <IndianRupee size={18} /> Record fee payment
            </button>

            <div className="section-title">
              <span>Payment history</span>
            </div>
            <div className="timeline">
              {sortedPayments(c).map((p, i) => (
                <div key={p.id} className="card tl-item fade-up" style={{ animationDelay: `${160 + i * 40}ms` }}>
                  <div className="tl-top">
                    <div className="tl-amt">{fmtMoney(p.amount)}</div>
                    <button className="tl-del" aria-label="Delete payment" onClick={() => setConfirm({ kind: 'payment', pid: p.id })}>
                      <X size={16} />
                    </button>
                  </div>
                  <div className="tl-sub">
                    {p.months} month{p.months > 1 ? 's' : ''} · {fmtShort(p.periodStart)} → {fmtDate(p.periodEnd)}
                  </div>
                  <div className="tl-sub">Paid on {fmtDate(p.paidOn)}</div>
                </div>
              ))}
              {c.payments.length === 0 && <div className="muted">No payments yet.</div>}
            </div>

            <button className="btn danger block" style={{ marginTop: 22 }} onClick={() => setConfirm({ kind: 'client' })}>
              <Trash2 size={18} /> Delete member
            </button>

            {confirm?.kind === 'client' && (
              <Confirm
                title="Delete member?"
                text={`${c.name} and all payment history will be removed.`}
                okText="Delete"
                danger
                onClose={() => setConfirm(null)}
                onOk={async () => {
                  await removeClient(c.id);
                  toast(`${c.name} deleted`);
                  close();
                }}
              />
            )}
            {confirm?.kind === 'payment' && (
              <Confirm
                title="Delete payment?"
                text="Use this to fix a wrongly entered payment. The due date will be recalculated."
                okText="Delete"
                danger
                onClose={() => setConfirm(null)}
                onOk={async () => {
                  await removePayment(c.id, confirm.pid);
                  toast('Payment removed');
                }}
              />
            )}
          </>
        )
      }
    </Page>
  );
}
