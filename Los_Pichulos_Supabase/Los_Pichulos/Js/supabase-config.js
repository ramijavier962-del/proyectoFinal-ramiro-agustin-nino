// Configuración pública de Supabase para Los Pichulos.
// Pegá aquí la Project URL y la anon/public key de tu proyecto.
// IMPORTANTE: nunca pegues la service_role key en el navegador.
window.SUPABASE_URL = 'PEGAR_URL_DEL_PROYECTO';
window.SUPABASE_ANON_KEY = 'PEGAR_CLAVE_ANON_PUBLIC';
if (window.supabase && window.SUPABASE_URL.startsWith('https://') && !window.SUPABASE_ANON_KEY.startsWith('PEGAR_')) {
  window.supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
} else {
  window.supabaseClient = null;
}
