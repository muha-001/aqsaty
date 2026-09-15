export type PaymentMethod = 'نقدي' | 'تحويل' | 'بطاقة';
export type ProductIcon = '📱' | '❄️' | '💻' | '📺' | '⌚' | '🎮' | '🧺' | '🔌' | '📦';
export type ContractStatus = 'جديد' | 'نشط' | 'متأخر' | 'مكتمل' | 'موقوف' | 'ملغى';
export type ActivityAction = 'إنشاء' | 'تعديل' | 'دفعة' | 'حذف' | 'استيراد' | 'تصدير' | 'إعادة جدولة';

export interface Customer { id: string; name: string; phone: string; notes?: string; createdAt: string; }
export interface Product { id: string; name: string; category: string; description: string; price: number; months: number[]; icon: ProductIcon; active: boolean; stock: number; serialNumbers: string[]; }
export interface ScheduleItem { id: string; number: number; dueDate: string; amount: number; paidAmount: number; }
export interface Contract { id: string; number: string; customerId: string; productId: string; productName: string; serialNumber?: string; totalAmount: number; downPayment: number; financedAmount: number; months: number; startDate: string; status: ContractStatus; schedule: ScheduleItem[]; createdAt: string; updatedAt: string; }
export interface Payment { id: string; contractId: string; scheduleId: string; amount: number; method: PaymentMethod; date: string; receiptNumber: string; note?: string; }
export interface ActivityLog { id: string; action: ActivityAction; entity: string; entityId: string; description: string; createdAt: string; }
export interface Settings { shopName: string; whatsappTemplate: string; reminderTemplate: string; }
export interface Database { customers: Customer[]; products: Product[]; contracts: Contract[]; payments: Payment[]; activities: ActivityLog[]; settings: Settings; }
export interface ContractStats { paid: number; remaining: number; completed: number; overdue: number; percent: number; nextDue?: ScheduleItem; }
