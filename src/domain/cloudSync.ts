import { normalizeDatabase } from './store';
import type { Database, DeletedRecord, DeviceSession, SecurityEvent, WorkspaceRole } from './types';

export type CloudSyncConfig = { url: string; anonKey: string; workspaceId: string };
export type CloudSyncStatus = 'disabled' | 'offline' | 'syncing' | 'synced' | 'error';
export type CloudUser = { id: string; email?: string };
export type PublicLookup = { customerName: string; contracts: Array<{ number: string; productName: string; status: string; financedAmount: number; schedule: Array<{ number: number; dueDate: string; amount: number; paidAmount: number }> }> };
export type PublicContractVerification = { number: string; productName: string; status: string; financedAmount: number; months: number; startDate: string };
export type SecurityContext = { role: WorkspaceRole; devices: DeviceSession[]; events: SecurityEvent[] };

function cloudPayload(database: Database): Database {
  return { ...database, products: database.products.map((product) => ({ ...product, images: [] })) };
}

function mergeById<T extends { id: string }>(local: T[], cloud: T[]): T[] { const merged = new Map<string, T>(); for (const item of local) merged.set(item.id, item); for (const item of cloud) if (!merged.has(item.id)) merged.set(item.id, item); return [...merged.values()]; }
export function mergeCloudDatabases(local: Database, cloud: Database): Database { const safeLocal = normalizeDatabase(local); const safeCloud = normalizeDatabase(cloud); return { ...safeCloud, customers: mergeById(safeLocal.customers, safeCloud.customers), products: mergeById(safeLocal.products, safeCloud.products), contracts: mergeById(safeLocal.contracts, safeCloud.contracts), payments: mergeById(safeLocal.payments, safeCloud.payments), activities: mergeById(safeLocal.activities, safeCloud.activities).slice(0, 500), trash: safeCloud.trash.length ? safeCloud.trash : safeLocal.trash, guarantors: mergeById(safeLocal.guarantors, safeCloud.guarantors), settings: safeLocal.settings }; }

type SupabaseSession = { user: { id: string; email?: string } } | null;
type SupabaseClient = {
  auth: {
    getUser: () => Promise<{ data: { user: { id: string; email?: string } | null } }>;
    getSession: () => Promise<{ data: { session: SupabaseSession } }>;
    signInWithPassword: (credentials: { email: string; password: string }) => Promise<{ data: { user: { id: string; email?: string } | null }; error: Error | null }>;
    signInWithOtp: (options: { email: string; options: { emailRedirectTo: string; shouldCreateUser: boolean } }) => Promise<{ error: Error | null }>;
    verifyOtp: (options: { email: string; token: string; type: 'email' }) => Promise<{ data: { user: { id: string; email?: string } | null }; error: Error | null }>;
    signInWithOAuth: (options: { provider: 'github' | 'google'; options: { redirectTo: string } }) => Promise<{ error: Error | null }>;
    signOut: () => Promise<{ error: Error | null }>;
  };
  from: (table: string) => {
    select: (columns: string) => { eq: (column: string, value: string) => { maybeSingle: () => Promise<{ data: { id: string; revision: number; payload: Database } | null; error: Error | null }> } };
    upsert: (row: Record<string, unknown>, options: { onConflict: string }) => Promise<{ error: Error | null }>;
  };
  rpc: (functionName: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }>;
};

export function getOAuthRedirectUrl(origin: string, basePath = '/', configuredRedirect?: string): string {
  const configured = configuredRedirect?.trim();
  if (configured) return new URL(configured).toString();
  const normalizedOrigin = origin.endsWith('/') ? origin : `${origin}/`;
  const normalizedPath = basePath.startsWith('/') ? basePath : `/${basePath}`;
  return new URL(normalizedPath, normalizedOrigin).toString();
}

function configFromEnv(): CloudSyncConfig | null {
  const env = import.meta.env as Record<string, string | undefined>;
  const url = env.VITE_SUPABASE_URL?.trim();
  const anonKey = env.VITE_SUPABASE_ANON_KEY?.trim();
  const workspaceId = env.VITE_SUPABASE_WORKSPACE_ID?.trim();
  return url && anonKey && workspaceId ? { url, anonKey, workspaceId } : null;
}

let clientPromise: Promise<SupabaseClient | null> | null = null;
let lastPulledRevision: number | null = null;
let cloudPushQueue: Promise<unknown> = Promise.resolve();
export function serializeCloudPush<T>(operation: () => Promise<T>): Promise<T> { const next = cloudPushQueue.then(operation); cloudPushQueue = next.catch(() => undefined); return next; }
export function createLatestWriteQueue<T>(persist: (value: T) => Promise<void>) {
  let latest: T | undefined;
  let scheduled = false;
  let waiters: Array<{ resolve: () => void; reject: (error: unknown) => void }> = [];
  const run = async () => {
    scheduled = false;
    if (latest === undefined) return;
    const value = latest;
    latest = undefined;
    try {
      await persist(value);
      const current = waiters;
      waiters = [];
      current.forEach(({ resolve }) => resolve());
    } catch (error) {
      const current = waiters;
      waiters = [];
      current.forEach(({ reject }) => reject(error));
    }
    if (latest !== undefined && !scheduled) {
      scheduled = true;
      void Promise.resolve().then(run);
    }
  };
  return (value: T) => new Promise<void>((resolve, reject) => {
    latest = value;
    waiters.push({ resolve, reject });
    if (!scheduled) {
      scheduled = true;
      void Promise.resolve().then(run);
    }
  });
}
async function getClient(): Promise<SupabaseClient | null> {
  if (!configFromEnv()) return null;
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) => {
      const config = configFromEnv()!;
      return createClient(config.url, config.anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) as unknown as SupabaseClient;
    }).catch(() => null);
  }
  return clientPromise;
}

export function cloudSyncConfigured() { return Boolean(configFromEnv()); }

export async function pullPublicProducts(): Promise<Database['products']> { const config = configFromEnv(); const client = await getClient(); if (!config || !client || !navigator.onLine) return []; const { data, error } = await client.rpc('aqsaty_public_products', { target_workspace: config.workspaceId }); if (error || !Array.isArray(data)) return []; return data as Database['products']; }
export async function lookupPublicCustomer(phone: string): Promise<PublicLookup | null> { const config = configFromEnv(); const client = await getClient(); if (!config || !client || !navigator.onLine) return null; const { data, error } = await client.rpc('aqsaty_public_lookup_phone', { target_workspace: config.workspaceId, target_phone: phone }); return error || !data ? null : data as PublicLookup; }
export async function verifyPublicContract(contractNumber: string): Promise<PublicContractVerification | null> { const config = configFromEnv(); const client = await getClient(); if (!config || !client || !navigator.onLine) return null; const { data, error } = await client.rpc('aqsaty_public_verify_contract', { target_workspace: config.workspaceId, target_number: contractNumber }); return error || !data ? null : data as PublicContractVerification; }

export async function getCloudUser(): Promise<CloudUser | null> {
  const client = await getClient();
  if (!client) return null;
  const { data } = await client.auth.getUser();
  return data.user;
}

export async function waitForCloudUser(timeoutMs = 10000): Promise<CloudUser | null> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const user = await getCloudUser();
    if (user) return user;
    await new Promise((resolve) => window.setTimeout(resolve, 250));
  }
  return null;
}

export async function signInCloud(email: string, password: string): Promise<CloudUser> {
  const client = await getClient();
  if (!client) throw new Error('المزامنة السحابية غير مهيأة');
  const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password });
  if (error || !data.user) throw error || new Error('تعذر تسجيل الدخول السحابي');
  return data.user;
}

export async function sendEmailOtp(email: string): Promise<void> {
  const client = await getClient();
  if (!client) throw new Error('المزامنة السحابية غير مهيأة');
  const { error } = await client.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: getOAuthRedirectUrl(window.location.origin, import.meta.env.BASE_URL, import.meta.env.VITE_SUPABASE_REDIRECT_URL), shouldCreateUser: false } });
  if (error) throw error;
}

export async function verifyEmailOtp(email: string, token: string): Promise<CloudUser> {
  const client = await getClient();
  if (!client) throw new Error('المزامنة السحابية غير مهيأة');
  const { data, error } = await client.auth.verifyOtp({ email: email.trim(), token: token.trim(), type: 'email' });
  if (error || !data.user) throw error || new Error('رمز التحقق غير صحيح أو منتهي');
  return data.user;
}

export async function signInWithGitHub(): Promise<void> {
  const client = await getClient();
  if (!client) throw new Error('المزامنة السحابية غير مهيأة');
  const redirectTo = getOAuthRedirectUrl(window.location.origin, import.meta.env.BASE_URL, import.meta.env.VITE_SUPABASE_REDIRECT_URL);
  const { error } = await client.auth.signInWithOAuth({ provider: 'github', options: { redirectTo } });
  if (error) throw error;
}

export async function signInWithGoogle(): Promise<void> {
  const client = await getClient();
  if (!client) throw new Error('المزامنة السحابية غير مهيأة');
  const redirectTo = getOAuthRedirectUrl(window.location.origin, import.meta.env.BASE_URL, import.meta.env.VITE_SUPABASE_REDIRECT_URL);
  const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
  if (error) throw error;
}

export async function signOutCloud(): Promise<void> {
  const client = await getClient();
  if (!client) return;
  const { error } = await client.auth.signOut();
  if (error) throw error;
  lastPulledRevision = null;
}

export async function pullCloudDatabase(): Promise<Database | null> {
  const config = configFromEnv();
  const client = await getClient();
  if (!config || !client || !navigator.onLine) return null;
  const user = await getCloudUser();
  if (!user) return null;
  const { data, error } = await client.from('aqsaty_records').select('id,revision,payload').eq('workspace_id', config.workspaceId).maybeSingle();
  if (error) throw error;
  lastPulledRevision = data?.revision ?? null;
  return data?.payload ? normalizeDatabase(data.payload) : null;
}

async function pushCloudDatabaseNow(database: Database): Promise<void> {
  const config = configFromEnv();
  const client = await getClient();
  if (!config || !client || !navigator.onLine) return;
  const { data: userData } = await client.auth.getUser();
  if (!userData.user) return;
  const { data: current, error: readError } = await client.from('aqsaty_records').select('id,revision,payload').eq('workspace_id', config.workspaceId).maybeSingle();
  if (readError) throw readError;
  if (lastPulledRevision !== null && current && current.revision !== lastPulledRevision) throw new Error('حدث تعارض: تغيّرت البيانات على جهاز آخر. اسحب آخر نسخة ثم راجع التعديلات قبل الحفظ.');
  const { error } = await client.from('aqsaty_records').upsert({ workspace_id: config.workspaceId, payload: cloudPayload(database), updated_by: userData.user.id }, { onConflict: 'workspace_id' });
  if (error) throw error;
  lastPulledRevision = current ? current.revision + 1 : 1;
}

async function pushCloudDatabaseWithRecovery(database: Database): Promise<void> {
  if (lastPulledRevision === null) {
    const cloud = await pullCloudDatabase();
    if (cloud) database = mergeCloudDatabases(database, cloud);
  }
  try {
    await pushCloudDatabaseNow(database);
  } catch (error) {
    if (!(error instanceof Error) || !error.message.startsWith('حدث تعارض')) throw error;
    const cloud = await pullCloudDatabase();
    if (!cloud) throw error;
    await pushCloudDatabaseNow(mergeCloudDatabases(database, cloud));
  }
}

const latestCloudPush = createLatestWriteQueue(pushCloudDatabaseWithRecovery);
export function pushCloudDatabase(database: Database): Promise<void> { return latestCloudPush(structuredClone(database)); }

const DEVICE_KEY = 'aqsaty_device_id_v1';
const securityRpc = async <T>(name: string, args: Record<string, unknown> = {}): Promise<T | null> => {
  const client = await getClient();
  const config = configFromEnv();
  if (!client || !config || !navigator.onLine || !(await getCloudUser())) return null;
  const { data, error } = await client.rpc(name, { target_workspace: config.workspaceId, ...args });
  if (error) throw error;
  return (data ?? null) as T | null;
};

export function currentDeviceId() {
  const existing = localStorage.getItem(DEVICE_KEY);
  if (existing) return existing;
  const value = globalThis.crypto?.randomUUID?.() || `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  localStorage.setItem(DEVICE_KEY, value);
  return value;
}

export function currentDeviceMetadata() {
  return { device_id: currentDeviceId(), device_label: `${/Mobi|Android/i.test(navigator.userAgent) ? 'هاتف' : 'حاسوب'} — ${navigator.userAgent.includes('Edg/') ? 'Edge' : navigator.userAgent.includes('Chrome/') ? 'Chrome' : navigator.userAgent.includes('Firefox/') ? 'Firefox' : 'متصفح'}`, approximate_location: `${navigator.language || 'لغة غير معروفة'} · ${Intl.DateTimeFormat().resolvedOptions().timeZone || 'توقيت غير معروف'}` };
}

export async function registerCurrentDevice(): Promise<DeviceSession | null> {
  return securityRpc<DeviceSession>('aqsaty_register_device', currentDeviceMetadata());
}

export async function touchCurrentDevice(): Promise<DeviceSession | null> {
  return securityRpc<DeviceSession>('aqsaty_touch_device', { device_id: currentDeviceId() });
}

export async function getSecurityContext(): Promise<SecurityContext | null> {
  const [role, devices, events] = await Promise.all([
    securityRpc<WorkspaceRole>('aqsaty_current_role'),
    securityRpc<DeviceSession[]>('aqsaty_list_devices'),
    securityRpc<SecurityEvent[]>('aqsaty_list_security_events'),
  ]);
  if (!role && !devices && !events) return null;
  return { role: role || 'viewer', devices: (devices || []).map((device) => ({ ...device, isCurrent: device.deviceId === currentDeviceId() })), events: events || [] };
}

export async function revokeDevice(deviceId: string): Promise<boolean> {
  return Boolean(await securityRpc<boolean>('aqsaty_revoke_device', { device_id: deviceId }));
}

export async function markSecurityEventsRead(eventIds: string[]): Promise<boolean> {
  return Boolean(await securityRpc<boolean>('aqsaty_mark_security_events_read', { event_ids: eventIds }));
}

export async function listCloudTrash(): Promise<DeletedRecord[]> {
  return (await securityRpc<DeletedRecord[]>('aqsaty_list_trash')) || [];
}

export async function restoreCloudTrash(trashId: string): Promise<boolean> {
  return Boolean(await securityRpc<boolean>('aqsaty_restore_trash', { trash_id: trashId }));
}

export async function permanentlyDeleteCloudTrash(trashId: string, confirmation: string): Promise<boolean> {
  return Boolean(await securityRpc<boolean>('aqsaty_permanently_delete_trash', { trash_id: trashId, confirmation }));
}

export async function createCloudTrash(record: Omit<DeletedRecord, 'id'>): Promise<DeletedRecord | null> {
  return securityRpc<DeletedRecord>('aqsaty_create_trash', { trash_record: record });
}
