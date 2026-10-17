import type { Client, Settings } from './types';
import { dueDate, feeAmount } from './client';
import { addDays, fmtMoney } from './dates';
import { downloadBlob } from './messaging';

const esc = (s: string) => s.replace(/[\\;,]/g, (m) => '\\' + m).replace(/\n/g, '\\n');
const compact = (iso: string) => iso.replace(/-/g, '');

function stamp(): string {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
}

function event(c: Client, s: Settings): string {
  const due = dueDate(c);
  const lead = Math.max(0, s.reminderDays);
  // All-day events start at 00:00, so "-P1DT15H" fires at 09:00 two days before.
  const leadTrigger = lead > 0 ? `-P${lead - 1}DT15H` : 'PT9H';
  return [
    'BEGIN:VEVENT',
    `UID:tig-${c.id}-${compact(due)}@tig-gym`,
    `DTSTAMP:${stamp()}`,
    `DTSTART;VALUE=DATE:${compact(due)}`,
    `DTEND;VALUE=DATE:${compact(addDays(due, 1))}`,
    `SUMMARY:${esc(`💰 Fees due: ${c.name} (${fmtMoney(feeAmount(c))})`)}`,
    `DESCRIPTION:${esc(`${s.gymName} membership fee for ${c.name}. Mobile: ${c.mobile}. Open TIG Gym app to send a reminder.`)}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc(`${c.name}'s fee is due in ${lead} days`)}`,
    `TRIGGER:${leadTrigger}`,
    'END:VALARM',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc(`${c.name}'s fee is due today`)}`,
    'TRIGGER:PT9H',
    'END:VALARM',
    'END:VEVENT',
  ].join('\r\n');
}

export function buildIcs(clients: Client[], s: Settings): string {
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//TIG Gym//Fees//EN', 'CALSCALE:GREGORIAN', ...clients.map((c) => event(c, s)), 'END:VCALENDAR'].join('\r\n');
}

/** Hands the .ics to iOS, which shows its "Add to Calendar" preview with built-in alerts. */
export function addToCalendar(clients: Client[], s: Settings, filename: string) {
  const ics = buildIcs(clients, s);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  if (isIOS) {
    window.open('data:text/calendar;charset=utf-8,' + encodeURIComponent(ics), '_blank');
    return;
  }
  downloadBlob(new Blob([ics], { type: 'text/calendar' }), filename);
}
