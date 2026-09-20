import { describe, expect, it } from 'vitest';
import { nextRetryDelay, enqueueOperation, removeOperation, type OfflineOperation } from './offlineQueue';

describe('offline operation queue', () => {
  it('uses exponential backoff with a bounded delay', () => {
    expect(nextRetryDelay(0)).toBe(1000);
    expect(nextRetryDelay(1)).toBe(2000);
    expect(nextRetryDelay(5)).toBe(32000);
    expect(nextRetryDelay(99)).toBe(300000);
  });

  it('keeps queued operations durable and removes only completed operations', () => {
    const storage = new Map<string, string>();
    const operation: OfflineOperation = { id: 'op-1', database: {} as OfflineOperation['database'], attempts: 0, nextAttemptAt: 0, createdAt: 1 };
    enqueueOperation(operation, storage);
    expect(JSON.parse(storage.get('aqsaty_offline_queue') || '[]')).toEqual([operation]);
    removeOperation(operation.id, storage);
    expect(JSON.parse(storage.get('aqsaty_offline_queue') || '[]')).toEqual([]);
  });
});
