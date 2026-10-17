import { useEffect, useMemo, useState } from 'react';
import { Download, MessageSquare, Send, Settings as Cog } from 'lucide-react';
import { useStore } from '../store';
import { Sheet } from '../components/ui';
import { WhatsAppIcon } from '../components/icons';
import { feeAmount } from '../lib/client';
import { downloadBlob, dueText, fillTemplate, openUrl, shareImageWithText, smsUrl, whatsappUrl } from '../lib/messaging';
import { renderPayCard } from '../lib/qr';
import { fmtDate } from '../lib/dates';
import { dueDate } from '../lib/client';

export function MessageSheet({ id, via: initialVia, onClose, onSettings }: { id: string; via: 'wa' | 'sms'; onClose: () => void; onSettings: () => void }) {
  const { clients, settings, toast } = useStore();
  const c = clients.find((x) => x.id === id)!;
  const [via, setVia] = useState(initialVia);
  const [amount, setAmount] = useState(String(feeAmount(c) || ''));
  const amt = Number(amount) || 0;
  const [waText, setWaText] = useState(() => fillTemplate(settings.whatsappTemplate, c, settings, amt));
  const [smsText, setSmsText] = useState(() => fillTemplate(settings.smsTemplate, c, settings, amt));
  const [card, setCard] = useState<Blob | null>(null);
  const cardUrl = useMemo(() => (card ? URL.createObjectURL(card) : ''), [card]);
  const hasPay = Boolean(settings.upiId || settings.qrImage);

  // Re-fill the messages when the amount changes.
  useEffect(() => {
    setWaText(fillTemplate(settings.whatsappTemplate, c, settings, amt));
    setSmsText(fillTemplate(settings.smsTemplate, c, settings, amt));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amt]);

  useEffect(() => {
    if (!hasPay) return;
    let live = true;
    setCard(null);
    const t = setTimeout(() => {
      const label = dueText(c).replace(/^is /, '').replace(/^was /, '');
      renderPayCard({ settings, name: c.name, amount: amt, dueText: `Fee ${label}` })
        .then((b) => live && setCard(b))
        .catch(() => live && toast('Could not create QR image', 'err'));
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amt, hasPay]);

  useEffect(() => () => URL.revokeObjectURL(cardUrl), [cardUrl]);

  const fileName = `TIG-fee-${c.name.replace(/\W+/g, '-')}.png`;

  async function sendWithQr() {
    if (!card) return;
    // Copy the text too: some WhatsApp versions drop the caption when sharing an image.
    navigator.clipboard?.writeText(waText).catch(() => {});
    const r = await shareImageWithText(card, fileName, waText);
    if (r === 'shared') toast('Shared! Message also copied', 'ok');
    if (r === 'unsupported') {
      downloadBlob(card, fileName);
      toast('QR saved — opening chat', 'info');
      openUrl(whatsappUrl(c, settings, waText));
    }
  }

  return (
    <Sheet title="Send reminder" onClose={onClose}>
      {() => (
        <>
          <div className="tabs2">
            <button className={via === 'wa' ? 'on' : ''} onClick={() => setVia('wa')}>
              <WhatsAppIcon size={16} /> WhatsApp
            </button>
            <button className={via === 'sms' ? 'on' : ''} onClick={() => setVia('sms')}>
              <MessageSquare size={16} /> SMS
            </button>
          </div>

          {!settings.upiId && (
            <button className="banner warn" onClick={onSettings}>
              <Cog size={20} />
              <div>
                <b>Add your UPI ID</b> in Settings so it's included in reminders{via === 'wa' ? ' and the QR code' : ''}.
              </div>
            </button>
          )}

          <label className="field">
            <span>
              Amount <em>· due {fmtDate(dueDate(c))}</em>
            </span>
            <div className="input-prefix money">
              <b>₹</b>
              <input className="input" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" />
            </div>
          </label>

          {via === 'wa' ? (
            <>
              {hasPay && <div className="card-preview">{cardUrl ? <img src={cardUrl} alt="Payment QR card" /> : <div className="skeleton" />}</div>}
              <label className="field">
                <span>Message</span>
                <textarea className="input" value={waText} onChange={(e) => setWaText(e.target.value)} rows={8} />
              </label>
              {hasPay && (
                <button className="btn wa block" disabled={!card} onClick={sendWithQr}>
                  <Send size={18} /> Send QR + message
                </button>
              )}
              <div className="btn-row mt">
                <button className={`btn ${hasPay ? 'ghost' : 'wa'} sm`} onClick={() => openUrl(whatsappUrl(c, settings, waText))}>
                  <WhatsAppIcon size={16} /> Open chat
                </button>
                {hasPay && (
                  <button className="btn ghost sm" disabled={!card} onClick={() => card && downloadBlob(card, fileName)}>
                    <Download size={16} /> Save QR
                  </button>
                )}
              </div>
              <p className="hint">
                <b>Send QR + message</b> opens the share sheet: pick WhatsApp, then {c.name.split(' ')[0]}. <b>Open chat</b> jumps straight to their chat with the text filled in.
              </p>
            </>
          ) : (
            <>
              <label className="field">
                <span>Message</span>
                <textarea className="input" value={smsText} onChange={(e) => setSmsText(e.target.value)} rows={5} />
              </label>
              <button className="btn teal block" onClick={() => openUrl(smsUrl(c, settings, smsText))}>
                <MessageSquare size={18} /> Open Messages
              </button>
            </>
          )}
        </>
      )}
    </Sheet>
  );
}
