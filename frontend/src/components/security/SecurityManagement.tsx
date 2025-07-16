import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Eye, 
  AlertTriangle, 
  Plus, 
  Search, 
  Filter,
  UserX,
  CheckCircle,
  XCircle,
  Clock,
  User,
  Building,
  Phone,
  Mail,
  Calendar,
  FileText,
  Download,
  Upload,
  RefreshCw,
  Edit,
  Trash2,
  Ban,
  Settings
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { securityService } from '../../services/security';
import { LoadingButton, Loading } from '../common/Loading';
import { WatchlistManagement } from './WatchlistManagement';
import { SecurityAlerts } from './SecurityAlerts';
import { VisitorScreening } from './VisitorScreening';
import { format } from 'date-fns';

interface SecurityManagementProps {
  onSectionChange?: (section: string) => void;
}

export const SecurityManagement: React.FC<SecurityManagementProps> = ({ onSectionChange }) => {
  const { user, isSuperAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [securityStats, setSecurityStats] = useState<any>(null);
  const [recentAlerts, setRecentAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadSecurityData();
  }, []);

  const loadSecurityData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [stats, alerts] = await Promise.all([
        securityService.getSecurityStats(),
        securityService.getActiveSecurityAlerts()
      ]);
      
      setSecurityStats(stats);
      setRecentAlerts(alerts.slice(0, 5)); // Show only recent 5 alerts
    } catch (error: any) {
      setError(error.message || 'Failed to load security data');
      console.error('Failed to load security data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadSecurityData();
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Shield },
    { id: 'watchlist', label: 'Watchlist', icon: Eye },
    { id: 'alerts', label: 'Security Alerts', icon: AlertTriangle },
    { id: 'screening', label: 'Visitor Screening', icon: UserX }
  ];

  const getAlertSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getAlertIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'high':
        return <AlertTriangle className="w-4 h-4 text-orange-600" />;
      case 'medium':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'low':
        return <CheckCircle className="w-4 h-4 text-blue-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-600" />;
    }
  };

  if (loading && !securityStats) {
    return <Loading message="Loading security data..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-600 via-orange-600 to-yellow-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">Security Management</h1>
            <p className="text-red-100">
              Comprehensive security operations, watchlist management, and threat assessment
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">
              {securityStats?.unresolved_alerts || 0}
            </div>
            <div className="text-red-200 text-sm">Active Alerts</div>
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

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Watchlist Entries</p>
              <p className="text-2xl font-bold text-red-600">
                {securityStats?.active_watchlist_entries || 0}
              </p>
            </div>
            <Eye className="w-8 h-8 text-red-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Critical Threats</p>
              <p className="text-2xl font-bold text-orange-600">
                {securityStats?.critical_threats || 0}
              </p>
            </div>
            <AlertTriangle className="w-8 h-8 text-orange-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Screenings Today</p>
              <p className="text-2xl font-bold text-blue-600">
                {securityStats?.screenings_today || 0}
              </p>
            </div>
            <UserX className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Open Alerts</p>
              <p className="text-2xl font-bold text-yellow-600">
                {securityStats?.unresolved_alerts || 0}
              </p>
            </div>
            <Shield className="w-8 h-8 text-yellow-600" />
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-200 bg-gray-50">
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-2 border-b-2 font-medium text-sm flex items-center transition-all duration-200 ${
                    activeTab === tab.id
                      ? 'border-red-500 text-red-600 bg-red-50/50'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {tab.label}
                  {tab.id === 'alerts' && securityStats?.unresolved_alerts > 0 && (
                    <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-2 py-1">
                      {securityStats.unresolved_alerts}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="space-y-8">
              {/* Security Status Overview */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Security Alerts */}
                <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                      <AlertTriangle className="w-5 h-5 mr-2 text-red-600" />
                      Recent Security Alerts
                    </h3>
                    <button
                      onClick={() => setActiveTab('alerts')}
                      className="text-sm text-red-600 hover:text-red-700 font-medium"
                    >
                      View All
                    </button>
                  </div>

                  {recentAlerts.length === 0 ? (
                    <div className="text-center py-8">
                      <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                      <p className="text-gray-500">No recent security alerts</p>
                      <p className="text-sm text-gray-400">All systems operating normally</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {recentAlerts.map((alert) => (
                        <div key={alert.id} className="flex items-start space-x-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                          <div className="flex-shrink-0 mt-0.5">
                            {getAlertIcon(alert.severity)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-1">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getAlertSeverityColor(alert.severity)}`}>
                                {alert.severity.toUpperCase()}
                              </span>
                              <span className="text-xs text-gray-500">
                                {format(new Date(alert.created_at), 'MMM d, HH:mm')}
                              </span>
                            </div>
                            <p className="text-sm text-gray-900 font-medium">{alert.type.replace('_', ' ').toUpperCase()}</p>
                            <p className="text-sm text-gray-600">{alert.message}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Quick Actions */}
                <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
                    <Shield className="w-5 h-5 mr-2 text-blue-600" />
                    Quick Security Actions
                  </h3>
                  <div className="space-y-3">
                    <button 
                      onClick={() => setActiveTab('screening')}
                      className="w-full flex items-center p-4 text-left bg-gradient-to-r from-red-50 to-red-100 hover:from-red-100 hover:to-red-200 rounded-xl transition-all duration-200 group transform hover:scale-105"
                    >
                      <UserX className="w-5 h-5 text-red-600 mr-3" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Screen Visitor</p>
                        <p className="text-xs text-gray-500">Run watchlist check</p>
                      </div>
                    </button>
                    
                    <button 
                      onClick={() => setActiveTab('watchlist')}
                      className="w-full flex items-center p-4 text-left bg-gradient-to-r from-orange-50 to-orange-100 hover:from-orange-100 hover:to-orange-200 rounded-xl transition-all duration-200 group transform hover:scale-105"
                    >
                      <Eye className="w-5 h-5 text-orange-600 mr-3" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Manage Watchlist</p>
                        <p className="text-xs text-gray-500">Add or update entries</p>
                      </div>
                    </button>
                    
                    <button 
                      onClick={() => setActiveTab('alerts')}
                      className="w-full flex items-center p-4 text-left bg-gradient-to-r from-yellow-50 to-yellow-100 hover:from-yellow-100 hover:to-yellow-200 rounded-xl transition-all duration-200 group transform hover:scale-105"
                    >
                      <AlertTriangle className="w-5 h-5 text-yellow-600 mr-3" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Review Alerts</p>
                        <p className="text-xs text-gray-500">Manage security alerts</p>
                      </div>
                    </button>
                    
                    <button 
                      onClick={handleRefresh}
                      className="w-full flex items-center p-4 text-left bg-gradient-to-r from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 rounded-xl transition-all duration-200 group transform hover:scale-105"
                    >
                      <RefreshCw className={`w-5 h-5 text-blue-600 mr-3 ${refreshing ? 'animate-spin' : ''}`} />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Refresh Data</p>
                        <p className="text-xs text-gray-500">Update security status</p>
                      </div>
                    </button>
                  </div>
                </div>
              </div>

              {/* Security Metrics */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Security Metrics</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center p-4 bg-red-50 rounded-lg">
                    <div className="text-2xl font-bold text-red-600 mb-2">
                      {securityStats?.alerts_by_type?.reduce((sum: number, item: any) => sum + parseInt(item.count), 0) || 0}
                    </div>
                    <div className="text-sm text-gray-600">Total Alerts (30 days)</div>
                  </div>
                  
                  <div className="text-center p-4 bg-orange-50 rounded-lg">
                    <div className="text-2xl font-bold text-orange-600 mb-2">
                      {securityStats?.threat_level_distribution?.find((item: any) => item.threat_level === 'high')?.count || 0}
                    </div>
                    <div className="text-sm text-gray-600">High Threat Entries</div>
                  </div>
                  
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600 mb-2">
                      {securityStats?.screenings_today || 0}
                    </div>
                    <div className="text-sm text-gray-600">Screenings Today</div>
                  </div>
                </div>
                
                {/* Threat Level Distribution */}
                {securityStats?.threat_level_distribution && (
                  <div className="mt-6">
                    <h4 className="text-md font-medium text-gray-900 mb-4">Threat Level Distribution</h4>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      {securityStats.threat_level_distribution.map((item: any) => (
                        <div key={item.threat_level} className="p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                              item.threat_level === 'critical' ? 'bg-red-100 text-red-800 border-red-200' :
                              item.threat_level === 'high' ? 'bg-orange-100 text-orange-800 border-orange-200' :
                              item.threat_level === 'medium' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                              'bg-blue-100 text-blue-800 border-blue-200'
                            }`}>
                              {item.threat_level.toUpperCase()}
                            </span>
                            <span className="text-sm font-medium text-gray-900">{item.count}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div className={`h-2 rounded-full ${
                              item.threat_level === 'critical' ? 'bg-red-600' :
                              item.threat_level === 'high' ? 'bg-orange-600' :
                              item.threat_level === 'medium' ? 'bg-yellow-600' :
                              'bg-blue-600'
                            }`} style={{ 
                              width: `${Math.min(100, (parseInt(item.count) / (securityStats.active_watchlist_entries || 1)) * 100)}%` 
                            }}></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'watchlist' && (
            <WatchlistManagement onStatsUpdate={loadSecurityData} />
          )}

          {activeTab === 'alerts' && (
            <SecurityAlerts onStatsUpdate={loadSecurityData} />
          )}

          {activeTab === 'screening' && (
            <VisitorScreening onStatsUpdate={loadSecurityData} />
          )}
        </div>
      </div>
    </div>
  );
};