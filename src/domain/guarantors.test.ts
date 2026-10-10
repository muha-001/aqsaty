import { describe, expect, it } from 'vitest';
import type { Contract, Database, Guarantor } from './types';
import { buildGuarantorReminderMessage, linkGuarantorToContract, validateGuarantor, validateGuaranteeDocument } from './guarantors';
import { emptyDatabase, money } from './store';

const guarantor: Guarantor = {
  id: 'g-1', name: 'محمد علي', phone: '07701234567', relationship: 'أخ', address: 'بغداد - الكرادة',
  documents: [{ id: 'doc-1', type: 'هوية وطنية', name: 'هوية محمد.pdf', mimeType: 'application/pdf', size: 1200, dataUrl: 'data:application/pdf;base64,AAA', createdAt: '2026-09-24T00:00:00.000Z' }],
  createdAt: '2026-09-24T00:00:00.000Z', updatedAt: '2026-09-24T00:00:00.000Z',
};
const contract: Contract = {
  id: 'c-1', number: 'AQ-2026-00001', customerId: 'customer-1', productId: 'p-1', productName: 'هاتف', totalAmount: 1200000, downPayment: 200000, financedAmount: 1000000, months: 2,
  startDate: '2026-08-01', status: 'متأخر', requiresGuarantee: true, guarantorIds: [],
  schedule: [{ id: 's-1', number: 1, dueDate: '2026-08-15', amount: 500000, paidAmount: 0 }, { id: 's-2', number: 2, dueDate: '2026-09-15', amount: 500000, paidAmount: 0 }],
  createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z',
};

describe('guarantor domain', () => {
  it('validates required guarantor identity and Iraqi phone', () => {
    expect(validateGuarantor(guarantor)).toEqual({ valid: true, errors: [] });
    expect(validateGuarantor({ ...guarantor, phone: '123' })).toMatchObject({ valid: false });
    expect(validateGuarantor({ ...guarantor, name: ' ' })).toMatchObject({ valid: false });
  });
  it('requires a supported document type and file metadata', () => {
    expect(validateGuaranteeDocument(guarantor.documents[0])).toEqual({ valid: true, errors: [] });
    expect(validateGuaranteeDocument({ ...guarantor.documents[0], type: 'غير معروف' as never })).toMatchObject({ valid: false });
  });
  it('links a guarantor once and marks the contract as requiring guarantee', () => {
    const database = emptyDatabase(); database.guarantors = [guarantor]; database.contracts = [contract];
    linkGuarantorToContract(database, contract.id, guarantor.id); linkGuarantorToContract(database, contract.id, guarantor.id);
    expect(database.contracts[0].requiresGuarantee).toBe(true); expect(database.contracts[0].guarantorIds).toEqual([guarantor.id]);
  });
  it('builds an overdue reminder for the guarantor, not the customer', () => {
    const database: Database = emptyDatabase(); database.guarantors = [guarantor]; database.contracts = [contract];
    const reminder = buildGuarantorReminderMessage(database, contract.id, guarantor.id, 'aqsaty');
    expect(reminder.phone).toBe('9647701234567'); expect(reminder.message).toContain('محمد علي'); expect(reminder.message).toContain('AQ-2026-00001'); expect(reminder.message).toContain(money(1000000));
  });
});
