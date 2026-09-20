import { describe, expect, it } from 'vitest';
import { recordSyncEvent, readSyncTelemetry, summarizeSyncTelemetry, type SyncTelemetryEvent } from './syncTelemetry';

describe('sync telemetry', () => {
  it('records failure reason, payload size, retry count, and connection time', () => {
    const storage = new Map<string, string>();
    const event: SyncTelemetryEvent = { kind: 'failure', at: 1700000000000, payloadBytes: 2048, attempts: 3, reason: 'انتهت مهلة الاتصال', online: false };
    recordSyncEvent(event, storage);
    expect(readSyncTelemetry(storage)).toEqual([event]);
    expect(summarizeSyncTelemetry(storage)).toMatchObject({ lastError: 'انتهت مهلة الاتصال', lastPayloadBytes: 2048, retryAttempts: 3, lastConnectionAt: event.at });
  });
});
