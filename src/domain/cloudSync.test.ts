import { describe, expect, it } from 'vitest';
import { mergeCloudDatabases, serializeCloudPush } from './cloudSync';
import { emptyDatabase } from './store';

describe('cloud synchronization queue', () => {
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
});
