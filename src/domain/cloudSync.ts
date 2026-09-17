import type { Database } from './types';

export type CloudSyncConfig = { url: string; anonKey: string; workspaceId: string };
export type CloudSyncStatus = 'disabled' | 'offline' | 'syncing' | 'synced' | 'error';
export type CloudUser = { id: string; email?: string };

type SupabaseSession = { user: { id: string; email?: string } } | null;
type SupabaseClient = {
  auth: {
    getUser: () => Promise<{ data: { user: { id: string; email?: string } | null } }>;
    getSession: () => Promise<{ data: { session: SupabaseSession } }>;
    signInWithPassword: (credentials: { email: string; password: string }) => Promise<{ data: { user: { id: string; email?: string } | null }; error: Error | null }>;
    signInWithOAuth: (options: { provider: 'github'; options: { redirectTo: string } }) => Promise<{ error: Error | null }>;
    signOut: () => Promise<{ error: Error | null }>;
  };
  from: (table: string) => {
    select: (columns: string) => { eq: (column: string, value: string) => { maybeSingle: () => Promise<{ data: { id: string; revision: number; payload: Database } | null; error: Error | null }> } };
    upsert: (row: Record<string, unknown>, options: { onConflict: string }) => Promise<{ error: Error | null }>;
  };
};

function configFromEnv(): CloudSyncConfig | null {
  const env = import.meta.env as Record<string, string | undefined>;
  const url = env.VITE_SUPABASE_URL?.trim();
  const anonKey = env.VITE_SUPABASE_ANON_KEY?.trim();
  const workspaceId = env.VITE_SUPABASE_WORKSPACE_ID?.trim();
  return url && anonKey && workspaceId ? { url, anonKey, workspaceId } : null;
}

let clientPromise: Promise<SupabaseClient | null> | null = null;
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

export async function getCloudUser(): Promise<CloudUser | null> {
  const client = await getClient();
  if (!client) return null;
  const { data } = await client.auth.getUser();
  return data.user;
}

export async function signInCloud(email: string, password: string): Promise<CloudUser> {
  const client = await getClient();
  if (!client) throw new Error('المزامنة السحابية غير مهيأة');
  const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password });
  if (error || !data.user) throw error || new Error('تعذر تسجيل الدخول السحابي');
  return data.user;
}

export async function signInWithGitHub(): Promise<void> {
  const client = await getClient();
  if (!client) throw new Error('المزامنة السحابية غير مهيأة');
  const redirectTo = `${window.location.origin}${window.location.pathname}`;
  const { error } = await client.auth.signInWithOAuth({ provider: 'github', options: { redirectTo } });
  if (error) throw error;
}

export async function signOutCloud(): Promise<void> {
  const client = await getClient();
  if (!client) return;
  const { error } = await client.auth.signOut();
  if (error) throw error;
}

export async function pullCloudDatabase(): Promise<Database | null> {
  const config = configFromEnv();
  const client = await getClient();
  if (!config || !client || !navigator.onLine) return null;
  const user = await getCloudUser();
  if (!user) return null;
  const { data, error } = await client.from('aqsaty_records').select('id,revision,payload').eq('workspace_id', config.workspaceId).maybeSingle();
  if (error) throw error;
  return data?.payload ?? null;
}

export async function pushCloudDatabase(database: Database): Promise<void> {
  const config = configFromEnv();
  const client = await getClient();
  if (!config || !client || !navigator.onLine) return;
  const { data: userData } = await client.auth.getUser();
  if (!userData.user) return;
  const { error } = await client.from('aqsaty_records').upsert({ workspace_id: config.workspaceId, payload: database, updated_by: userData.user.id }, { onConflict: 'workspace_id' });
  if (error) throw error;
}
