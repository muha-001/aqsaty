import type { Contract, Database } from './types';
import { contractStats, today } from './store';

export interface PromissoryInstallment {
  number: number;
  dueDate: string;
  amount: number;
}

export interface PromissoryNoteDraft {
  amount: number;
  amountInWords: string;
  currency: string;
  creationDate: string;
  creationPlace: string;
  maturityDate: string;
  maturityPlace: string;
  court: string;
  beneficiaryName: string;
  beneficiaryId: string;
  beneficiaryPhone: string;
  beneficiaryAddress: string;
  makerName: string;
  makerId: string;
  makerPhone: string;
  makerAddress: string;
  customerPhone: string;
  customerId: string;
  customerAddress: string;
  guarantorName: string;
  guarantorId: string;
  guarantorPhone: string;
  guarantorAddress: string;
  productModel: string;
  productStorage: string;
  productColor: string;
  productImei: string;
  months: number;
  lateDays: number;
  penaltyAmount: number;
  penaltyRate: number;
  contractNumber: string;
  installments: PromissoryInstallment[];
  terms: string;
}

export type PromissoryNoteField = Exclude<keyof PromissoryNoteDraft, 'contractNumber' | 'terms' | 'installments' | 'lateDays' | 'penaltyAmount' | 'penaltyRate'>;

function productDetails(database: Database, contract: Contract) {
  const product = database.products.find((item) => item.id === contract.productId);
  const specs = product?.specs || '';
  const [storage = '', color = ''] = specs.split('|').map((part) => part.trim());
  return { model: product?.name || contract.productName, storage, color };
}

export function buildPromissoryNoteDraft(database: Database, contract: Contract): PromissoryNoteDraft {
  const customer = database.customers.find((item) => item.id === contract.customerId);
  const guarantor = database.guarantors.find((item) => contract.guarantorIds?.includes(item.id));
  const remaining = contractStats(database, contract).remaining;
  const schedule = contract.schedule.map((item) => ({ number: item.number, dueDate: item.dueDate, amount: item.amount }));
  const unpaid = schedule.filter((item) => item.amount > 0);
  const maturityDate = unpaid[unpaid.length - 1]?.dueDate || contract.startDate;
  const product = productDetails(database, contract);
  return {
    amount: remaining,
    amountInWords: '',
    currency: 'دينار عراقي',
    creationDate: today(),
    creationPlace: 'بغداد / العراق',
    maturityDate,
    maturityPlace: 'بغداد / العراق',
    court: 'محاكم البداءة المختصة في العراق',
    beneficiaryName: database.settings.shopName || 'المستفيد',
    beneficiaryId: '', beneficiaryPhone: '', beneficiaryAddress: '',
    makerName: customer?.name || '', makerId: '', makerPhone: customer?.phone || '', makerAddress: customer?.notes || '',
    customerPhone: customer?.phone || '', customerId: '', customerAddress: customer?.notes || '',
    guarantorName: guarantor?.name || '', guarantorId: '', guarantorPhone: guarantor?.phone || '', guarantorAddress: guarantor?.address || '',
    productModel: product.model, productStorage: product.storage, productColor: product.color, productImei: contract.serialNumber || '',
    months: contract.months, lateDays: 0, penaltyAmount: 0, penaltyRate: 0,
    contractNumber: contract.number,
    installments: schedule,
    terms: 'أقر أنا المحرر أدناه بأن المبلغ المبيّن أعلاه ترتب بذمتي المالية ثمناً لشراء الجهاز الموصوف، وقد عاينته واستلمته بالكامل. أتعهد تعهداً غير معلق على شرط بالوفاء وفق جدول الأقساط، ويقر الكفيل عند وجوده بكفالته التضامنية ضمن حدود القانون.',
  };
}

export function validatePromissoryNoteDraft(draft: PromissoryNoteDraft): { valid: boolean; missing: PromissoryNoteField[] } {
  const required: PromissoryNoteField[] = ['amountInWords', 'creationDate', 'creationPlace', 'maturityDate', 'maturityPlace', 'beneficiaryName', 'makerName', 'makerAddress', 'productModel', 'customerPhone'];
  const missing = required.filter((field) => !String(draft[field]).trim());
  if (!Number.isFinite(draft.amount) || draft.amount <= 0) missing.push('amount');
  if (!draft.installments.length || draft.installments.some((item) => !item.dueDate || !Number.isFinite(item.amount) || item.amount <= 0)) missing.push('months');
  return { valid: missing.length === 0, missing };
}
