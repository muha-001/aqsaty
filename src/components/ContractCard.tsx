import type { Database, Contract } from '../domain/types';
import { contractStats, dateText, money, statusFor } from '../domain/store';

interface Props { database: Database; contract: Contract; admin?: boolean; onPayment?: (contractId: string, scheduleId: string) => void; onWhatsApp?: (contractId: string, scheduleId: string) => void; }

export function ContractCard({ database, contract, admin = false, onPayment, onWhatsApp }: Props) {
  const stats = contractStats(database, contract);
  const customer = database.customers.find((item) => item.id === contract.customerId);
  const badge = stats.overdue ? 'red' : stats.remaining ? 'orange' : 'green';
  return <article className="contract">
    <div className="contract-top"><div><h3>{contract.productName}</h3><div className="contract-meta">العقد {contract.number} · {contract.months} أشهر · بدأ {dateText(contract.startDate)}</div>{admin && <div className="contract-meta">الزبون: {customer?.name || '—'} · {customer?.phone || '—'}</div>}</div><span className={`badge ${badge}`}>{stats.overdue ? 'متأخر' : stats.remaining ? 'نشط' : 'مكتمل'}</span></div>
    <div className="progress"><i style={{ width: `${stats.percent}%` }} /></div>
    <div className="contract-details"><span>المسدد: <b>{money(stats.paid)}</b></span><span>المتبقي: <b>{money(stats.remaining)}</b></span><span>الأشهر: <b>{stats.completed}/{contract.months}</b></span></div>
    <details style={{ marginTop: 12 }}><summary style={{ cursor: 'pointer', color: 'var(--navy)', fontWeight: 700 }}>عرض جدول الأقساط</summary><div className="admin-table"><table><thead><tr><th>#</th><th>الاستحقاق</th><th>المبلغ</th><th>المدفوع</th><th>الحالة</th>{admin && <th>إجراء</th>}</tr></thead><tbody>{contract.schedule.map((item) => { const status = statusFor(item); return <tr key={item.id}><td>{item.number}</td><td>{dateText(item.dueDate)}</td><td>{money(item.amount)}</td><td>{money(item.paidAmount)}</td><td className={status.tone === 'paid' ? 'status-paid' : status.tone === 'late' ? 'status-late' : status.tone === 'partial' ? 'status-partial' : 'status-due'}>{status.label}</td>{admin && <td><div className="row-actions">{item.paidAmount < item.amount && <><button className="btn green-btn" style={{ padding: '5px 9px', fontSize: 11 }} onClick={() => onPayment?.(contract.id, item.id)}>تسجيل دفعة</button><button className="btn muted-btn" style={{ padding: '5px 9px', fontSize: 11 }} onClick={() => onWhatsApp?.(contract.id, item.id)}>واتساب</button></>}</div></td>}</tr>; })}</tbody></table></div></details>
  </article>;
}
