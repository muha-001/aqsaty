import { describe, expect, it } from 'vitest';
import { buildPromissoryNoteDraft, validatePromissoryNoteDraft } from './promissoryNote';
import { emptyDatabase, today } from './store';
import type { Contract } from './types';

const contract: Contract = {
  id: 'contract-1', number: 'AQ-001', customerId: 'customer-1', productId: 'product-1', productName: 'هاتف',
  totalAmount: 1200000, downPayment: 200000, financedAmount: 1000000, months: 10, startDate: today(), status: 'نشط',
  schedule: [{ id: 'schedule-1', number: 1, dueDate: '2027-01-01', amount: 100000, paidAmount: 0 }],
  createdAt: `${today()}T00:00:00.000Z`, updatedAt: `${today()}T00:00:00.000Z`,
};

describe('promissory note drafts', () => {
  it('builds a note from the contract without changing the database', () => {
    const database = emptyDatabase();
    database.settings.shopName = 'مكتب أقساطي';
    database.customers = [{ id: 'customer-1', name: 'أحمد علي', phone: '07700000000', createdAt: today() }];
    const draft = buildPromissoryNoteDraft(database, contract);
    expect(draft.amount).toBe(1000000);
    expect(draft.maturityDate).toBe('2027-01-01');
    expect(draft.beneficiaryName).toBe('مكتب أقساطي');
    expect(draft.makerName).toBe('أحمد علي');
    expect(database.contracts).toEqual([]);
  });

  it('rejects a note that is missing mandatory Iraqi commercial-paper fields', () => {
    const result = validatePromissoryNoteDraft({
      amount: 0, amountInWords: '', creationDate: '', creationPlace: '', maturityDate: '', maturityPlace: '',
      beneficiaryName: '', makerName: '', makerAddress: '', contractNumber: '', terms: '',
    });
    expect(result.valid).toBe(false);
    expect(result.missing).toEqual(expect.arrayContaining(['amount', 'amountInWords', 'creationDate', 'creationPlace', 'maturityDate', 'maturityPlace', 'beneficiaryName', 'makerName', 'makerAddress']));
  });

  it('accepts a completed note draft', () => {
    const result = validatePromissoryNoteDraft({
      amount: 1000000, amountInWords: 'مليون دينار عراقي فقط لا غير', creationDate: today(), creationPlace: 'بغداد',
      maturityDate: '2027-01-01', maturityPlace: 'بغداد', beneficiaryName: 'مكتب أقساطي', makerName: 'أحمد علي',
      makerAddress: 'بغداد - العراق', contractNumber: 'AQ-001', terms: 'تعهد غير معلق على شرط بوفاء المبلغ',
    });
    expect(result).toEqual({ valid: true, missing: [] });
  });
});
