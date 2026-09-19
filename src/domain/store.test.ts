import { describe, expect, it } from 'vitest';
import { addPayment, contractStats, createSchedule, emptyDatabase, rescheduleItem, statusFor } from './store';
import type { Contract } from './types';

const contract = (overrides: Partial<Contract> = {}): Contract => ({
  id: 'contract_1',
  number: 'AQ-2026-00001',
  customerId: 'customer_1',
  productId: 'product_1',
  productName: 'هاتف',
  totalAmount: 1_000,
  downPayment: 0,
  financedAmount: 1_000,
  months: 2,
  startDate: '2026-01-01',
  status: 'نشط',
  schedule: createSchedule(1_000, 2, '2026-01-01'),
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('installment domain rules', () => {
  it('distributes the full financed amount, including rounding remainder', () => {
    const schedule = createSchedule(1_000, 3, '2026-01-01');
    expect(schedule.map((item) => item.amount)).toEqual([333, 333, 334]);
    expect(schedule.reduce((sum, item) => sum + item.amount, 0)).toBe(1_000);
  });

  it('rejects invalid installment terms', () => {
    expect(() => createSchedule(1_000, 0, '2026-01-01')).toThrow('بيانات جدول الأقساط غير صحيحة');
    expect(() => createSchedule(1_000, 2.5, '2026-01-01')).toThrow('بيانات جدول الأقساط غير صحيحة');
    expect(() => createSchedule(1_000, 2, 'invalid')).toThrow('بيانات جدول الأقساط غير صحيحة');
  });

  it('treats the due date as overdue consistently when it is today', () => {
    const database = emptyDatabase();
    const current = new Date().toISOString().slice(0, 10);
    const item = { id: 'schedule_1', number: 1, dueDate: current, amount: 500, paidAmount: 0 };
    const currentContract = contract({ schedule: [item] });
    database.contracts = [currentContract];
    expect(contractStats(database, currentContract).overdue).toBe(1);
  });

  it('does not allow a payment to exceed the installment balance', () => {
    const database = emptyDatabase();
    const currentContract = contract();
    database.contracts = [currentContract];
    expect(() => addPayment(database, currentContract.id, currentContract.schedule[0].id, {
      amount: currentContract.schedule[0].amount + 1,
      method: 'نقدي',
      date: '2026-01-01',
    })).toThrow('مبلغ الدفعة غير صحيح');
  });

  it('labels an installment due today as overdue in the schedule table', () => {
    const current = new Date().toISOString().slice(0, 10);
    expect(statusFor({ id: 'schedule_2', number: 1, dueDate: current, amount: 500, paidAmount: 0 }).label).toBe('متأخر');
  });

  it('rescheduling an amount preserves the contract financed total', () => {
    const database = emptyDatabase();
    const currentContract = contract();
    database.contracts = [currentContract];
    rescheduleItem(database, currentContract.id, currentContract.schedule[0].id, '2026-02-15', 600);
    expect(currentContract.schedule.reduce((sum, item) => sum + item.amount, 0)).toBe(currentContract.financedAmount);
    expect(currentContract.schedule.map((item) => item.amount)).toEqual([600, 400]);
  });
});
