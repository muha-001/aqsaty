import { describe, expect, it } from 'vitest';
import { createLatestWriteQueue, describeCloudAuthError, getOAuthCallbackState, getOAuthRedirectUrl, mergeCloudDatabases, serializeCloudPush } from './cloudSync';
import { emptyDatabase } from './store';

describe('cloud synchronization queue', () => {
  it('reads OAuth callback errors before the app falls back to a generic login failure', () => {
    const callback = getOAuthCallbackState('https://muha-001.github.io/aqsaty/?error=access_denied&error_description=حساب%20غير%20مسموح');

    expect(callback).toEqual({
      hasCallback: true,
      error: 'access_denied',
      errorDescription: 'حساب غير مسموح',
      code: null,
      key: 'access_denied|حساب غير مسموح|',
    });
  });

  it('keeps an OAuth code callback distinguishable from an ordinary page load', () => {
    expect(getOAuthCallbackState('https://muha-001.github.io/aqsaty/?code=oauth-code')).toEqual({
      hasCallback: true,
      error: null,
      errorDescription: null,
      code: 'oauth-code',
      key: '||oauth-code',
    });
  });

  it('explains a paused cloud project instead of showing an opaque error', () => {
    expect(describeCloudAuthError(new Error('Failed to fetch'))).toContain('متوقفة مؤقتًا');
  });

  it('explains when a requested OAuth provider is disabled', () => {
    expect(describeCloudAuthError(new Error('Unsupported provider: google'))).toContain('Google غير مفعّل');
  });

  it('builds the GitHub Pages OAuth callback from the configured base path', () => {
    expect(getOAuthRedirectUrl('https://muha-001.github.io', '/aqsaty/')).toBe('https://muha-001.github.io/aqsaty/');
    expect(getOAuthRedirectUrl('http://localhost:5173', '/', 'https://muha-001.github.io/aqsaty/')).toBe('https://muha-001.github.io/aqsaty/');
  });

  it('runs overlapping pushes sequentially', async () => {
    const events: string[] = [];
    const first = serializeCloudPush(async () => {
      events.push('first:start');
      await new Promise((resolve) => setTimeout(resolve, 10));
      events.push('first:end');
      return 'first';
    });
    const second = serializeCloudPush(async () => {
      events.push('second:start');
      events.push('second:end');
      return 'second';
    });

    await expect(Promise.all([first, second])).resolves.toEqual(['first', 'second']);
    expect(events).toEqual(['first:start', 'first:end', 'second:start', 'second:end']);
  });

  it('keeps new records from both local and cloud databases', () => {
    const local = emptyDatabase();
    const cloud = emptyDatabase();
    local.customers = [{ id: 'local_customer', name: 'محلي', phone: '07700000000', createdAt: '2026-09-19' }];
    cloud.customers = [{ id: 'cloud_customer', name: 'سحابي', phone: '07800000000', createdAt: '2026-09-19' }];
    const merged = mergeCloudDatabases(local, cloud);
    expect(merged.customers.map((customer) => customer.id)).toEqual(['local_customer', 'cloud_customer']);
  });

  it('normalizes legacy cloud payloads without a trash collection', () => {
    const local = emptyDatabase();
    local.trash = [{ id: 'trash_1', entityType: 'contract', entityId: 'contract_1', record: {} as never, deletedAt: '2026-09-20', deletedBy: 'admin_1', deletedByName: 'المدير' }];
    const cloud = { ...emptyDatabase(), trash: undefined } as unknown as ReturnType<typeof emptyDatabase>;
    const merged = mergeCloudDatabases(local, cloud);
    expect(merged.trash).toEqual(local.trash);
  });

  it('keeps guarantors from both local and cloud databases', () => {
    const local = emptyDatabase();
    const cloud = emptyDatabase();
    local.guarantors = [{ id: 'local_guarantor', name: 'محلي', phone: '07700000000', relationship: 'أخ', address: 'بغداد', documents: [], createdAt: '2026-09-24', updatedAt: '2026-09-24' }];
    cloud.guarantors = [{ id: 'cloud_guarantor', name: 'سحابي', phone: '07800000000', relationship: 'أب', address: 'البصرة', documents: [], createdAt: '2026-09-24', updatedAt: '2026-09-24' }];
    const merged = mergeCloudDatabases(local, cloud);
    expect(merged.guarantors.map((guarantor) => guarantor.id)).toEqual(['local_guarantor', 'cloud_guarantor']);
  });

  it('coalesces rapid writes and persists only the latest snapshot', async () => {
    const persisted: number[] = [];
    const queue = createLatestWriteQueue(async (value: number) => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      persisted.push(value);
    });
    const first = queue(1);
    const second = queue(2);
    await expect(Promise.all([first, second])).resolves.toEqual([undefined, undefined]);
    expect(persisted).toEqual([2]);
  });
});
