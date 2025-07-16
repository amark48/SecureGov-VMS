import React from 'react';
import { 
  Shield, 
  AlertTriangle, 
  Eye, 
  Users, 
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';

interface SecurityOverviewProps {
  securityStats: any;
  alerts: any[];
}

export const SecurityOverview: React.FC<SecurityOverviewProps> = ({ 
  securityStats, 
  alerts 
}) => {
  const getAlertIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return { icon: XCircle, color: 'text-red-500', bg: 'bg-red-50' };
      case 'high':
        return { icon: AlertTriangle, color: 'text-orange-500', bg: 'bg-orange-50' };
      case 'medium':
        return { icon: AlertCircle, color: 'text-yellow-500', bg: 'bg-yellow-50' };
      default:
        return { icon: CheckCircle, color: 'text-blue-500', bg: 'bg-blue-50' };
    }
  };

  return (
    <div className="space-y-6">
      {/* Security Metrics */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center">
            <Shield className="w-5 h-5 mr-2 text-blue-600" />
            Security Overview
          </h2>
          <div className="flex items-center text-sm text-gray-500">
            <Clock className="w-4 h-4 mr-1" />
            Last updated: {new Date().toLocaleTimeString()}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">Active Watchlist</p>
                <p className="text-2xl font-bold text-blue-900">
                  {securityStats?.active_watchlist_entries || 0}
                </p>
              </div>
              <Eye className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-gradient-to-r from-red-50 to-red-100 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-600">Critical Threats</p>
                <p className="text-2xl font-bold text-red-900">
                  {securityStats?.critical_threats || 0}
                </p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
          </div>

          <div className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-600">Open Alerts</p>
                <p className="text-2xl font-bold text-orange-900">
                  {securityStats?.unresolved_alerts || 0}
                </p>
              </div>
              <AlertCircle className="w-8 h-8 text-orange-600" />
            </div>
          </div>

          <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">Screenings Today</p>
                <p className="text-2xl font-bold text-green-900">
                  {securityStats?.screenings_today || 0}
                </p>
              </div>
              <Users className="w-8 h-8 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Recent Security Alerts */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Security Alerts</h3>
        
        {alerts.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <p className="text-gray-500">No active security alerts</p>
            <p className="text-sm text-gray-400">All systems operating normally</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.slice(0, 5).map((alert) => {
              const { icon: Icon, color, bg } = getAlertIcon(alert.severity);
              
              return (
                <div key={alert.id} className="flex items-start space-x-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                  <div className={`p-2 rounded-full ${bg} flex-shrink-0`}>
                    <Icon className={`w-4 h-4 ${color}`} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900 capitalize">
                        {alert.type.replace('_', ' ')} - {alert.severity}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(alert.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{alert.message}</p>
                    {alert.visitor_id && (
                      <p className="text-xs text-gray-500 mt-1">
                        Visitor ID: {alert.visitor_id}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
            
            {alerts.length > 5 && (
              <div className="text-center pt-4">
                <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                  View all {alerts.length} alerts
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};