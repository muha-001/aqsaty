import type { Database } from './types';

export const OFFLINE_QUEUE_KEY = 'aqsaty_offline_queue';
const MAX_RETRY_DELAY = 5 * 60 * 1000;

export type OfflineOperation = {
  id: string;
  database: Database;
  attempts: number;
  nextAttemptAt: number;
  createdAt: number;
  lastError?: string;
};

type StorageLike = Pick<Storage, 'getItem' | 'setItem'> | Map<string, string>;

function getValue(storage: StorageLike) { return storage instanceof Map ? storage.get(OFFLINE_QUEUE_KEY) : storage.getItem(OFFLINE_QUEUE_KEY); }
function setValue(storage: StorageLike, value: string) { if (storage instanceof Map) storage.set(OFFLINE_QUEUE_KEY, value); else storage.setItem(OFFLINE_QUEUE_KEY, value); }
function read(storage: StorageLike): OfflineOperation[] { try { return JSON.parse(getValue(storage) || '[]') as OfflineOperation[]; } catch { return []; } }
function write(operations: OfflineOperation[], storage: StorageLike) { setValue(storage, JSON.stringify(operations)); }

export function nextRetryDelay(attempt: number) { return Math.min(MAX_RETRY_DELAY, 1000 * (2 ** Math.max(0, attempt))); }
export function loadOfflineQueue(storage: StorageLike = localStorage) { return read(storage); }
export function enqueueOperation(operation: OfflineOperation, storage: StorageLike = localStorage) { const operations = read(storage).filter((item) => item.id !== operation.id); operations.push(operation); write(operations, storage); return operations; }
export function removeOperation(id: string, storage: StorageLike = localStorage) { const operations = read(storage).filter((item) => item.id !== id); write(operations, storage); return operations; }
export function markOperationFailed(id: string, error: unknown, now = Date.now(), storage: StorageLike = localStorage) { const operations = read(storage).map((item) => item.id === id ? { ...item, attempts: item.attempts + 1, nextAttemptAt: now + nextRetryDelay(item.attempts), lastError: error instanceof Error ? error.message : 'تعذر رفع العملية' } : item); write(operations, storage); return operations; }
export async function flushOfflineQueue(push: (database: Database) => Promise<void>, now = Date.now(), storage: StorageLike = localStorage) { let operations = read(storage); let completed = 0; let failed = 0; for (const operation of operations) { if (operation.nextAttemptAt > now) continue; try { await push(operation.database); operations = operations.filter((item) => item.id !== operation.id); write(operations, storage); completed += 1; } catch (error) { failed += 1; operations = operations.map((item) => item.id === operation.id ? { ...item, attempts: item.attempts + 1, nextAttemptAt: now + nextRetryDelay(item.attempts), lastError: error instanceof Error ? error.message : 'تعذر رفع العملية' } : item); write(operations, storage); break; } } return { completed, failed, pending: operations.length }; }
