// LOS PICHULOS - Configuración de Supabase

window.SUPABASE_URL = 'https://gmvhdifhkbfqtakddhpv.supabase.co';

window.SUPABASE_ANON_KEY = 'sb_publishable_73MZFG-I-GHBrcKZI9jq6g_TcU2qtxw';

if (window.supabase) {
    window.supabaseClient = window.supabase.createClient(
        window.SUPABASE_URL,
        window.SUPABASE_ANON_KEY
    );
} else {
    window.supabaseClient = null;
    console.error('No se cargó la librería de Supabase');
}