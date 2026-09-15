import type { Contract, ContractStats, Database, Payment, ScheduleItem } from './types';

export const STORAGE_KEY = 'aqsaty_local_v2';
export const PIN_KEY = 'aqsaty_pin_v2';

const uid = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

export const today = () => new Date().toISOString().slice(0, 10);
export const normalizePhone = (phone: string) => String(phone || '').replace(/[^0-9]/g, '').replace(/^00964/, '0').replace(/^964/, '0');
export const whatsappPhone = (phone: string) => {
  const normalized = normalizePhone(phone);
  return normalized.startsWith('0') ? `964${normalized.slice(1)}` : normalized;
};
export const money = (amount: number) => `${Number(amount || 0).toLocaleString('ar-IQ')} د.ع`;
export const dateText = (date: string) => date ? new Date(`${date}T00:00:00`).toLocaleDateString('ar-IQ', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

export const emptyDatabase = (): Database => ({ customers: [], products: [], contracts: [], payments: [] });

export function ensureDatabase(): Database { return loadDatabase(); }

export function loadDatabase(): Database {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '') as Database;
  } catch {
    return emptyDatabase();
  }
}

export function saveDatabase(database: Database) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(database));
}

export const getPin = () => localStorage.getItem(PIN_KEY) || '1234';
export const setPin = (pin: string) => localStorage.setItem(PIN_KEY, pin);
export const createId = uid;

export function paidFor(database: Database, contract: Contract) {
  return database.payments.filter((payment) => payment.contractId === contract.id).reduce((total, payment) => total + payment.amount, 0);
}

export function contractStats(database: Database, contract: Contract): ContractStats {
  const paid = paidFor(database, contract);
  const remaining = Math.max(0, contract.financedAmount - paid);
  const completed = contract.schedule.filter((item) => item.paidAmount >= item.amount).length;
  const overdue = contract.schedule.filter((item) => item.paidAmount < item.amount && item.dueDate < today()).length;
  return { paid, remaining, completed, overdue, percent: contract.financedAmount ? Math.min(100, (paid / contract.financedAmount) * 100) : 0 };
}

export function createSchedule(amount: number, months: number, startDate: string): ScheduleItem[] {
  const base = Math.floor(amount / months);
  const remainder = amount - base * months;
  return Array.from({ length: months }, (_, index) => {
    const due = new Date(`${startDate}T00:00:00`);
    due.setMonth(due.getMonth() + index);
    return { id: uid('schedule'), number: index + 1, dueDate: due.toISOString().slice(0, 10), amount: base + (index === months - 1 ? remainder : 0), paidAmount: 0 };
  });
}

export function customerByPhone(database: Database, phone: string) {
  const normalized = normalizePhone(phone);
  return database.customers.find((customer) => normalizePhone(customer.phone) === normalized);
}

export function statusFor(item: ScheduleItem): { label: string; tone: 'paid' | 'partial' | 'late' | 'due' } {
  if (item.paidAmount >= item.amount) return { label: 'مدفوع', tone: 'paid' };
  if (item.paidAmount > 0) return { label: 'جزئي', tone: 'partial' };
  if (item.dueDate < today()) return { label: 'متأخر', tone: 'late' };
  return { label: 'قادم', tone: 'due' };
}

export function addPayment(database: Database, contractId: string, scheduleId: string, payment: Omit<Payment, 'id' | 'contractId' | 'scheduleId'>) {
  const contract = database.contracts.find((item) => item.id === contractId);
  const schedule = contract?.schedule.find((item) => item.id === scheduleId);
  if (!contract || !schedule) throw new Error('القسط غير موجود');
  const remaining = schedule.amount - schedule.paidAmount;
  if (payment.amount <= 0 || payment.amount > remaining) throw new Error('مبلغ الدفعة غير صحيح');
  schedule.paidAmount += payment.amount;
  database.payments.push({ ...payment, id: uid('payment'), contractId, scheduleId });
}

export function buildWhatsAppMessage(database: Database, contractId: string, scheduleId: string) {
  const contract = database.contracts.find((item) => item.id === contractId);
  const schedule = contract?.schedule.find((item) => item.id === scheduleId);
  const customer = contract && database.customers.find((item) => item.id === contract.customerId);
  if (!contract || !schedule || !customer) throw new Error('تعذر تجهيز الرسالة');
  const remaining = schedule.amount - schedule.paidAmount;
  return {
    phone: whatsappPhone(customer.phone),
    message: `السلام عليكم ${customer.name}،\n\nنذكّركم بقسطكم لدى aqsaty:\nالمنتج: ${contract.productName}\nرقم العقد: ${contract.number}\nالقسط رقم: ${schedule.number} من ${contract.months}\nتاريخ الاستحقاق: ${dateText(schedule.dueDate)}\nالمبلغ المتبقي لهذا القسط: ${money(remaining)}\n\nشكرًا لتعاونكم.`,
  };
}
