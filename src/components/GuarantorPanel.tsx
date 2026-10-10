import { useState, type ChangeEvent, type FormEvent } from 'react';
import { MessageCircle, Plus, Save, ShieldCheck, Trash2 } from 'lucide-react';
import { buildGuarantorReminderMessage, GUARANTEE_DOCUMENT_TYPES, guarantorsForContract, linkGuarantorToContract, validateGuarantor } from '../domain/guarantors';
import { createId, money } from '../domain/store';
import type { Database, GuaranteeDocumentType, Guarantor } from '../domain/types';

type Props = { database: Database; onChange: (database: Database) => void; onMessage: (message: string) => void };
const emptyDraft = { name: '', phone: '', relationship: '', address: '' };

export function GuarantorPanel({ database, onChange, onMessage }: Props) {
  const [draft, setDraft] = useState(emptyDraft);
  const [document, setDocument] = useState<{ type: GuaranteeDocumentType; file: File | null }>({ type: 'هوية وطنية', file: null });
  const [selectedContract, setSelectedContract] = useState('');
  const [selectedGuarantor, setSelectedGuarantor] = useState('');
  const [busy, setBusy] = useState(false);

  const readDocument = async (file: File) => new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('تعذر قراءة المستند')); reader.readAsDataURL(file); });
  const saveGuarantor = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validation = validateGuarantor(draft);
    if (!validation.valid) return onMessage(validation.errors[0]);
    if (document.file && document.file.size > 4_000_000) return onMessage('حجم مستند الضمان يجب ألا يتجاوز 4 ميغابايت');
    setBusy(true);
    try {
      const now = new Date().toISOString();
      const newDocument = document.file ? { id: createId('guarantee-doc'), type: document.type, name: document.file.name, mimeType: document.file.type || 'application/octet-stream', size: document.file.size, dataUrl: await readDocument(document.file), createdAt: now } : null;
      const guarantor: Guarantor = { id: createId('guarantor'), ...draft, documents: newDocument ? [newDocument] : [], createdAt: now, updatedAt: now };
      const next = structuredClone(database); next.guarantors.push(guarantor);
      if (selectedContract) linkGuarantorToContract(next, selectedContract, guarantor.id);
      onChange(next); setDraft(emptyDraft); setDocument({ type: 'هوية وطنية', file: null }); onMessage('تم حفظ بيانات الضامن وربطه بالعقد');
    } catch (error) { onMessage(error instanceof Error ? error.message : 'تعذر حفظ بيانات الضامن'); } finally { setBusy(false); }
  };
  const linkExisting = () => {
    if (!selectedContract || !selectedGuarantor) return onMessage('اختر العقد والضامن أولًا');
    try { const next = structuredClone(database); linkGuarantorToContract(next, selectedContract, selectedGuarantor); onChange(next); onMessage('تم ربط الضامن بالعقد'); } catch (error) { onMessage(error instanceof Error ? error.message : 'تعذر ربط الضامن'); }
  };
  const remind = (contractId: string, guarantorId: string) => {
    try { const reminder = buildGuarantorReminderMessage(database, contractId, guarantorId); window.open(`https://wa.me/${reminder.phone}?text=${encodeURIComponent(reminder.message)}`, '_blank', 'noopener,noreferrer'); } catch (error) { onMessage(error instanceof Error ? error.message : 'تعذر تجهيز التذكير'); }
  };
  const removeGuarantor = (guarantorId: string) => {
    if (!window.confirm('سيتم حذف بيانات الضامن من السجل المحلي وإلغاء روابطه. متابعة؟')) return;
    const next = structuredClone(database); next.guarantors = next.guarantors.filter((item) => item.id !== guarantorId); next.contracts.forEach((contract) => { contract.guarantorIds = (contract.guarantorIds || []).filter((id) => id !== guarantorId); contract.requiresGuarantee = contract.guarantorIds.length > 0; }); onChange(next); onMessage('تم حذف الضامن وإلغاء روابطه');
  };
  return <div className="guarantor-panel">
    <div className="admin-title"><div><h2><ShieldCheck size={20} /> الضامنين والكفلاء</h2><p className="hint">احفظ بيانات الضامن ومستنداته واربطه بالعقد لإرسال تذكير عند التأخر.</p></div></div>
    <div className="guarantor-grid">
      <form className="admin-card form-grid" onSubmit={saveGuarantor}><h3 className="full">إضافة ضامن جديد</h3><div><label htmlFor="guarantor-name">اسم الضامن *</label><input id="guarantor-name" className="field" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required /></div><div><label htmlFor="guarantor-phone">رقم الهاتف *</label><input id="guarantor-phone" className="field" inputMode="tel" placeholder="07xxxxxxxxx" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} required /></div><div><label htmlFor="guarantor-relationship">صلة الضامن بالزبون *</label><input id="guarantor-relationship" className="field" placeholder="أخ، أب، قريب..." value={draft.relationship} onChange={(e) => setDraft({ ...draft, relationship: e.target.value })} required /></div><div className="full"><label htmlFor="guarantor-address">العنوان *</label><textarea id="guarantor-address" className="field" rows={2} value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} required /></div><div><label htmlFor="guarantee-document-type">نوع مستند الضمان</label><select id="guarantee-document-type" className="field" value={document.type} onChange={(e) => setDocument({ ...document, type: e.target.value as GuaranteeDocumentType })}>{GUARANTEE_DOCUMENT_TYPES.map((type) => <option key={type}>{type}</option>)}</select></div><div><label htmlFor="guarantee-document">المستند (اختياري)</label><input id="guarantee-document" className="field" type="file" accept="image/*,.pdf" onChange={(e: ChangeEvent<HTMLInputElement>) => setDocument({ ...document, file: e.target.files?.[0] || null })} /></div><div className="full"><label htmlFor="new-guarantor-contract">ربط مباشر بعقد</label><select id="new-guarantor-contract" className="field" value={selectedContract} onChange={(e) => setSelectedContract(e.target.value)}><option value="">بدون ربط الآن</option>{database.contracts.map((contract) => <option value={contract.id} key={contract.id}>{contract.number} — {contract.productName}</option>)}</select></div><div className="full"><button className="btn btn-primary" disabled={busy}><Save size={15} /> {busy ? 'جارٍ الحفظ...' : 'حفظ الضامن'}</button></div></form>
      <div className="admin-card"><h3>ربط ضامن موجود بعقد</h3><div className="form-grid"><div><label>الضامن</label><select className="field" value={selectedGuarantor} onChange={(e) => setSelectedGuarantor(e.target.value)}><option value="">اختر ضامنًا</option>{database.guarantors.map((item) => <option value={item.id} key={item.id}>{item.name} — {item.phone}</option>)}</select></div><div><label>العقد</label><select className="field" value={selectedContract} onChange={(e) => setSelectedContract(e.target.value)}><option value="">اختر عقدًا</option>{database.contracts.map((contract) => <option value={contract.id} key={contract.id}>{contract.number} — {contract.productName}</option>)}</select></div><div className="full"><button className="btn muted-btn" type="button" onClick={linkExisting}><Plus size={15} /> ربط بالعقد</button></div></div><p className="hint">يمكن ربط أكثر من ضامن بالعقد نفسه عند الحاجة.</p></div>
    </div>
    <div className="admin-card"><h3>سجل الضامنين ({database.guarantors.length})</h3>{database.guarantors.length === 0 ? <p className="empty-state">لم تتم إضافة ضامنين بعد.</p> : <div className="guarantor-list">{database.guarantors.map((guarantor) => <article className="guarantor-row" key={guarantor.id}><div><h4>{guarantor.name}</h4><p>{guarantor.phone} · {guarantor.relationship} · {guarantor.address}</p><small>{guarantor.documents.length} مستند ضمان</small></div><div className="row-actions"><button className="btn danger" type="button" onClick={() => removeGuarantor(guarantor.id)}><Trash2 size={14} /> حذف</button></div></article>)}</div>}</div>
    <div className="admin-card"><h3>العقود والضامنون</h3>{database.contracts.filter((contract) => (contract.guarantorIds || []).length > 0).map((contract) => <div className="guarantee-contract" key={contract.id}><div><b>{contract.number}</b><span>{contract.productName} · المتبقي {money(contract.financedAmount)}</span>{guarantorsForContract(database, contract).map((guarantor) => <small key={guarantor.id}>{guarantor.name} — {guarantor.relationship} · {guarantor.documents.map((doc) => `${doc.type}: ${doc.name}`).join('، ') || 'لا توجد مستندات'}</small>)}</div>{contract.status === 'متأخر' && (contract.guarantorIds || []).map((id) => <button className="btn orange-btn" type="button" key={id} onClick={() => remind(contract.id, id)}><MessageCircle size={14} /> تذكير الضامن</button>)}</div>)}</div>
  </div>;
}
