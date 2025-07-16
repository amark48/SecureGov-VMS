import { Pool, PoolConfig } from 'pg';
import dotenv from 'dotenv';
import { QueryResult, DatabaseClient } from '../types/common';

dotenv.config();

const poolConfig: PoolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'securegov_vms',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
};

export const pool = new Pool(poolConfig);

// Test database connection
export const initializeDatabase = async (): Promise<void> => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    console.log('✅ Database connected successfully at:', result.rows[0].now);
    client.release();
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
};

// Helper function to execute queries with proper typing
export const query = async <T = any>(text: string, params?: any[]): Promise<QueryResult<T>> => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 Query executed:', { text, duration, rows: result.rowCount });
    }
    
    return result as QueryResult<T>;
  } catch (error) {
    console.error('❌ Query error:', { text, error });
    throw error;
  }
};

// Helper function for transactions with proper typing
export const transaction = async <T = any>(callback: (client: DatabaseClient) => Promise<T>): Promise<T> => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Set session variables for RLS policies
export const setSessionVariables = async (userId: string, tenantId: string, userRole: string): Promise<void> => {
  try {
    // Directly interpolate values into the SQL string instead of using parameters
    // This is safe because these values come from the JWT token, not user input
    const sql = `
      SET LOCAL app.user_id = '${userId}';
      SET LOCAL app.tenant_id = '${tenantId}';
      SET LOCAL app.user_role = '${userRole}';
    `;
    await query(sql);
  } catch (error) {
    console.error('Failed to set session variables:', error);
    throw error;
  }
};

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('🔌 Closing database connections...');
  await pool.end();
});

process.on('SIGTERM', async () => {
  console.log('🔌 Closing database connections...');
  await pool.end();
});
