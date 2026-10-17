import { useRef, useState } from 'react';
import { Camera, CalendarCheck } from 'lucide-react';
import { useStore } from '../store';
import { Avatar, Page } from '../components/ui';
import { cleanMobile, makePayment } from '../lib/client';
import { compressPhoto } from '../lib/image';
import { fmtDate, today, addMonths } from '../lib/dates';
import { uid } from '../lib/db';
import type { Client } from '../lib/types';

export const MONTH_OPTIONS = [1, 2, 3, 6, 12];

export function MonthsPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="seg">
      {MONTH_OPTIONS.map((m) => (
        <button type="button" key={m} className={value === m ? 'on' : ''} onClick={() => onChange(m)}>
          {m === 12 ? 1 : m}
          <small>{m === 12 ? 'year' : m === 1 ? 'month' : 'months'}</small>
        </button>
      ))}
    </div>
  );
}

export function MemberForm({ id, onClose, onSaved }: { id?: string; onClose: () => void; onSaved?: (id: string) => void }) {
  const { clients, saveClient, settings, toast } = useStore();
  const existing = clients.find((c) => c.id === id);
  const [name, setName] = useState(existing?.name ?? '');
  const [mobile, setMobile] = useState(existing?.mobile ?? '');
  const [photo, setPhoto] = useState(existing?.photo);
  const [startDate, setStartDate] = useState(existing?.startDate ?? today());
  const [amount, setAmount] = useState('');
  const [months, setMonths] = useState(1);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const mob = cleanMobile(mobile);
  const errors = {
    name: !name.trim() ? 'Enter the member’s name' : '',
    mobile: mob.length !== 10 ? 'Enter a 10-digit mobile number' : '',
    amount: !existing && !(Number(amount) > 0) ? 'Enter the fee amount paid' : '',
    months: !existing && !(months >= 1) ? 'Pick months covered' : '',
    startDate: !startDate ? 'Pick a start date' : '',
  };
  const valid = !Object.values(errors).some(Boolean);
  const dup = mob.length === 10 && clients.find((c) => c.mobile === mob && c.id !== id);

  async function pick(f?: File) {
    if (!f) return;
    try {
      setPhoto(await compressPhoto(f));
    } catch {
      toast('Could not read that photo', 'err');
    }
  }

  async function save(close: () => void) {
    setTried(true);
    if (!valid || saving) return;
    setSaving(true);
    const now = Date.now();
    const c: Client = existing
      ? { ...existing, name: name.trim(), mobile: mob, photo, startDate }
      : {
          id: uid(),
          name: name.trim(),
          mobile: mob,
          photo,
          startDate,
          payments: [makePayment(uid(), startDate, months, Number(amount), startDate)],
          createdAt: now,
          updatedAt: now,
        };
    await saveClient(c);
    toast(existing ? 'Profile updated' : `${c.name.split(' ')[0]} added 💪`);
    close();
    if (!existing) setTimeout(() => onSaved?.(c.id), 260);
  }

  return (
    <Page title={existing ? 'Edit member' : 'New member'} onClose={onClose}>
      {(close) => (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save(close);
          }}
        >
          <div className="photo-pick">
            <button type="button" className={`ph ${photo ? 'has' : ''}`} onClick={() => fileRef.current?.click()} aria-label="Add photo">
              {photo ? <img src={photo} alt="" /> : name.trim() ? <Avatar client={{ id: id ?? name, name, photo }} size={108} /> : <Camera size={34} />}
              <span className="cam">
                <Camera size={16} />
              </span>
            </button>
            <div className="links">
              <button type="button" onClick={() => fileRef.current?.click()}>
                {photo ? 'Change photo' : 'Add photo (optional)'}
              </button>
              {photo && (
                <button type="button" className="rm" onClick={() => setPhoto(undefined)}>
                  Remove
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
          </div>

          <label className="field">
            <span>Full name</span>
            <input className={`input ${tried && errors.name ? 'invalid' : ''}`} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rahul Sharma" autoCapitalize="words" autoComplete="off" />
            {tried && errors.name && <div className="err">{errors.name}</div>}
          </label>

          <label className="field">
            <span>Mobile number</span>
            <div className="input-prefix">
              <b>+{settings.countryCode}</b>
              <input className={`input ${tried && errors.mobile ? 'invalid' : ''}`} value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="98765 43210" inputMode="tel" autoComplete="off" />
            </div>
            {tried && errors.mobile && <div className="err">{errors.mobile}</div>}
            {dup && <div className="hint" style={{ color: 'var(--amber)' }}>⚠ {dup.name} already uses this number.</div>}
          </label>

          <label className="field">
            <span>{existing ? 'Member since' : 'Start date'}</span>
            <input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>

          {!existing && (
            <>
              <label className="field">
                <span>Fees paid</span>
                <div className="input-prefix money">
                  <b>₹</b>
                  <input className={`input ${tried && errors.amount ? 'invalid' : ''}`} value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))} placeholder="1500" inputMode="numeric" />
                </div>
                {tried && errors.amount && <div className="err">{errors.amount}</div>}
              </label>

              <div className="field">
                <span>Months covered</span>
                <MonthsPicker value={months} onChange={setMonths} />
              </div>

              {startDate && (
                <div className="summary-box">
                  <CalendarCheck size={26} color="var(--teal-2)" />
                  <div>
                    <div className="t">Next fee due on</div>
                    <div className="v">{fmtDate(addMonths(startDate, months))}</div>
                  </div>
                </div>
              )}
            </>
          )}

          <button className="btn primary block" type="submit" disabled={saving}>
            {existing ? 'Save changes' : 'Add member'}
          </button>
        </form>
      )}
    </Page>
  );
}
