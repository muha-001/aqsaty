import { describe, expect, it } from 'vitest';
import { createSchedule, emptyDatabase } from './store';
import { getFinancialMetrics } from './financialAnalytics';

describe('financial analytics', () => {
  it('separates purchase cost, installment revenue, expected profit and collected profit', () => {
    const database = emptyDatabase();
    database.products = [{ id: 'product-1', name: 'هاتف', category: 'هواتف', description: '', price: 900, costPrice: 600, cashPrice: 900, installmentPrice: 1200, months: [6], icon: '📱', active: true, stock: 1, serialNumbers: [], condition: 'جديد', images: [], specs: '' }];
    database.contracts = [{ id: 'contract-1', number: 'AQ-1', customerId: 'customer-1', productId: 'product-1', productName: 'هاتف', totalAmount: 1200, downPayment: 200, financedAmount: 1000, months: 2, startDate: '2026-09-01', status: 'نشط', schedule: createSchedule(1000, 2, '2026-09-01'), createdAt: '2026-09-20T10:00:00.000Z', updatedAt: '2026-09-20T10:00:00.000Z' }];
    database.payments = [{ id: 'payment-1', contractId: 'contract-1', scheduleId: database.contracts[0].schedule[0].id, amount: 100, method: 'نقدي', date: '2026-09-20', receiptNumber: 'R-1' }];
    const metrics = getFinancialMetrics(database, new Date('2026-09-20T12:00:00.000Z'));
    expect(metrics.purchaseCostTotal).toBe(600);
    expect(metrics.cashSalesTotal).toBe(900);
    expect(metrics.installmentSalesTotal).toBe(1200);
    expect(metrics.installmentTotal).toBe(1000);
    expect(metrics.expectedProfitTotal).toBe(600);
    expect(metrics.totalCollected).toBe(300);
    expect(metrics.collectedProfitTotal).toBe(150);
    expect(metrics.totalDistributedWithoutProfit).toBe(600);
    expect(metrics.totalDistributedWithProfit).toBe(1200);
    expect(metrics.dailyRevenue).toBe(300);
    expect(metrics.dailyProfit).toBe(150);
    expect(metrics.monthlyRevenue).toBe(300);
    expect(metrics.monthlyProfit).toBe(150);
  });

  it('does not invent profit for legacy products without a purchase cost', () => {
    const database = emptyDatabase();
    database.products = [{ id: 'legacy-product', name: 'منتج قديم', category: '', description: '', price: 1000, months: [6], icon: '📦', active: true, stock: 1, serialNumbers: [], condition: 'جديد', images: [], specs: '' }];
    database.contracts = [{ id: 'legacy-contract', number: 'AQ-2', customerId: 'customer-1', productId: 'legacy-product', productName: 'منتج قديم', totalAmount: 1000, downPayment: 0, financedAmount: 1000, months: 1, startDate: '2026-09-01', status: 'نشط', schedule: createSchedule(1000, 1, '2026-09-01'), createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' }];
    const metrics = getFinancialMetrics(database, new Date('2026-09-20T12:00:00.000Z'));
    expect(metrics.expectedProfitTotal).toBe(0);
    expect(metrics.totalDistributedWithoutProfit).toBe(0);
  });
});

export {};

