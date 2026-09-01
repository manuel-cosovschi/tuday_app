'use client';

import { createClient } from '@supabase/supabase-js';

// La URL y la "publishable/anon key" son públicas por diseño (van en el bundle
// del cliente). La seguridad real la dan las políticas RLS en la base de datos.
// Se pueden sobrescribir por variables de entorno en Vercel si se prefiere.
const url =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://iemrjdeefsfwomogbise.supabase.co';
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'sb_publishable_Mzd_bk0RtitS13mpdKYefw_EIgPZWb1';

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
