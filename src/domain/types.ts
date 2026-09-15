export type PaymentMethod = 'نقدي' | 'تحويل' | 'بطاقة';
export type ProductIcon = '📱' | '❄️' | '💻' | '📺' | '⌚' | '🎮' | '🧺' | '🔌' | '📦';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  notes?: string;
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  description: string;
  price: number;
  months: number[];
  icon: ProductIcon;
  active: boolean;
}

export interface ScheduleItem {
  id: string;
  number: number;
  dueDate: string;
  amount: number;
  paidAmount: number;
}

export interface Contract {
  id: string;
  number: string;
  customerId: string;
  productId: string;
  productName: string;
  totalAmount: number;
  downPayment: number;
  financedAmount: number;
  months: number;
  startDate: string;
  schedule: ScheduleItem[];
  createdAt: string;
}

export interface Payment {
  id: string;
  contractId: string;
  scheduleId: string;
  amount: number;
  method: PaymentMethod;
  date: string;
}

export interface Database {
  customers: Customer[];
  products: Product[];
  contracts: Contract[];
  payments: Payment[];
}

export interface ContractStats {
  paid: number;
  remaining: number;
  completed: number;
  overdue: number;
  percent: number;
}
