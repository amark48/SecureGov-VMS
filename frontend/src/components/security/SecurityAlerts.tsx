import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Search, 
  Filter,
  User,
  Building,
  Calendar,
  FileText,
  RefreshCw,
  Eye,
  Check,
  X,
  LoaderCircle
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { securityService } from '../../services/security';
import { LoadingButton, Loading } from '../common/Loading';
import { format } from 'date-fns';

interface SecurityAlertsProps {
  onStatsUpdate?: () => void;
}

export const SecurityAlerts: React.FC<SecurityAlertsProps> = ({ onStatsUpdate }) => {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [filteredAlerts, setFilteredAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<any>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Filters
  const [filters, setFilters] = useState({
    search: '',
    severity: '',
    type: '',
    resolved: ''
  });

  // Clear success message after 5 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Clear error message after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    loadAlerts();
  }, []);

  useEffect(() => {
    filterAlerts();
  }, [alerts, filters]);

  const loadAlerts = async () => {
    setLoading(true);
    setError(null);
    try {
      const alertsData = await securityService.getActiveSecurityAlerts();
      setAlerts(alertsData);
    } catch (error: any) {
      setError(error.message || 'Failed to load security alerts');
      console.error('Failed to load security alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterAlerts = () => {
    let filtered = [...alerts];

    if (filters.search) {
      filtered = filtered.filter(alert => 
        alert.message?.toLowerCase().includes(filters.search.toLowerCase()) ||
        alert.type?.toLowerCase().includes(filters.search.toLowerCase())
      );
    }

    if (filters.severity) {
      filtered = filtered.filter(alert => alert.severity === filters.severity);
    }

    if (filters.type) {
      filtered = filtered.filter(alert => alert.type === filters.type);
    }

    if (filters.resolved) {
      const isResolved = filters.resolved === 'true';
      filtered = filtered.filter(alert => alert.resolved === isResolved);
    }

    setFilteredAlerts(filtered);
  };

  const handleResolveAlert = async (alertId: string, notes?: string) => {
    setLoading(true);
    setError(null);
    try {
      await securityService.resolveSecurityAlert(alertId, notes);
      setSuccessMessage('Alert resolved successfully');
      await loadAlerts();
      setShowDetails(false);
      setSelectedAlert(null);
      setResolutionNotes('');
      if (onStatsUpdate) onStatsUpdate();
    } catch (error: any) {
      setError(error.message || 'Failed to resolve alert');
      console.error('Failed to resolve alert:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
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

  const getSeverityIcon = (severity: string) => {
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

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'watchlist_match':
        return 'bg-red-100 text-red-800';
      case 'security_breach':
        return 'bg-orange-100 text-orange-800';
      case 'access_denied':
        return 'bg-yellow-100 text-yellow-800';
      case 'emergency':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleAlertClick = (alert: any) => {
    setSelectedAlert(alert);
    setShowDetails(true);
  };

  if (showDetails && selectedAlert) {
    return (
      <div className="space-y-6">
        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            <div className="flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2" />
              <p className="font-medium">{error}</p>
            </div>
          </div>
        )}

        {/* Success Message */}
        {successMessage && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
            <div className="flex items-center">
              <CheckCircle className="w-5 h-5 mr-2" />
              <p className="font-medium">{successMessage}</p>
            </div>
          </div>
        )}
        
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => {
                  setShowDetails(false);
                  setSelectedAlert(null);
                }}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Security Alert Details</h1>
                <p className="text-gray-500">
                  {format(new Date(selectedAlert.created_at), 'EEEE, MMMM d, yyyy \'at\' HH:mm:ss')}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {getSeverityIcon(selectedAlert.severity)}
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getSeverityColor(selectedAlert.severity)}`}>
                {selectedAlert.severity.toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        {/* Alert Details */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Basic Information */}
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Alert Information</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Type</label>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeColor(selectedAlert.type)}`}>
                      {selectedAlert.type.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Severity</label>
                    <div className="flex items-center space-x-2">
                      {getSeverityIcon(selectedAlert.severity)}
                      <span className="capitalize">{selectedAlert.severity}</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Message</label>
                    <p className="text-gray-900 bg-gray-50 p-3 rounded-lg">{selectedAlert.message}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Created</label>
                    <p className="text-gray-900">{format(new Date(selectedAlert.created_at), 'PPpp')}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Resolution */}
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Resolution</h3>
                {selectedAlert.resolved ? (
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2 text-green-600">
                      <CheckCircle className="w-5 h-5" />
                      <span className="font-medium">Alert Resolved</span>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Resolved By</label>
                      <p className="text-gray-900">{selectedAlert.resolved_by_name || 'Unknown'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Resolved At</label>
                      <p className="text-gray-900">
                        {selectedAlert.resolved_at ? format(new Date(selectedAlert.resolved_at), 'PPpp') : 'Unknown'}
                      </p>
                    </div>
                    {selectedAlert.resolution_notes && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Resolution Notes</label>
                        <p className="text-gray-900 bg-gray-50 p-3 rounded-lg">{selectedAlert.resolution_notes}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2 text-orange-600">
                      <Clock className="w-5 h-5" />
                      <span className="font-medium">Pending Resolution</span>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Resolution Notes (Optional)
                      </label>
                      <textarea
                        rows={4}
                        value={resolutionNotes}
                        onChange={(e) => setResolutionNotes(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        placeholder="Describe how this alert was resolved..."
                      />
                    </div>
                    
                    <LoadingButton
                      loading={loading}
                      variant="primary"
                      size="md"
                      onClick={() => handleResolveAlert(selectedAlert.id, resolutionNotes)}
                    >
                      <Check className="w-4 h-4 mr-2" />
                      Resolve Alert
                    </LoadingButton>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 mr-2" />
            <p className="font-medium">{error}</p>
          </div>
        </div>
      )}

      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          <div className="flex items-center">
            <CheckCircle className="w-5 h-5 mr-2" />
            <p className="font-medium">{successMessage}</p>
          </div>
        </div>
      )}
      
      {/* Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
        <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 flex-1">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search alerts..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>

          {/* Severity Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <select
              value={filters.severity}
              onChange={(e) => setFilters(prev => ({ ...prev, severity: e.target.value }))}
              className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 appearance-none bg-white"
            >
              <option value="">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          {/* Type Filter */}
          <div className="relative">
            <select
              value={filters.type}
              onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 appearance-none bg-white"
            >
              <option value="">All Types</option>
              <option value="watchlist_match">Watchlist Match</option>
              <option value="security_breach">Security Breach</option>
              <option value="access_denied">Access Denied</option>
              <option value="emergency">Emergency</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="relative">
            <select
              value={filters.resolved}
              onChange={(e) => setFilters(prev => ({ ...prev, resolved: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 appearance-none bg-white"
            >
              <option value="">All Status</option>
              <option value="false">Open</option>
              <option value="true">Resolved</option>
            </select>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={loadAlerts}
            disabled={loading}
            className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Alerts List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Security Alerts ({filteredAlerts.length})
          </h2>
        </div>

        {loading ? (
          <Loading message="Loading security alerts..." />
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredAlerts.length === 0 ? (
              <div className="p-12 text-center">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">No security alerts found</p>
                <p className="text-gray-400 text-sm">
                  {filters.search || filters.severity || filters.type || filters.resolved
                    ? 'Try adjusting your search or filter criteria'
                    : 'All systems operating normally'
                  }
                </p>
              </div>
            ) : (
              filteredAlerts.map((alert) => (
                <div 
                  key={alert.id} 
                  className="p-6 hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => handleAlertClick(alert)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 flex-1">
                      <div className="flex-shrink-0">
                        {getSeverityIcon(alert.severity)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-3 mb-2">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getSeverityColor(alert.severity)}`}>
                            {alert.severity.toUpperCase()}
                          </span>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeColor(alert.type)}`}>
                            {alert.type.replace('_', ' ').toUpperCase()}
                          </span>
                          {alert.resolved && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              RESOLVED
                            </span>
                          )}
                        </div>
                        
                        <p className="text-sm font-medium text-gray-900 mb-2">{alert.message}</p>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                          <div className="flex items-center">
                            <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                            <span>{format(new Date(alert.created_at), 'MMM d, HH:mm')}</span>
                          </div>
                          {alert.facility_name && (
                            <div className="flex items-center">
                              <Building className="w-4 h-4 mr-2 text-gray-400" />
                              <span>{alert.facility_name}</span>
                            </div>
                          )}
                          {alert.visitor_first_name && (
                            <div className="flex items-center">
                              <User className="w-4 h-4 mr-2 text-gray-400" />
                              <span>{alert.visitor_first_name} {alert.visitor_last_name}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 ml-4">
                      {!alert.resolved && (
                        <LoadingButton
                          loading={loading}
                          variant="primary"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleResolveAlert(alert.id);
                          }}
                        >
                          <Check className="w-4 h-4 mr-1" />
                          Resolve
                        </LoadingButton>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAlertClick(alert);
                        }}
                        className="p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};