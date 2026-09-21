import { paidFor } from './store';
import type { Database } from './types';

export type DashboardMetrics = {
  customerCount: number;
  contractCount: number;
  totalContractValue: number;
  totalPaid: number;
  totalRemaining: number;
  overdueInstallments: number;
  dueThisWeek: number;
  topProducts: Array<{ name: string; count: number; value: number }>;
  lateCustomers: Array<{ name: string; count: number; amount: number }>;
  collectionRate: number;
  monthlyFlow: Array<{ key: string; label: string; paid: number; due: number }>;
};

const dateKey = (date: Date) => date.toISOString().slice(0, 10);
const monthKey = (value: string) => value.slice(0, 7);
const monthLabel = (key: string) => new Date(`${key}-01T00:00:00`).toLocaleDateString('ar-IQ', { month: 'short' });

export function getDashboardMetrics(database: Database, referenceDate = new Date()): DashboardMetrics {
  const customers = [...new Map(database.customers.map((customer) => [customer.id, customer])).values()];
  const contracts = [...new Map(database.contracts.map((contract) => [contract.id, contract])).values()];
  const today = dateKey(referenceDate);
  const weekEnd = new Date(referenceDate);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndKey = dateKey(weekEnd);
  const totalContractValue = contracts.reduce((sum, contract) => sum + contract.totalAmount, 0);
  const totalPaid = contracts.reduce((sum, contract) => sum + paidFor(database, contract), 0);
  const totalRemaining = Math.max(0, contracts.reduce((sum, contract) => sum + contract.financedAmount, 0) - totalPaid);
  const schedules = contracts.flatMap((contract) => contract.schedule.map((schedule) => ({ contract, schedule })));
  const unpaid = schedules.filter(({ schedule }) => schedule.paidAmount < schedule.amount);
  const overdueInstallments = unpaid.filter(({ schedule }) => schedule.dueDate < today).length;
  const dueThisWeek = unpaid.filter(({ schedule }) => schedule.dueDate >= today && schedule.dueDate <= weekEndKey).length;

  const productMap = new Map<string, { count: number; value: number }>();
  for (const contract of contracts) {
    const current = productMap.get(contract.productName) || { count: 0, value: 0 };
    current.count += 1;
    current.value += contract.totalAmount;
    productMap.set(contract.productName, current);
  }
  const topProducts = [...productMap.entries()].map(([name, value]) => ({ name, ...value })).sort((a, b) => b.count - a.count || b.value - a.value).slice(0, 5);

  const customerMap = new Map<string, { count: number; amount: number }>();
  for (const { contract, schedule } of unpaid.filter(({ schedule }) => schedule.dueDate < today)) {
    const current = customerMap.get(contract.customerId) || { count: 0, amount: 0 };
    current.count += 1;
    current.amount += Math.max(0, schedule.amount - schedule.paidAmount);
    customerMap.set(contract.customerId, current);
  }
  const lateCustomers = [...customerMap.entries()].map(([customerId, value]) => ({ name: customers.find((customer) => customer.id === customerId)?.name || 'زبون غير معروف', ...value })).sort((a, b) => b.amount - a.amount).slice(0, 5);

  const monthKeys = Array.from({ length: 6 }, (_, index) => { const date = new Date(referenceDate); date.setMonth(date.getMonth() - (5 - index)); return date.toISOString().slice(0, 7); });
  const monthlyFlow = monthKeys.map((key) => {
    const paid = database.payments.filter((payment) => monthKey(payment.date) === key).reduce((sum, payment) => sum + payment.amount, 0);
    const due = schedules.filter(({ schedule }) => monthKey(schedule.dueDate) === key).reduce((sum, { schedule }) => sum + schedule.amount, 0);
    return { key, label: monthLabel(key), paid, due };
  });
  const currentMonth = monthKey(today);
  const currentDue = schedules.filter(({ schedule }) => monthKey(schedule.dueDate) === currentMonth).reduce((sum, { schedule }) => sum + schedule.amount, 0);
  const currentPaid = database.payments.filter((payment) => monthKey(payment.date) === currentMonth).reduce((sum, payment) => sum + payment.amount, 0);
  const collectionRate = currentDue ? Math.min(100, Math.round(currentPaid / currentDue * 100)) : 0;
  return { customerCount: customers.length, contractCount: contracts.length, totalContractValue, totalPaid, totalRemaining, overdueInstallments, dueThisWeek, topProducts, lateCustomers, collectionRate, monthlyFlow };
}
