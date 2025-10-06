//⚙️ Configura tu Supabase
const SUPABASE_URL = "https://bufjmxwhesxsmidcctkc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1ZmpteHdoZXN4c21pZGNjdGtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk3NzA3NDYsImV4cCI6MjA3NTM0Njc0Nn0.vVdDqGBQvR_FXEkOZCQ_G4zEFT2QAe_ydbv4_UuFMvs";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);