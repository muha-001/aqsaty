import { describe, expect, it } from 'vitest';
import { serializeCloudPush } from './cloudSync';

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
});
