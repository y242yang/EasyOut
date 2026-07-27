import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// A fast remount (Fast Refresh, or quick back-and-forth navigation) can fire
// a new effect before the previous cleanup's removeChannel() has fully
// unsubscribed, leaving a stale channel with the same topic name still
// "joining"/"joined" on the client. Calling supabase.channel(topic).on(...)
// on that stale channel throws "cannot add postgres_changes callbacks after
// subscribe()". Removing any pre-existing channel with the same topic first
// makes channel creation idempotent regardless of that race.
export function freshChannel(topic: string) {
  const stale = supabase.getChannels().find((c) => c.topic === `realtime:${topic}`);
  if (stale) supabase.removeChannel(stale);
  return supabase.channel(topic);
}
