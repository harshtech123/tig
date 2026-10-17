export interface Payment {
  id: string;
  /** Day the money was received (YYYY-MM-DD). */
  paidOn: string;
  amount: number;
  months: number;
  /** First day covered by this payment (YYYY-MM-DD). */
  periodStart: string;
  /** Next due date after this payment (YYYY-MM-DD). */
  periodEnd: string;
}

export interface Client {
  id: string;
  name: string;
  mobile: string;
  /** Compressed JPEG data URL. */
  photo?: string;
  startDate: string;
  payments: Payment[];
  createdAt: number;
  updatedAt: number;
}

export interface Settings {
  gymName: string;
  upiId: string;
  payeeName: string;
  /** Optional custom QR image (data URL). If empty, a UPI QR is generated. */
  qrImage?: string;
  countryCode: string;
  reminderDays: number;
  whatsappTemplate: string;
  smsTemplate: string;
  googleClientId: string;
}

export type Status = 'overdue' | 'due' | 'active';

export interface Backup {
  app: 'tig-gym';
  version: 1;
  savedAt: number;
  clients: Client[];
  settings: Omit<Settings, 'googleClientId'>;
}
