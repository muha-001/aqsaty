import { useState } from 'react';
import { CheckCircle2, RotateCcw, Trash2 } from 'lucide-react';
import { canPermanentlyDelete, entityLabel } from '../domain/securityFeatures';
import type { Database, WorkspaceRole } from '../domain/types';

export function TrashPanel({ database, role = 'owner', onRestore, onPermanentDelete }: { database: Database; role?: WorkspaceRole; onRestore: (id: string) => void; onPermanentDelete: (id: string) => void }) {
  const [confirmationId, setConfirmationId] = useState<string | null>(null);
  const trash = database.trash ?? [];
  return <div className="security-stack"><div className="admin-title"><div><h2>سلة المحذوفات</h2><p className="hint">العناصر لا تُحذف مباشرة. يحتفظ النظام باسم المستخدم ووقت العملية.</p></div><span className="current-badge">{trash.length} عنصر</span></div>
    {trash.length === 0 ? <div className="admin-card"><p className="hint">السلة فارغة.</p></div> : <div className="trash-list">{trash.map((item) => <div className="device-row" key={item.id}><div><strong>{entityLabel(item.entityType)} · {item.entityId}</strong><p className="contract-meta">حُذف بواسطة {item.deletedByName} · {new Date(item.deletedAt).toLocaleString('ar-IQ')}</p></div><div className="row-actions"><button className="btn green-btn" onClick={() => onRestore(item.id)}><RotateCcw size={14} /> استعادة</button>{canPermanentlyDelete(role) && (confirmationId === item.id ? <button className="btn danger" onClick={() => { onPermanentDelete(item.id); setConfirmationId(null); }}><CheckCircle2 size={14} /> تأكيد الحذف</button> : <button className="btn danger" onClick={() => setConfirmationId(item.id)}><Trash2 size={14} /> حذف نهائي</button>)}</div>{confirmationId === item.id && <p className="danger-text">سيُحذف هذا العنصر نهائيًا ولا يمكن استعادته. اضغط «تأكيد الحذف» للمتابعة.</p>}</div>)}</div>}
  </div>;
}
