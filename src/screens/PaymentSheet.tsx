import { useState } from 'react';
import { CalendarCheck } from 'lucide-react';
import { useStore } from '../store';
import { Avatar, Sheet } from '../components/ui';
import { MonthsPicker } from './MemberForm';
import { daysLeft, dueDate, feeAmount, lastPayment, makePayment } from '../lib/client';
import { addMonths, fmtDate, fmtShort, today } from '../lib/dates';
import { uid } from '../lib/db';

export function PaymentSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const { clients, addPayment, toast } = useStore();
  const c = clients.find((x) => x.id === id)!;
  const due = dueDate(c);
  const now = today();
  const lapsedLong = daysLeft(c) < -15;
  const [amount, setAmount] = useState(String(feeAmount(c) || ''));
  const [months, setMonths] = useState(lastPayment(c)?.months ?? 1);
  const [from, setFrom] = useState<'due' | 'today'>(lapsedLong ? 'today' : 'due');
  const [paidOn, setPaidOn] = useState(now);
  const start = from === 'due' ? due : now;
  const nextDue = addMonths(start, months);
  const valid = Number(amount) > 0;

  return (
    <Sheet title="Record payment" onClose={onClose}>
      {(close) => (
        <>
          <div className="row" style={{ marginBottom: 16, background: 'var(--surface-2)' }}>
            <Avatar client={c} size={44} />
            <div className="main">
              <div className="name">{c.name}</div>
              <div className="sub">Currently due {fmtDate(due)}</div>
            </div>
          </div>

          <label className="field">
            <span>Amount received</span>
            <div className="input-prefix money">
              <b>₹</b>
              <input className="input" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" placeholder="1500" />
            </div>
          </label>

          <div className="field">
            <span>Months covered</span>
            <MonthsPicker value={months} onChange={setMonths} />
          </div>

          {due !== now && (
            <div className="field">
              <span>New period starts</span>
              <div className="toggle2">
                <button type="button" className={from === 'due' ? 'on' : ''} onClick={() => setFrom('due')}>
                  <b>From due date</b>
                  <span>{fmtShort(due)} – keeps the cycle</span>
                </button>
                <button type="button" className={from === 'today' ? 'on' : ''} onClick={() => setFrom('today')}>
                  <b>From today</b>
                  <span>{fmtShort(now)} – fresh start</span>
                </button>
              </div>
            </div>
          )}

          <label className="field">
            <span>Paid on</span>
            <input className="input" type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
          </label>

          <div className="summary-box">
            <CalendarCheck size={26} color="var(--teal-2)" />
            <div>
              <div className="t">Covered until · next fee due</div>
              <div className="v">{fmtDate(nextDue)}</div>
            </div>
          </div>

          <button
            className="btn primary block"
            disabled={!valid}
            onClick={async () => {
              await addPayment(c.id, makePayment(uid(), start, months, Number(amount), paidOn || now));
              toast(`Payment saved · next due ${fmtShort(nextDue)}`);
              close();
            }}
          >
            Save payment
          </button>
        </>
      )}
    </Sheet>
  );
}
