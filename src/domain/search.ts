import { contractStats, normalizePhone } from './store';
import type { Contract, ContractStatus, Database } from './types';

export type ContractSort = 'newest' | 'oldest' | 'highestPrice' | 'mostOverdue' | 'nearestDue';
export type ContractSearchFilters = { query?: string; status?: ContractStatus | 'all'; dueFrom?: string; dueTo?: string; minRemaining?: number; maxRemaining?: number; sort?: ContractSort };

export function filterAndSortContracts(database: Database, filters: ContractSearchFilters): Contract[] {
  const query = (filters.query || '').trim().toLocaleLowerCase();
  const matches = database.contracts.filter((contract) => {
    const customer = database.customers.find((item) => item.id === contract.customerId);
    const haystack = [customer?.name, customer?.phone, normalizePhone(customer?.phone || ''), contract.number, contract.productName, contract.serialNumber].filter(Boolean).join(' ').toLocaleLowerCase();
    const stats = contractStats(database, contract);
    const nextDue = stats.nextDue?.dueDate || '';
    const statusMatches = !filters.status || filters.status === 'all' || contract.status === filters.status || (filters.status === 'متأخر' && stats.overdue > 0);
    return (!query || haystack.includes(query) || normalizePhone(query) === normalizePhone(customer?.phone || '')) && statusMatches && (!filters.dueFrom || nextDue >= filters.dueFrom) && (!filters.dueTo || nextDue <= filters.dueTo) && (filters.minRemaining === undefined || stats.remaining >= filters.minRemaining) && (filters.maxRemaining === undefined || stats.remaining <= filters.maxRemaining);
  });
  return matches.sort((a, b) => {
    const sa = contractStats(database, a); const sb = contractStats(database, b);
    if (filters.sort === 'oldest') return a.createdAt.localeCompare(b.createdAt);
    if (filters.sort === 'highestPrice') return b.totalAmount - a.totalAmount;
    if (filters.sort === 'mostOverdue') return sb.overdue - sa.overdue || sb.latePenalty - sa.latePenalty;
    if (filters.sort === 'nearestDue') return (sa.nextDue?.dueDate || '9999').localeCompare(sb.nextDue?.dueDate || '9999');
    return b.createdAt.localeCompare(a.createdAt);
  });
}
