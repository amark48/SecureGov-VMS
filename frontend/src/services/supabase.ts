import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

// Helper function to handle database errors
export const handleDatabaseError = (error: any) => {
  console.error('Database error:', error);
  
  if (error.code === 'PGRST301') {
    throw new Error('Access denied. Insufficient permissions.');
  }
  
  if (error.code === '23505') {
    throw new Error('Record already exists with this information.');
  }
  
  if (error.code === '23503') {
    throw new Error('Cannot delete record due to existing dependencies.');
  }
  
  throw new Error(error.message || 'An unexpected database error occurred.');
};

// Audit logging helper
export const logAudit = async (
  action: string,
  tableName: string,
  recordId?: string,
  oldValues?: any,
  newValues?: any
) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    await supabase.from('audit_logs').insert({
      user_id: user?.id,
      action,
      table_name: tableName,
      record_id: recordId,
      old_values: oldValues,
      new_values: newValues,
      ip_address: await getUserIP(),
      user_agent: navigator.userAgent,
      session_id: user?.id
    });
  } catch (error) {
    console.error('Failed to log audit entry:', error);
  }
};

// Get user IP address
const getUserIP = async (): Promise<string> => {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip;
  } catch {
    return 'unknown';
  }
};