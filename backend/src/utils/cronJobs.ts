import cron from 'node-cron';
import { query } from '../config/database';
import { format } from 'date-fns';

// Logger setup
const cronJobsLogger = (message: string, data?: any) => {
  console.log(`[CronJobs] ${message}`, data ? data : '');
};

/**
 * Initialize all cron jobs
 */
export const initializeCronJobs = (): void => {
  cronJobsLogger('Initializing cron jobs');
  
  // Schedule auto-checkout job to run every hour
  cron.schedule('0 * * * *', () => {
    autoCheckoutVisitors().catch(error => {
      cronJobsLogger('Error in autoCheckoutVisitors cron job:', error);
    });
  });
  
  cronJobsLogger('Cron jobs initialized successfully');
};

/**
 * Auto-checkout visitors based on tenant settings
 */
export const autoCheckoutVisitors = async (): Promise<void> => {
  try {
    const now = new Date();
    const currentTime = format(now, 'HH:mm:00');
    cronJobsLogger(`Running auto-checkout job at ${currentTime}`);
    
    // Get all tenants with auto-checkout enabled and matching the current hour
    const tenantsResult = await query(`
      SELECT id, name, auto_checkout_time 
      FROM tenants 
      WHERE auto_checkout_enabled = true 
      AND auto_checkout_time::time(0) = $1::time(0)
    `, [currentTime]);
    
    if (tenantsResult.rows.length === 0) {
      cronJobsLogger('No tenants configured for auto-checkout at this time');
      return;
    }
    
    cronJobsLogger(`Found ${tenantsResult.rows.length} tenants for auto-checkout`);
    
    // Process each tenant
    for (const tenant of tenantsResult.rows) {
      cronJobsLogger(`Processing auto-checkout for tenant: ${tenant.name}`);
      
      // Find all checked-in visits for this tenant
      const visitsResult = await query(`
        SELECT v.id, v.visitor_id, v.host_id, v.facility_id, v.scheduled_date, 
               vis.first_name, vis.last_name
        FROM visits v
        JOIN visitors vis ON v.visitor_id = vis.id
        WHERE v.tenant_id = $1
        AND v.status = 'checked_in'
      `, [tenant.id]);
      
      if (visitsResult.rows.length === 0) {
        cronJobsLogger(`No checked-in visits found for tenant: ${tenant.name}`);
        continue;
      }
      
      cronJobsLogger(`Found ${visitsResult.rows.length} checked-in visits for tenant: ${tenant.name}`);
      
      // Auto-checkout each visit
      for (const visit of visitsResult.rows) {
        try {
          // Update visit status
          await query(`
            UPDATE visits 
            SET status = 'checked_out', 
                actual_check_out = NOW(),
                check_out_location = 'Auto Checkout',
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
          `, [visit.id]);
          
          // Deactivate any active badges
          await query(
            'UPDATE badges SET is_active = false, returned_at = NOW() WHERE visit_id = $1 AND is_active = true',
            [visit.id]
          );
          
          // Log the auto-checkout in audit trail
          await query(`
            INSERT INTO audit_logs (
              tenant_id, action, table_name, record_id, new_values, compliance_flags
            ) VALUES ($1, 'check_out', 'visits', $2, $3, $4)
          `, [
            tenant.id,
            visit.id,
            JSON.stringify({
              auto_checkout: true,
              visitor_name: `${visit.first_name} ${visit.last_name}`,
              checkout_time: new Date().toISOString()
            }),
            ['SECURITY', 'AUTOMATED']
          ]);
          
          cronJobsLogger(`Auto-checked out visit: ${visit.id} (${visit.first_name} ${visit.last_name})`);
        } catch (error) {
          cronJobsLogger(`Error auto-checking out visit ${visit.id}:`, error);
        }
      }
    }
    
    cronJobsLogger('Auto-checkout job completed successfully');
  } catch (error) {
    cronJobsLogger('Error in autoCheckoutVisitors:', error);
    throw error;
  }
};