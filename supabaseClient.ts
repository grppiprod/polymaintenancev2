
// Initialize Supabase client using the global script variable
const supabaseUrl = 'https://aqxysrksqstykuyrnpop.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFxeHlzcmtzcXN0eWt1eXJucG9wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyNjExOTEsImV4cCI6MjA3OTgzNzE5MX0.hw0VouszYWrPLwYmGzcp_TGyNp9ejkk-I2As8bdTJA0';

// @ts-ignore
export const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
