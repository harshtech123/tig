import type { Client, Payment, Status } from './types';
import { addMonths, daysBetween, today } from './dates';

export function sortedPayments(c: Client): Payment[] {
  return [...c.payments].sort((a, b) => (a.periodEnd < b.periodEnd ? 1 : -1));
}

export function lastPayment(c: Client): Payment | undefined {
  return sortedPayments(c)[0];
}

export function dueDate(c: Client): string {
  return lastPayment(c)?.periodEnd ?? c.startDate;
}

export function daysLeft(c: Client, now = today()): number {
  return daysBetween(now, dueDate(c));
}

export function statusOf(c: Client, reminderDays: number, now = today()): Status {
  const d = daysLeft(c, now);
  if (d < 0) return 'overdue';
  if (d <= reminderDays) return 'due';
  return 'active';
}

/** 0..1 — how much of the current paid period is remaining. */
export function periodProgress(c: Client, now = today()): number {
  const p = lastPayment(c);
  if (!p) return 0;
  const total = Math.max(1, daysBetween(p.periodStart, p.periodEnd));
  const left = daysBetween(now, p.periodEnd);
  return Math.min(1, Math.max(0, left / total));
}

export function feeAmount(c: Client): number {
  const p = lastPayment(c);
  return p?.amount ?? 0;
}

export function totalPaid(c: Client): number {
  return c.payments.reduce((s, p) => s + p.amount, 0);
}

export function makePayment(id: string, periodStart: string, months: number, amount: number, paidOn: string): Payment {
  return { id, paidOn, amount, months, periodStart, periodEnd: addMonths(periodStart, months) };
}

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

export function cleanMobile(m: string): string {
  return m.replace(/\D/g, '').slice(-10);
}

export function fullNumber(m: string, cc: string): string {
  const digits = m.replace(/\D/g, '');
  return digits.length > 10 ? digits : cc + digits;
}
