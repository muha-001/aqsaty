import type { Contract, Database, GuaranteeDocument, Guarantor } from './types';
import { contractStats, dateText, isValidPhone, money, normalizePhone, whatsappPhone } from './store';

const documentTypes = ['هوية وطنية', 'بطاقة سكن', 'سند ملكية', 'كفالة مالية', 'أخرى'] as const;
export const GUARANTEE_DOCUMENT_TYPES = documentTypes;

type ValidationResult = { valid: boolean; errors: string[] };

export function validateGuarantor(guarantor: Pick<Guarantor, 'name' | 'phone' | 'relationship' | 'address'>): ValidationResult {
  const errors: string[] = [];
  if (!guarantor.name.trim()) errors.push('اسم الضامن مطلوب');
  if (!isValidPhone(guarantor.phone)) errors.push('رقم هاتف الضامن غير صحيح');
  if (!guarantor.relationship.trim()) errors.push('صلة الضامن بالزبون مطلوبة');
  if (!guarantor.address.trim()) errors.push('عنوان الضامن مطلوب');
  return { valid: errors.length === 0, errors };
}

export function validateGuaranteeDocument(document: Pick<GuaranteeDocument, 'type' | 'name' | 'mimeType' | 'size' | 'dataUrl'>): ValidationResult {
  const errors: string[] = [];
  if (!documentTypes.includes(document.type)) errors.push('نوع مستند الضمان غير صحيح');
  if (!document.name.trim()) errors.push('اسم المستند مطلوب');
  if (!document.mimeType || document.size <= 0 || !document.dataUrl) errors.push('ملف المستند غير صالح');
  return { valid: errors.length === 0, errors };
}

export function linkGuarantorToContract(database: Database, contractId: string, guarantorId: string): Contract {
  const contract = database.contracts.find((item) => item.id === contractId);
  if (!contract) throw new Error('العقد غير موجود');
  if (!database.guarantors.some((item) => item.id === guarantorId)) throw new Error('الضامن غير موجود');
  const ids = contract.guarantorIds || [];
  contract.guarantorIds = ids.includes(guarantorId) ? ids : [...ids, guarantorId];
  contract.requiresGuarantee = true;
  contract.updatedAt = new Date().toISOString();
  return contract;
}

export function unlinkGuarantorFromContract(database: Database, contractId: string, guarantorId: string): Contract {
  const contract = database.contracts.find((item) => item.id === contractId);
  if (!contract) throw new Error('العقد غير موجود');
  contract.guarantorIds = (contract.guarantorIds || []).filter((id) => id !== guarantorId);
  contract.requiresGuarantee = contract.guarantorIds.length > 0;
  contract.updatedAt = new Date().toISOString();
  return contract;
}

export function buildGuarantorReminderMessage(database: Database, contractId: string, guarantorId: string, shopName = database.settings.shopName) {
  const contract = database.contracts.find((item) => item.id === contractId);
  const guarantor = database.guarantors.find((item) => item.id === guarantorId);
  if (!contract || !guarantor) throw new Error('بيانات العقد أو الضامن غير موجودة');
  const overdue = contract.schedule.filter((item) => item.paidAmount < item.amount && item.dueDate < new Date().toISOString().slice(0, 10));
  if (!overdue.length) throw new Error('لا توجد أقساط متأخرة لهذا العقد');
  const amount = overdue.reduce((sum, item) => sum + item.amount - item.paidAmount, 0);
  const schedule = overdue.map((item) => `القسط ${item.number}: ${money(item.amount - item.paidAmount)} — ${dateText(item.dueDate)}`).join('\n');
  const message = `السلام عليكم ${guarantor.name}،\n\nنود إشعاركم بصفتكم ضامنًا للعقد ${contract.number} لدى ${shopName} بوجود أقساط متأخرة على الزبون.\nالمنتج: ${contract.productName}\nإجمالي المتأخر: ${money(amount)}\n\n${schedule}\n\nنرجو التفضل بالتواصل مع ${shopName} لمتابعة التسديد. شكرًا لتعاونكم.`;
  return { phone: whatsappPhone(normalizePhone(guarantor.phone)), message, overdueAmount: amount };
}

export function guarantorsForContract(database: Database, contract: Contract): Guarantor[] {
  const ids = contract.guarantorIds || [];
  return ids.map((id) => database.guarantors.find((item) => item.id === id)).filter((item): item is Guarantor => Boolean(item));
}

export function hasOverdueGuarantee(database: Database, contract: Contract) {
  return contractStats(database, contract).overdue > 0 && (contract.guarantorIds || []).length > 0;
}
