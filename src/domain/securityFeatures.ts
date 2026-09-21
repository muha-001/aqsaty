import type { Database, DeletedRecord, DeviceSession, SecurityEvent, TrashEntityType, WorkspaceRole } from './types';
import { createId } from './store';

export const canPermanentlyDelete = (role: WorkspaceRole | null | undefined) => role === 'owner';

export function entityLabel(type: TrashEntityType) {
  return type === 'customer' ? 'زبون' : type === 'product' ? 'منتج' : 'عقد';
}

export function trashLocalRecord(database: Database, entityType: TrashEntityType, entityId: string, deletedBy: string, deletedByName: string, deletedAt = new Date().toISOString()): { database: Database; deleted: DeletedRecord } {
  const next = structuredClone(database);
  const collection = next[`${entityType}s` as 'customers' | 'products' | 'contracts'];
  const index = collection.findIndex((item) => item.id === entityId);
  if (index < 0) throw new Error('السجل غير موجود');
  const [record] = collection.splice(index, 1);
  const deleted: DeletedRecord = { id: createId('trash'), entityType, entityId, record, deletedBy, deletedByName, deletedAt };
  if (entityType === 'contract') {
    deleted.relatedPayments = next.payments.filter((payment) => payment.contractId === entityId);
    next.payments = next.payments.filter((payment) => payment.contractId !== entityId);
  }
  next.trash = [deleted, ...next.trash.filter((item) => item.id !== deleted.id)];
  return { database: next, deleted };
}

export function restoreLocalRecord(database: Database, trashId: string): Database {
  const next = structuredClone(database);
  const item = next.trash.find((entry) => entry.id === trashId);
  if (!item) throw new Error('عنصر سلة المحذوفات غير موجود');
  const collection = next[`${item.entityType}s` as 'customers' | 'products' | 'contracts'];
  if (collection.some((entry) => entry.id === item.entityId)) return next;
  collection.push(item.record as never);
  if (item.entityType === 'contract' && item.relatedPayments) next.payments.push(...item.relatedPayments.filter((payment) => !next.payments.some((current) => current.id === payment.id)));
  next.trash = next.trash.filter((entry) => entry.id !== trashId);
  return next;
}

export function formatApproximateLocation(input: { language?: string; timezone?: string }) {
  const timezone = input.timezone || '';
  if (timezone === 'Asia/Baghdad' || input.language === 'ar-IQ') return 'العراق — توقيت بغداد';
  if (timezone === 'America/New_York') return 'الولايات المتحدة — التوقيت الشرقي';
  if (timezone.startsWith('Europe/')) return 'أوروبا — توقيت محلي';
  if (timezone.startsWith('America/')) return 'الأمريكتان — توقيت محلي';
  if (timezone.startsWith('Asia/')) return 'آسيا — توقيت محلي';
  return 'موقع تقريبي غير متاح';
}

export function deviceLabel(userAgent: string) {
  const browser = /Edg\//.test(userAgent) ? 'Edge' : /Chrome\//.test(userAgent) ? 'Chrome' : /Firefox\//.test(userAgent) ? 'Firefox' : /Safari\//.test(userAgent) ? 'Safari' : 'متصفح';
  const device = /Mobi|Android/i.test(userAgent) ? 'هاتف' : /Tablet|iPad/i.test(userAgent) ? 'جهاز لوحي' : 'حاسوب';
  return `${device} — ${browser}`;
}

export function isNewSecurityEvent(event: Pick<SecurityEvent, 'kind' | 'deviceId' | 'readAt'>, currentDeviceId: string) {
  return event.kind === 'login' && event.deviceId !== currentDeviceId && event.readAt === null;
}

export type SecuritySnapshot = { devices: DeviceSession[]; events: SecurityEvent[] };
export const emptySecuritySnapshot: SecuritySnapshot = { devices: [], events: [] };
