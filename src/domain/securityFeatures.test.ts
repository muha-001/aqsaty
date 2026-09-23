import { describe, expect, it } from 'vitest';
import { canPermanentlyDelete, formatApproximateLocation, isNewSecurityEvent, trashLocalRecord, restoreLocalRecord } from './securityFeatures';
import { emptyDatabase } from './store';
import type { Database } from './types';

describe('secure deletion rules', () => {
  it('allows permanent deletion only for workspace owners', () => {
    expect(canPermanentlyDelete('owner')).toBe(true);
    expect(canPermanentlyDelete('manager')).toBe(false);
    expect(canPermanentlyDelete('staff')).toBe(false);
    expect(canPermanentlyDelete(null)).toBe(false);
  });

  it('moves a customer to local trash with deletion metadata', () => {
    const database = emptyDatabase();
    database.customers = [{ id: 'customer-1', name: 'علي', phone: '07700000000', createdAt: '2026-09-21' }];
    const result = trashLocalRecord(database, 'customer', 'customer-1', 'user-1', 'علي المدير', '2026-09-21T20:00:00.000Z');
    expect(result.database.customers).toHaveLength(0);
    expect(result.database.trash).toHaveLength(1);
    expect(result.database.trash[0]).toMatchObject({ entityType: 'customer', entityId: 'customer-1', deletedBy: 'user-1', deletedByName: 'علي المدير' });
  });

  it('deletes safely when legacy data has no trash collection', () => {
    const database = { ...emptyDatabase(), trash: undefined } as unknown as Database;
    database.customers = [{ id: 'customer-legacy', name: 'زبون قديم', phone: '07700000000', createdAt: '2026-09-21' }];
    const result = trashLocalRecord(database, 'customer', 'customer-legacy', 'user-1', 'المدير');
    expect(result.database.customers).toHaveLength(0);
    expect(result.database.trash).toHaveLength(1);
  });

  it('restores a trashed record without replacing a newer record', () => {
    const database = emptyDatabase();
    database.customers = [{ id: 'customer-1', name: 'النسخة الحالية', phone: '07700000000', createdAt: '2026-09-21' }];
    database.trash = [{ id: 'trash-1', entityType: 'customer', entityId: 'customer-1', record: { id: 'customer-1', name: 'النسخة المحذوفة', phone: '07700000001', createdAt: '2026-09-20' }, deletedBy: 'user-1', deletedByName: 'المالك', deletedAt: '2026-09-21T20:00:00.000Z' }];
    const restored = restoreLocalRecord(database, 'trash-1');
    expect(restored.customers[0].name).toBe('النسخة الحالية');
    expect(restored.trash).toHaveLength(1);
  });
});

describe('security events and approximate location', () => {
  it('formats a privacy-preserving approximate location', () => {
    expect(formatApproximateLocation({ language: 'ar-IQ', timezone: 'Asia/Baghdad' })).toBe('العراق — توقيت بغداد');
    expect(formatApproximateLocation({ language: 'en-US', timezone: 'America/New_York' })).toBe('الولايات المتحدة — التوقيت الشرقي');
  });

  it('ignores the current device login event and accepts a new unread event', () => {
    const current = { id: 'event-current', kind: 'login' as const, deviceId: 'device-current', createdAt: '2026-09-21T20:00:00.000Z', readAt: null };
    const other = { id: 'event-other', kind: 'login' as const, deviceId: 'device-other', createdAt: '2026-09-21T20:01:00.000Z', readAt: null };
    expect(isNewSecurityEvent(current, 'device-current')).toBe(false);
    expect(isNewSecurityEvent(other, 'device-current')).toBe(true);
  });
});
