import { describe, expect, it } from 'vitest';
import { emptyDatabase } from './store';
import { visibleCustomerIds } from './search';

describe('customer visibility in administration', () => {
  it('keeps a newly added customer visible before their first contract', () => {
    const database = emptyDatabase();
    database.customers = [{ id: 'customer-new', name: 'زبون جديد', phone: '07701234567', notes: '', createdAt: '2026-09-20' }];
    expect(visibleCustomerIds(database, { query: '', status: 'all', sort: 'newest' })).toEqual(new Set(['customer-new']));
  });

  it('finds a customer without a contract by name or phone', () => {
    const database = emptyDatabase();
    database.customers = [{ id: 'customer-new', name: 'زبون جديد', phone: '07701234567', notes: '', createdAt: '2026-09-20' }];
    expect(visibleCustomerIds(database, { query: 'زبون جديد', status: 'all' })).toEqual(new Set(['customer-new']));
    expect(visibleCustomerIds(database, { query: '9647701234567', status: 'all' })).toEqual(new Set(['customer-new']));
  });
});
