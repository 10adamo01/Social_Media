// =====================================================================
// Ustawienia rankingu minigry (Supabase)
// Wpisz tu dane z Supabase: Project Settings → API (albo Data API / API Keys).
// Klucz "anon" / "publishable" jest publiczny z założenia – ranking chronią
// reguły w bazie (plik supabase.sql). NIGDY nie wpisuj tu klucza "service_role" / "secret"!
// Dopóki pola są puste, gra działa w trybie treningu (bez rankingu).
// =====================================================================
window.ZAWLOX_CONFIG = {
    supabaseUrl: 'https://ctadqyemlotgxafzosdg.supabase.co',
    supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0YWRxeWVtbG90Z3hhZnpvc2RnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5MTIzOTQsImV4cCI6MjEwNzQ4ODM5NH0.jCslhvfEB1W5aZ54p-IHYJZGWjrhHMJts4CoU8cNtFc'
};
