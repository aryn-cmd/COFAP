import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  // Surfaces in the browser console on any deployment (Vercel preview,
  // production, or local) where these env vars weren't actually set —
  // the previous behavior was a silently broken client and an infinite
  // "Loading your week" splash screen.
  console.error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. ' +
    'Set them in Vercel > Project Settings > Environment Variables for every ' +
    'environment you deploy (Production, Preview, Development), then redeploy.'
  );
}

export const supabase = createClient(url, key);
