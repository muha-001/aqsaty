import type { Database, Contract } from './types';

export type FinancialMetrics = {
  purchaseCostTotal: number;
  cashSalesTotal: number;
  installmentSalesTotal: number;
  installmentTotal: number;
  expectedProfitTotal: number;
  downPayments: number;
  installmentPayments: number;
  totalCollected: number;
  totalDistributedWithoutProfit: number;
  totalDistributedWithProfit: number;
  collectedProfitTotal: number;
  outstandingProfit: number;
  dailyRevenue: number;
  monthlyRevenue: number;
  dailyProfit: number;
  monthlyProfit: number;
};

const dayKey = (value: string) => value.slice(0, 10);
const monthKey = (value: string) => value.slice(0, 7);

function productCost(database: Database, contract: Contract) {
  const value = database.products.find((product) => product.id === contract.productId)?.costPrice;
  return value === undefined ? null : Math.max(0, value);
}

function productCashPrice(database: Database, contract: Contract) {
  const product = database.products.find((item) => item.id === contract.productId);
  return Math.max(0, product?.cashPrice ?? product?.price ?? 0);
}

function paymentEvents(database: Database, contract: Contract) {
  const payments = database.payments.filter((payment) => payment.contractId === contract.id);
  return [{ amount: Math.max(0, contract.downPayment), date: dayKey(contract.createdAt) }, ...payments.map((payment) => ({ amount: Math.max(0, payment.amount), date: dayKey(payment.date) }))];
}

function recognizedProfit(contract: Contract, expectedProfit: number, amount: number) {
  return contract.totalAmount > 0 ? expectedProfit * Math.min(amount, contract.totalAmount) / contract.totalAmount : 0;
}

export function getFinancialMetrics(database: Database, referenceDate = new Date()): FinancialMetrics {
  const today = dayKey(referenceDate.toISOString());
  const currentMonth = monthKey(today);
  let purchaseCostTotal = 0;
  let cashSalesTotal = 0;
  let installmentSalesTotal = 0;
  let installmentTotal = 0;
  let expectedProfitTotal = 0;
  let downPayments = 0;
  let installmentPayments = 0;
  let totalCollected = 0;
  let totalDistributedWithoutProfit = 0;
  let totalDistributedWithProfit = 0;
  let collectedProfitTotal = 0;
  let dailyRevenue = 0;
  let monthlyRevenue = 0;
  let dailyProfit = 0;
  let monthlyProfit = 0;

  for (const contract of database.contracts) {
    const productCostValue = productCost(database, contract);
    const cost = productCostValue ?? 0;
    const contractTotal = Math.max(0, contract.totalAmount);
    const expectedProfit = productCostValue === null ? 0 : Math.max(0, contractTotal - cost);
    const contractDownPayment = Math.max(0, contract.downPayment);
    const contractInstallments = Math.max(0, contractTotal - contractDownPayment);
    const events = paymentEvents(database, contract);
    const collected = Math.min(contractTotal, events.reduce((sum, event) => sum + event.amount, 0));

    purchaseCostTotal += cost;
    cashSalesTotal += productCashPrice(database, contract);
    installmentSalesTotal += contractTotal;
    installmentTotal += contractInstallments;
    expectedProfitTotal += expectedProfit;
    downPayments += contractDownPayment;
    installmentPayments += events.slice(1).reduce((sum, event) => sum + event.amount, 0);
    totalCollected += collected;
    totalDistributedWithoutProfit += cost;
    totalDistributedWithProfit += contractTotal;
    collectedProfitTotal += recognizedProfit(contract, expectedProfit, collected);

    for (const event of events) {
      const recognizedRevenue = Math.min(event.amount, Math.max(0, contractTotal));
      const profit = recognizedProfit(contract, expectedProfit, recognizedRevenue);
      if (event.date === today) { dailyRevenue += recognizedRevenue; dailyProfit += profit; }
      if (event.date.slice(0, 7) === currentMonth) { monthlyRevenue += recognizedRevenue; monthlyProfit += profit; }
    }
  }

  return { purchaseCostTotal, cashSalesTotal, installmentSalesTotal, installmentTotal, expectedProfitTotal, downPayments, installmentPayments, totalCollected, totalDistributedWithoutProfit, totalDistributedWithProfit, collectedProfitTotal, outstandingProfit: Math.max(0, expectedProfitTotal - collectedProfitTotal), dailyRevenue, monthlyRevenue, dailyProfit, monthlyProfit };
}
