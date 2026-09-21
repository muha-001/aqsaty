import { useCallback, useEffect, useMemo, useState } from 'react';
import { LogOut, RefreshCw, ShieldAlert } from 'lucide-react';
import { getSecurityContext, markSecurityEventsRead, registerCurrentDevice, revokeDevice, touchCurrentDevice, currentDeviceId, signOutCloud } from '../domain/cloudSync';
import { isNewSecurityEvent } from '../domain/securityFeatures';
import type { DeviceSession, SecurityEvent, WorkspaceRole } from '../domain/types';

export function SecurityCenter({ onMessage }: { onMessage: (message: string) => void }) {
  const [devices, setDevices] = useState<DeviceSession[]>([]);
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [role, setRole] = useState<WorkspaceRole>('viewer');
  const [busy, setBusy] = useState(false);
  const [available, setAvailable] = useState(true);
  const currentId = currentDeviceId();
  const newEvents = useMemo(() => events.filter((event) => isNewSecurityEvent(event, currentId)), [events, currentId]);

  const refresh = useCallback(async () => {
    try {
      const context = await getSecurityContext();
      if (!context) { setAvailable(false); return; }
      setAvailable(true); setDevices(context.devices); setEvents(context.events); setRole(context.role);
    } catch { setAvailable(false); onMessage('تعذر تحميل الأجهزة المتصلة حاليًا'); }
  }, [onMessage]);

  useEffect(() => {
    let active = true;
    void registerCurrentDevice().then(() => touchCurrentDevice()).then(() => refresh());
    const timer = window.setInterval(() => { if (active) void refresh(); }, 30000);
    return () => { active = false; window.clearInterval(timer); };
  }, [refresh]);

  const dismissAlerts = async () => {
    const ids = newEvents.map((event) => event.id);
    if (!ids.length) return;
    await markSecurityEventsRead(ids).catch(() => undefined);
    setEvents((current) => current.map((event) => ids.includes(event.id) ? { ...event, readAt: new Date().toISOString() } : event));
  };

  const logoutDevice = async (device: DeviceSession) => {
    if (role !== 'owner' && role !== 'manager') return onMessage('تحتاج إلى صلاحية المالك أو المدير لإلغاء جهاز');
    if (!window.confirm(`تسجيل الخروج من ${device.deviceLabel}؟`)) return;
    setBusy(true);
    try {
      if (!(await revokeDevice(device.deviceId))) throw new Error('تعذر إلغاء الجهاز');
      if (device.isCurrent) { localStorage.removeItem('aqsaty_device_id_v1'); await signOutCloud(); }
      else { setDevices((current) => current.filter((item) => item.deviceId !== device.deviceId)); onMessage('تم تسجيل الخروج من الجهاز المحدد'); }
    } catch (error) { onMessage(error instanceof Error ? error.message : 'تعذر تسجيل الخروج من الجهاز'); }
    finally { setBusy(false); }
  };

  if (!available) return <div className="security-card notice"><ShieldAlert size={18} /><span>إدارة الأجهزة متاحة بعد تفعيل Supabase وتسجيل الدخول السحابي.</span></div>;
  return <div className="security-stack">
    {newEvents.length > 0 && <div className="security-alert" role="alert"><ShieldAlert size={18} /><div><strong>تسجيل دخول جديد</strong><p>{newEvents[0].deviceLabel} · {newEvents[0].approximateLocation}</p></div><button className="btn muted-btn" onClick={dismissAlerts}>تم الاطلاع</button></div>}
    <div className="admin-title"><div><h2>الأجهزة والجلسات</h2><p className="hint">الموقع المعروض تقريبي ويعتمد على لغة الجهاز والمنطقة الزمنية.</p></div><button className="btn muted-btn" onClick={() => void refresh()} disabled={busy}><RefreshCw size={15} /> تحديث</button></div>
    <div className="device-list">{devices.length === 0 ? <p className="hint">لا توجد أجهزة نشطة.</p> : devices.map((device) => <div className={`device-row ${device.isCurrent ? 'current-device' : ''}`} key={device.id}><div><strong>{device.deviceLabel}</strong>{device.isCurrent && <span className="current-badge">هذا الجهاز</span>}<p className="contract-meta">آخر استخدام: {new Date(device.lastSeenAt).toLocaleString('ar-IQ')} · {device.approximateLocation}</p></div><button className="btn danger" onClick={() => void logoutDevice(device)} disabled={busy}><LogOut size={14} /> خروج</button></div>)}</div>
  </div>;
}
