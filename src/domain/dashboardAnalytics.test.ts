import { describe, expect, it } from 'vitest';
import { emptyDatabase, createSchedule } from './store';
import { getDashboardMetrics } from './dashboardAnalytics';

describe('dashboard analytics', () => {
  it('calculates financial totals, overdue installments, and this-week dues', () => {
    const database = emptyDatabase();
    database.customers = [{ id: 'c1', name: 'علي', phone: '07701234567', createdAt: '2026-09-01' }];
    database.products = [{ id: 'p1', name: 'هاتف', category: 'هواتف', description: '', price: 1200, months: [2], icon: '📱', active: true, stock: 1, serialNumbers: [], condition: 'جديد', images: [], specs: '' }];
    database.contracts = [{ id: 'ct1', number: 'AQ-1', customerId: 'c1', productId: 'p1', productName: 'هاتف', totalAmount: 1200, downPayment: 200, financedAmount: 1000, months: 2, startDate: '2026-09-01', status: 'نشط', schedule: createSchedule(1000, 2, '2026-09-01'), createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' }];
    database.contracts[0].schedule[0].dueDate = '2026-09-14';
    database.contracts[0].schedule[1].dueDate = '2026-09-20';
    database.contracts[0].schedule[0].paidAmount = 200;
    database.payments = [{ id: 'pay1', contractId: 'ct1', scheduleId: database.contracts[0].schedule[0].id, amount: 200, method: 'نقدي', date: '2026-09-10', receiptNumber: 'R1' }];
    const metrics = getDashboardMetrics(database, new Date('2026-09-20T12:00:00Z'));
    expect(metrics.totalContractValue).toBe(1200);
    expect(metrics.totalPaid).toBe(200);
    expect(metrics.totalRemaining).toBe(800);
    expect(metrics.overdueInstallments).toBe(1);
    expect(metrics.dueThisWeek).toBe(1);
    expect(metrics.topProducts[0]).toMatchObject({ name: 'هاتف', count: 1 });
  });

  it('returns monthly cash flow and a bounded collection rate', () => {
    const database = emptyDatabase();
    database.contracts = [];
    database.payments = [{ id: 'p1', contractId: 'missing', scheduleId: 's1', amount: 250, method: 'نقدي', date: '2026-09-03', receiptNumber: 'R1' }];
    const metrics = getDashboardMetrics(database, new Date('2026-09-20T12:00:00Z'));
    expect(metrics.monthlyFlow.find((item) => item.key === '2026-09')?.paid).toBe(250);
    expect(metrics.collectionRate).toBe(0);
  });
});
