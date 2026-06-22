import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Cria uma única instância do cliente para todo o projeto
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
