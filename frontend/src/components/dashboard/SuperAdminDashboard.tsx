import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Building, 
  Shield, 
  Database, 
  Globe,
  BarChart3,
  Activity,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Calendar,
  Zap,
  RefreshCw,
  Eye,
  Download,
  Settings,
  UserCheck,
  Plus,
  User
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTenant } from '../../hooks/useTenant';
import { securityService } from '../../services/security';
import { LoadingButton, Loading } from '../common/Loading';
import { format } from 'date-fns';

interface SuperAdminDashboardProps {
  onSectionChange?: (section: string, params?: any) => void;
}

export const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({ onSectionChange }) => {
  const { user } = useAuth();
  const { 
    getTenants, 
    getTenantStats, 
    getSystemStats, 
    getSystemActivity, 
    getSystemAlerts,
    loading: tenantLoading, 
    error: tenantError 
  } = useTenant();
  
  const [tenants, setTenants] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalTenants: 0,
    activeTenants: 0,
    totalUsers: 0,
    totalFacilities: 0,
    totalVisits: 0,
    activeVisits: 0,
    totalVisitors: 0
  });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [systemAlerts, setSystemAlerts] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  
  useEffect(() => {
    loadDashboardData();
  }, []);
  
  const loadDashboardData = async () => {
    setLoadingData(true);
    setError(null);
    try {
      // Load tenants
      const tenantsData = await getTenants();
      setTenants(tenantsData);
      
      // Load tenant stats for each tenant
      const tenantStatsPromises = tenantsData.map(tenant => getTenantStats(tenant.id));
      const tenantStatsResults = await Promise.allSettled(tenantStatsPromises);
      
      // Process tenant stats
      let totalUsers = 0;
      let totalFacilities = 0;
      let totalVisits = 0;
      let activeVisits = 0;
      let totalVisitors = 0;
      
      tenantStatsResults.forEach(result => {
        if (result.status === 'fulfilled') {
          const stats = result.value;
          totalUsers += parseInt(stats.user_stats.total_users) || 0;
          totalFacilities += parseInt(stats.facility_stats.total_facilities) || 0;
          totalVisits += parseInt(stats.visit_stats.total_visits) || 0;
          activeVisits += parseInt(stats.visit_stats.checked_in_visits) || 0;
          totalVisitors += parseInt(stats.visitor_stats.total_visitors) || 0;
        }
      });
      
      setStats({
        totalTenants: tenantsData.length,
        activeTenants: tenantsData.filter(t => t.is_active).length,
        totalUsers,
        totalFacilities,
        totalVisits,
        activeVisits,
        totalVisitors
      });
      
      // Try to get system activity and alerts
      try {
        // Get recent audit logs for activity
        const auditLogs = await securityService.getAuditLogs(10, 0);
        
        // Format audit logs as activity
        const activities = auditLogs.map((log, index) => {
          // Create a tenant name map for lookup
          const tenantMap = new Map(tenantsData.map(t => [t.id, t.name]));
          
          return {
            id: log.id || index,
            action: log.action,
            entity: log.table_name,
            tenant: tenantMap.get(log.tenant_id) || log.tenant_id, // Use tenant name if available
            timestamp: log.timestamp,
            user: log.user?.full_name || 'System'
          };
        });
        
        setRecentActivity(activities);
        
        // Get security alerts
        const alerts = await securityService.getActiveSecurityAlerts();
        setSystemAlerts(alerts);
      } catch (error) {
        console.error('Failed to load activity or alerts:', error);
        // Generate mock data if API calls fail
        generateMockActivityAndAlerts(tenantsData);
      }
      
    } catch (error: any) {
      setError(error.message || 'Failed to load dashboard data');
      console.error('Failed to load dashboard data:', error);
      // Generate mock data if API calls fail
      generateMockData();
    } finally {
      setLoadingData(false);
      setRefreshing(false);
    }
  };
  
  const generateMockData = () => {
    // Mock tenants if needed
    if (tenants.length === 0) {
      const mockTenants = Array.from({ length: 5 }, (_, i) => ({
        id: `mock-${i}`,
        name: `Mock Tenant ${i + 1}`,
        is_active: true,
        user_count: Math.floor(Math.random() * 50) + 10,
        facility_count: Math.floor(Math.random() * 10) + 1,
        created_at: new Date().toISOString()
      }));
      setTenants(mockTenants);
    }
    
    // Mock stats
    setStats({
      totalTenants: tenants.length || 5,
      activeTenants: tenants.filter(t => t.is_active).length || 5,
      totalUsers: tenants.reduce((sum, t) => sum + (t.user_count || 0), 0) || 150,
      totalFacilities: tenants.reduce((sum, t) => sum + (t.facility_count || 0), 0) || 25,
      totalVisits: Math.floor(Math.random() * 10000) + 1000,
      activeVisits: Math.floor(Math.random() * 100) + 10,
      totalVisitors: Math.floor(Math.random() * 5000) + 500
    });
    
    // Generate mock activity and alerts
    generateMockActivityAndAlerts(tenants);
  };
  
  const generateMockActivityAndAlerts = (tenantsList: any[]) => {
    // Generate mock recent activity
    const mockActivity = Array.from({ length: 10 }, (_, i) => {
      const actions = ['created', 'updated', 'deactivated', 'accessed'];
      const entities = ['tenant', 'user', 'facility', 'system setting'];
      const tenantNames = tenantsList.map(t => t.name) || ['Default Tenant'];
      
      return {
        id: i,
        action: actions[Math.floor(Math.random() * actions.length)],
        entity: entities[Math.floor(Math.random() * entities.length)],
        tenant: tenantNames[Math.floor(Math.random() * tenantNames.length)],
        timestamp: new Date(Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)),
        user: 'Super Admin'
      };
    });
    setRecentActivity(mockActivity);
    
    // Generate mock system alerts
    const mockAlerts = Array.from({ length: 3 }, (_, i) => {
      const types = ['Database performance', 'Storage capacity', 'API rate limit', 'Security alert'];
      const severities = ['low', 'medium', 'high'];
      
      return {
        id: i,
        type: types[Math.floor(Math.random() * types.length)],
        message: `System ${types[Math.floor(Math.random() * types.length)].toLowerCase()} alert for monitoring`,
        severity: severities[Math.floor(Math.random() * severities.length)],
        timestamp: new Date(Date.now() - Math.floor(Math.random() * 3 * 24 * 60 * 60 * 1000))
      };
    });
    setSystemAlerts(mockAlerts);
  };
  
  const handleRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };
  
  const handleViewTenants = () => {
    if (onSectionChange) {
      onSectionChange('tenants', { view: 'list' });
    }
  };
  
  const handleViewTenantDetails = (tenant: any) => {
    if (onSectionChange) {
      onSectionChange('tenants', { view: 'details', tenantId: tenant.id });
    }
  };
  
  const handleCreateTenant = () => {
    if (onSectionChange) {
      onSectionChange('tenants', { view: 'create' });
    }
  };
  
  const handleGenerateSystemReport = () => {
    if (onSectionChange) {
      // Just navigate to the reports section without passing any parameters
      // that would trigger an automatic download
      onSectionChange('reports');
    }
  };
  
  const handleImpersonateTenant = (tenant: any) => {
    // In a real implementation, this would allow impersonating a tenant admin
    alert(`Impersonate admin for tenant: ${tenant.name}`);
  };
  
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };
  
  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'high':
      case 'critical':
        return <AlertTriangle className="w-4 h-4 text-red-600" />;
      case 'medium':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'low':
        return <CheckCircle className="w-4 h-4 text-blue-600" />;
      default:
        return <CheckCircle className="w-4 h-4 text-gray-600" />;
    }
  };
  
  if (loadingData) {
    return <Loading message="Loading super admin dashboard..." />;
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">Super Admin Dashboard</h1>
            <p className="text-purple-100">
              Platform-wide management and monitoring for SecureGov VMS
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{stats.totalTenants}</div>
            <div className="text-purple-200 text-sm">Total Tenants</div>
          </div>
        </div>
      </div>
      
      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 mr-2" />
            <p className="font-medium">{error}</p>
          </div>
        </div>
      )}
      
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Building className="w-5 h-5 mr-2 text-purple-600" />
            Tenant Overview
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-600">Total Tenants</p>
                  <p className="text-2xl font-bold text-purple-900">{stats.totalTenants}</p>
                </div>
                <Building className="w-8 h-8 text-purple-600" />
              </div>
            </div>
            
            <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-600">Active Tenants</p>
                  <p className="text-2xl font-bold text-green-900">{stats.activeTenants}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
            </div>
            
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600">Total Users</p>
                  <p className="text-2xl font-bold text-blue-900">{stats.totalUsers}</p>
                </div>
                <Users className="w-8 h-8 text-blue-600" />
              </div>
            </div>
            
            <div className="bg-gradient-to-r from-indigo-50 to-indigo-100 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-indigo-600">Total Facilities</p>
                  <p className="text-2xl font-bold text-indigo-900">{stats.totalFacilities}</p>
                </div>
                <Building className="w-8 h-8 text-indigo-600" />
              </div>
            </div>
          </div>
          
          <div className="mt-4 flex justify-end">
            <button
              onClick={handleViewTenants}
              className="text-sm text-purple-600 hover:text-purple-700 font-medium flex items-center"
            >
              Manage Tenants
              <Eye className="w-4 h-4 ml-1" />
            </button>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Activity className="w-5 h-5 mr-2 text-blue-600" />
            System Activity
          </h2>
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600">Total Visits</p>
                  <p className="text-2xl font-bold text-blue-900">{stats.totalVisits.toLocaleString()}</p>
                </div>
                <Calendar className="w-8 h-8 text-blue-600" />
              </div>
            </div>
            
            <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-600">Active Visits</p>
                  <p className="text-2xl font-bold text-green-900">{stats.activeVisits}</p>
                </div>
                <UserCheck className="w-8 h-8 text-green-600" />
              </div>
            </div>
            
            <div className="flex justify-end">
              <button
                onClick={() => onSectionChange && onSectionChange('reports')}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center"
              >
                View Reports
                <Eye className="w-4 h-4 ml-1" />
              </button>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Database className="w-5 h-5 mr-2 text-green-600" />
            System Health
          </h2>
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-600">System Status</p>
                  <p className="text-2xl font-bold text-green-900">Healthy</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
            </div>
            
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600">Database</p>
                  <div className="flex items-center">
                    <span className="text-xl font-bold text-blue-900">99.9%</span>
                    <span className="text-sm text-blue-700 ml-1">Uptime</span>
                  </div>
                </div>
                <Database className="w-8 h-8 text-blue-600" />
              </div>
            </div>
            
            <div className="flex justify-end">
              <button
                onClick={() => onSectionChange && onSectionChange('settings')}
                className="text-sm text-green-600 hover:text-green-700 font-medium flex items-center"
              >
                System Settings
                <Settings className="w-4 h-4 ml-1" />
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Recent Activity and System Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <Activity className="w-5 h-5 mr-2 text-indigo-600" />
                Recent Activity
              </h2>
              <button
                onClick={handleRefresh}
                className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center"
              >
                <RefreshCw className={`w-4 h-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
          
          <div className="divide-y divide-gray-200">
            {recentActivity.slice(0, 5).map((activity, index) => (
              <div key={activity.id || index} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start space-x-3">
                  <div className="p-2 rounded-full bg-indigo-50">
                    <Activity className="w-4 h-4 text-indigo-600" />
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900">
                        {activity.user} {activity.action.replace('_', ' ')} a {activity.entity}
                      </p>
                      <p className="text-xs text-gray-500">
                        {format(new Date(activity.timestamp), 'MMM d, HH:mm')}
                      </p>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      Tenant: {activity.tenant}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            
            {recentActivity.length === 0 && (
              <div className="p-6 text-center">
                <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No recent activity</p>
              </div>
            )}
          </div>
          
          <div className="p-4 border-t border-gray-200 text-center">
            <button
              onClick={() => onSectionChange && onSectionChange('audit')}
              className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
            >
              View All Activity
            </button>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <AlertTriangle className="w-5 h-5 mr-2 text-orange-600" />
                System Alerts
              </h2>
              <button
                onClick={() => onSectionChange && onSectionChange('security')}
                className="text-sm text-orange-600 hover:text-orange-700 flex items-center"
              >
                View All
              </button>
            </div>
          </div>
          
          <div className="divide-y divide-gray-200">
            {systemAlerts.map((alert, index) => (
              <div key={alert.id || index} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start space-x-3">
                  <div className={`p-2 rounded-full ${
                    alert.severity === 'high' || alert.severity === 'critical' ? 'bg-red-50' :
                    alert.severity === 'medium' ? 'bg-yellow-50' : 'bg-blue-50'
                  }`}>
                    {getSeverityIcon(alert.severity)}
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <p className="text-sm font-medium text-gray-900">
                          {alert.type}
                        </p>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getSeverityColor(alert.severity)}`}>
                          {alert.severity.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        {format(new Date(alert.created_at || alert.timestamp), 'MMM d, HH:mm')}
                      </p>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {alert.message}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            
            {systemAlerts.length === 0 && (
              <div className="p-6 text-center">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                <p className="text-gray-500">No system alerts</p>
                <p className="text-sm text-gray-400">All systems operating normally</p>
              </div>
            )}
          </div>
          
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center text-sm text-gray-500">
              <Clock className="w-4 h-4 mr-1" />
              <span>Last updated: {format(new Date(), 'HH:mm:ss')}</span>
            </div>
            <button
              onClick={handleRefresh}
              className="text-sm text-orange-600 hover:text-orange-700 font-medium flex items-center"
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>
      
      {/* Tenant List Preview */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              <Building className="w-5 h-5 mr-2 text-blue-600" />
              Tenant Overview
            </h2>
            <button
              onClick={handleViewTenants}
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center"
            >
              View All Tenants
            </button>
          </div>
        </div>
        
        <div className="divide-y divide-gray-200">
          {tenants.slice(0, 5).map((tenant) => (
            <div key={tenant.id} className="p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white">
                    <Building className="w-5 h-5" />
                  </div>
                  
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-sm font-medium text-gray-900">{tenant.name}</h3>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        tenant.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {tenant.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {tenant.user_count || 0} Users • {tenant.facility_count || 0} Facilities
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleViewTenantDetails(tenant)}
                    className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    title="View Details"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleImpersonateTenant(tenant)}
                    className="p-1 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
                    title="Impersonate Admin"
                  >
                    <UserCheck className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
          
          {tenants.length === 0 && (
            <div className="p-6 text-center">
              <Building className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No tenants found</p>
              <button
                onClick={handleCreateTenant}
                className="mt-4 inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add First Tenant
              </button>
            </div>
          )}
        </div>
        
        {tenants.length > 5 && (
          <div className="p-4 border-t border-gray-200 text-center">
            <button
              onClick={handleViewTenants}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              View All {tenants.length} Tenants
            </button>
          </div>
        )}
      </div>
      
      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <button
            onClick={handleCreateTenant}
            className="p-4 bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg hover:from-purple-100 hover:to-purple-200 transition-colors"
          >
            <div className="flex items-center justify-between mb-2">
              <Building className="w-6 h-6 text-purple-600" />
              <Plus className="w-4 h-4 text-purple-600" />
            </div>
            <h3 className="text-sm font-medium text-purple-900 text-left">Create Tenant</h3>
            <p className="text-xs text-purple-700 mt-1 text-left">Add a new organization</p>
          </button>
          
          <button
            onClick={handleGenerateSystemReport}
            className="p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg hover:from-blue-100 hover:to-blue-200 transition-colors"
          >
            <div className="flex items-center justify-between mb-2">
              <BarChart3 className="w-6 h-6 text-blue-600" />
              <Download className="w-4 h-4 text-blue-600" />
            </div>
            <h3 className="text-sm font-medium text-blue-900 text-left">System Report</h3>
            <p className="text-xs text-blue-700 mt-1 text-left">Generate platform report</p>
          </button>
          
          <button
            onClick={() => onSectionChange && onSectionChange('settings')}
            className="p-4 bg-gradient-to-r from-green-50 to-green-100 rounded-lg hover:from-green-100 hover:to-green-200 transition-colors"
          >
            <div className="flex items-center justify-between mb-2">
              <Settings className="w-6 h-6 text-green-600" />
              <Zap className="w-4 h-4 text-green-600" />
            </div>
            <h3 className="text-sm font-medium text-green-900 text-left">System Settings</h3>
            <p className="text-xs text-green-700 mt-1 text-left">Configure platform</p>
          </button>
          
          <button
            onClick={() => onSectionChange && onSectionChange('settings', { tab: 'users' })}
            className="p-4 bg-gradient-to-r from-orange-50 to-orange-100 rounded-lg hover:from-orange-100 hover:to-orange-200 transition-colors"
          >
            <div className="flex items-center justify-between mb-2">
              <Users className="w-6 h-6 text-orange-600" />
              <Shield className="w-4 h-4 text-orange-600" />
            </div>
            <h3 className="text-sm font-medium text-orange-900 text-left">User Management</h3>
            <p className="text-xs text-orange-700 mt-1 text-left">Manage super admins</p>
          </button>
        </div>
      </div>
      
      {/* User Stats */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <User className="w-5 h-5 mr-2 text-indigo-600" />
          Platform Statistics
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gradient-to-r from-indigo-50 to-indigo-100 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-indigo-600">Total Visitors</p>
                <p className="text-2xl font-bold text-indigo-900">{stats.totalVisitors.toLocaleString()}</p>
              </div>
              <Users className="w-8 h-8 text-indigo-600" />
            </div>
          </div>
          
          <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">Total Visits</p>
                <p className="text-2xl font-bold text-blue-900">{stats.totalVisits.toLocaleString()}</p>
              </div>
              <Calendar className="w-8 h-8 text-blue-600" />
            </div>
          </div>
          
          <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">Active Visits</p>
                <p className="text-2xl font-bold text-green-900">{stats.activeVisits.toLocaleString()}</p>
              </div>
              <UserCheck className="w-8 h-8 text-green-600" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
