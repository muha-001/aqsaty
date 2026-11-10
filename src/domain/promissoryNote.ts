import type { Contract, Database } from './types';
import { contractStats, today } from './store';

export interface PromissoryNoteDraft {
  amount: number;
  amountInWords: string;
  creationDate: string;
  creationPlace: string;
  maturityDate: string;
  maturityPlace: string;
  beneficiaryName: string;
  makerName: string;
  makerAddress: string;
  contractNumber: string;
  terms: string;
}

export type PromissoryNoteField = Exclude<keyof PromissoryNoteDraft, 'contractNumber' | 'terms'>;

export function buildPromissoryNoteDraft(database: Database, contract: Contract): PromissoryNoteDraft {
  const customer = database.customers.find((item) => item.id === contract.customerId);
  const remaining = contractStats(database, contract).remaining;
  const unpaid = contract.schedule.filter((item) => item.paidAmount < item.amount);
  const maturityDate = unpaid[unpaid.length - 1]?.dueDate || contract.startDate;
  return {
    amount: remaining,
    amountInWords: '',
    creationDate: today(),
    creationPlace: 'بغداد',
    maturityDate,
    maturityPlace: 'بغداد',
    beneficiaryName: database.settings.shopName || 'المستفيد',
    makerName: customer?.name || '',
    makerAddress: '',
    contractNumber: contract.number,
    terms: 'أتعهد تعهداً غير معلق على شرط بأن أدفع لأمر المستفيد المبلغ المبين أعلاه في تاريخ ومكان الاستحقاق.',
  };
}

export function validatePromissoryNoteDraft(draft: PromissoryNoteDraft): { valid: boolean; missing: PromissoryNoteField[] } {
  const required: PromissoryNoteField[] = ['amount', 'amountInWords', 'creationDate', 'creationPlace', 'maturityDate', 'maturityPlace', 'beneficiaryName', 'makerName', 'makerAddress'];
  const missing = required.filter((field) => field === 'amount' ? !Number.isFinite(draft.amount) || draft.amount <= 0 : !String(draft[field]).trim());
  return { valid: missing.length === 0, missing };
}
