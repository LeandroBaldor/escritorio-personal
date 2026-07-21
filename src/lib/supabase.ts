import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Data } from '../storage/model';

export type UserDataRow = { user_id: string; data: unknown; updated_at: string };
export type RemoteResult<T> = { data: T | null; error: { message: string; code?: string } | null };

export interface DataBackend {
  read(userId: string): Promise<RemoteResult<UserDataRow>>;
  insert(userId: string, data: Data): Promise<RemoteResult<UserDataRow>>;
  update(userId: string, data: Data, revision: string): Promise<RemoteResult<UserDataRow>>;
}

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
export const configurationError = !url || !key
  ? 'Falta configurar VITE_SUPABASE_URL o VITE_SUPABASE_PUBLISHABLE_KEY.'
  : undefined;

export const supabase: SupabaseClient | null = configurationError ? null : createClient(url!, key!);

export const supabaseBackend: DataBackend | null = supabase ? {
  async read(userId) {
    const result = await supabase.from('user_data').select('user_id,data,updated_at').eq('user_id', userId).maybeSingle();
    return result as RemoteResult<UserDataRow>;
  },
  async insert(userId, data) {
    const result = await supabase.from('user_data').insert({ user_id: userId, data }).select('user_id,data,updated_at').single();
    return result as RemoteResult<UserDataRow>;
  },
  async update(userId, data, revision) {
    const updatedAt = new Date(Math.max(Date.now(), Date.parse(revision) + 1)).toISOString();
    const result = await supabase.from('user_data').update({ data, updated_at: updatedAt }).eq('user_id', userId).eq('updated_at', revision).select('user_id,data,updated_at').maybeSingle();
    return result as RemoteResult<UserDataRow>;
  },
} : null;
