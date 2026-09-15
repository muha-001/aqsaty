import { createId, saveDatabase } from './store';
import type { Database, Product } from './types';

const products: Product[] = [
  { id: createId('product'), name: 'آيفون 16 برو ماكس', category: 'هواتف ذكية', description: 'أضف المنتجات وعدّلها من لوحة الإدارة المحلية.', price: 1_850_000, months: [6, 10, 12], icon: '📱', active: true },
  { id: createId('product'), name: 'جهاز تبريد منزلي', category: 'أجهزة منزلية', description: 'منتج تجريبي قابل للتعديل أو الحذف من الإدارة.', price: 950_000, months: [6, 10, 12], icon: '❄️', active: true },
];

export function ensureSeedData(database: Database) {
  if (!database.products.length) {
    database.products = products;
    saveDatabase(database);
  }
  return database;
}
