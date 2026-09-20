import { describe, expect, it } from 'vitest';
import { addPayment, applyDiscount, cancelContract, extendContract, latePenaltyFor, rescheduleContract } from './store';
import { filterAndSortContracts } from './search';
import { createSchedule, emptyDatabase } from './store';
import type { Contract } from './types';

const makeContract = (overrides: Partial<Contract> = {}): Contract => ({ id: 'c1', number: 'AQ-1', customerId: 'u1', productId: 'p1', productName: 'هاتف', serialNumber: 'SN-77', totalAmount: 1000, downPayment: 0, financedAmount: 1000, months: 2, startDate: '2026-01-01', status: 'نشط', schedule: createSchedule(1000, 2, '2026-01-01'), createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', history: [], ...overrides });

describe('advanced contract rules', () => {
  it('calculates a capped late penalty from overdue days and remaining balance', () => {
    const item = { id: 's1', number: 1, dueDate: '2026-01-01', amount: 500, paidAmount: 100 };
    expect(latePenaltyFor(item, '2026-01-11', 0.01, 0.25)).toBe(40);
    expect(latePenaltyFor(item, '2026-02-01', 0.01, 0.25)).toBe(100);
  });

  it('supports multiple partial payments on the same day as independent records', () => {
    const database = emptyDatabase(); const current = makeContract(); database.contracts = [current];
    addPayment(database, 'c1', current.schedule[0].id, { amount: 100, method: 'نقدي', date: '2026-01-05' });
    addPayment(database, 'c1', current.schedule[0].id, { amount: 150, method: 'تحويل', date: '2026-01-05' });
    expect(database.payments.filter((payment) => payment.date === '2026-01-05')).toHaveLength(2);
    expect(current.schedule[0].paidAmount).toBe(250);
  });

  it('applies a discount without reducing the amount already paid', () => {
    const database = emptyDatabase(); const current = makeContract(); current.schedule[0].paidAmount = 100; database.contracts = [current];
    expect(() => applyDiscount(database, 'c1', current.schedule[0].id, 50, 'عرض خاص')).not.toThrow();
    expect(current.schedule[0].amount).toBe(450);
    expect(current.schedule[0].paidAmount).toBe(100);
    expect(current.history?.[current.history.length - 1]?.action).toBe('خصم');
  });

  it('extends a contract and records the change in history', () => {
    const database = emptyDatabase(); const current = makeContract(); database.contracts = [current];
    extendContract(database, 'c1', 2, 'تمديد بناءً على طلب العميل');
    expect(current.months).toBe(4);
    expect(current.schedule).toHaveLength(4);
    expect(current.history?.[current.history.length - 1]?.action).toBe('تمديد');
  });

  it('cancels a contract with a required reason without deleting its records', () => {
    const database = emptyDatabase(); const current = makeContract(); database.contracts = [current];
    cancelContract(database, 'c1', 'إرجاع المنتج');
    expect(current.status).toBe('ملغى');
    expect(current.cancellationReason).toBe('إرجاع المنتج');
    expect(current.history?.[current.history.length - 1]?.reason).toBe('إرجاع المنتج');
  });

  it('reschedules the full unpaid balance while preserving payments', () => {
    const database = emptyDatabase(); const current = makeContract(); current.schedule[0].paidAmount = 100; database.contracts = [current];
    rescheduleContract(database, 'c1', { months: 3, startDate: '2026-03-01', reason: 'اتفاق جديد' });
    expect(current.schedule).toHaveLength(3);
    expect(current.schedule.reduce((sum, item) => sum + item.amount - item.paidAmount, 0)).toBe(900);
    expect(current.history?.[current.history.length - 1]?.action).toBe('إعادة جدولة كاملة');
  });

  it('filters by customer, serial, status, remaining amount and sorts nearest due date', () => {
    const database = emptyDatabase(); database.customers = [{ id: 'u1', name: 'علي', phone: '07701234567', createdAt: '2026-01-01' }];
    const first = makeContract(); const second = makeContract({ id: 'c2', number: 'AQ-2', serialNumber: 'SN-88', productName: 'حاسوب', startDate: '2026-02-01', schedule: createSchedule(2000, 2, '2026-02-01'), financedAmount: 2000, totalAmount: 2000 });
    database.contracts = [second, first];
    expect(filterAndSortContracts(database, { query: 'SN-77', sort: 'nearestDue' }).map((item) => item.id)).toEqual(['c1']);
    expect(filterAndSortContracts(database, { minRemaining: 1500, sort: 'highestPrice' }).map((item) => item.id)).toEqual(['c2']);
  });
});
