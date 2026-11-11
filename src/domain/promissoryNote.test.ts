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
      amount: 0, amountInWords: '', currency: '', creationDate: '', creationPlace: '', maturityDate: '', maturityPlace: '', court: '',
      beneficiaryName: '', beneficiaryId: '', beneficiaryPhone: '', beneficiaryAddress: '', makerName: '', makerId: '', makerPhone: '', makerAddress: '', customerPhone: '', customerId: '', customerAddress: '', guarantorName: '', guarantorId: '', guarantorPhone: '', guarantorAddress: '', productModel: '', productStorage: '', productColor: '', productImei: '', months: 0, lateDays: 0, penaltyAmount: 0, penaltyRate: 0, contractNumber: '', installments: [], terms: '',
    });
    expect(result.valid).toBe(false);
    expect(result.missing).toEqual(expect.arrayContaining(['amount', 'amountInWords', 'creationDate', 'creationPlace', 'maturityDate', 'maturityPlace', 'beneficiaryName', 'makerName', 'makerAddress']));
  });

  it('accepts a completed note draft', () => {
    const result = validatePromissoryNoteDraft({
      amount: 1000000, amountInWords: 'مليون دينار عراقي فقط لا غير', currency: 'دينار عراقي', creationDate: today(), creationPlace: 'بغداد',
      maturityDate: '2027-01-01', maturityPlace: 'بغداد', court: 'محاكم البداءة', beneficiaryName: 'مكتب أقساطي', beneficiaryId: '', beneficiaryPhone: '', beneficiaryAddress: '', makerName: 'أحمد علي', makerId: '', makerPhone: '07700000000',
      makerAddress: 'بغداد - العراق', customerPhone: '07700000000', customerId: '', customerAddress: 'بغداد', guarantorName: '', guarantorId: '', guarantorPhone: '', guarantorAddress: '', productModel: 'هاتف', productStorage: '', productColor: '', productImei: '', months: 1, lateDays: 0, penaltyAmount: 0, penaltyRate: 0, contractNumber: 'AQ-001', installments: [{ number: 1, dueDate: '2027-01-01', amount: 1000000 }], terms: 'تعهد غير معلق على شرط بوفاء المبلغ',
    });
    expect(result).toEqual({ valid: true, missing: [] });
  });

  it('builds a bill-shaped draft with buyer, guarantor, device and installment data', () => {
    const database = emptyDatabase();
    database.settings.shopName = 'مكتب أقساطي';
    database.customers = [{ id: 'customer-1', name: 'أحمد علي', phone: '07700000000', createdAt: today() }];
    database.products = [{ id: 'product-1', name: 'iPhone 15 Pro Max', category: 'هواتف', description: '', price: 1200000, months: [5, 10], icon: '📱', active: true, stock: 1, serialNumbers: [], condition: 'جديد', images: [], specs: '256GB | أزرق' }];
    database.guarantors = [{ id: 'g-1', name: 'سالم علي', phone: '07800000000', relationship: 'أخ', address: 'بغداد', documents: [], createdAt: today(), updatedAt: today() }];
    const draft = buildPromissoryNoteDraft(database, { ...contract, requiresGuarantee: true, guarantorIds: ['g-1'], schedule: [
      { id: 's1', number: 1, dueDate: '2027-01-01', amount: 200000, paidAmount: 0 },
      { id: 's2', number: 2, dueDate: '2027-02-01', amount: 200000, paidAmount: 0 },
    ] });
    expect(draft.productModel).toBe('iPhone 15 Pro Max');
    expect(draft.customerPhone).toBe('07700000000');
    expect(draft.guarantorName).toBe('سالم علي');
    expect(draft.installments).toHaveLength(2);
  });
});
