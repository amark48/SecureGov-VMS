import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Search, 
  Filter, 
  Download, 
  Eye, 
  Calendar,
  User,
  Shield,
  FileText,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { securityService } from '../../services/security';
import { LoadingButton, Loading } from '../common/Loading';
import { format } from 'date-fns';

interface AuditLogsListProps {
  onLogSelected?: (log: any) => void;
}

export const AuditLogsList: React.FC<AuditLogsListProps> = ({ onLogSelected }) => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<any[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [showDetails, setShowDetails] = useState(false);
  
  // Filters
  const [filters, setFilters] = useState({
    search: '',
    action: '',
    table_name: '',
    user_id: '',
    start_date: '',
    end_date: '',
    compliance_flag: ''
  });
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);
  const itemsPerPage = 50;

  useEffect(() => {
    loadAuditLogs();
  }, [currentPage, filters]);

  const loadAuditLogs = async () => {
    setLoading(true);
    try {
      const offset = (currentPage - 1) * itemsPerPage;
      const filterParams = Object.fromEntries(
        Object.entries(filters).filter(([_, value]) => value !== '')
      );
      
      const auditLogs = await securityService.getAuditLogs(itemsPerPage, offset, filterParams);
      setLogs(auditLogs);
      setFilteredLogs(auditLogs);
      
      // In a real implementation, this would come from the API response
      setTotalLogs(auditLogs.length > 0 ? 1000 : 0); // Mock total
      setTotalPages(Math.ceil(1000 / itemsPerPage));
    } catch (error) {
      console.error('Failed to load audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1); // Reset to first page when filtering
  };

  const handleExport = async (format: 'csv' | 'json') => {
    setExporting(true);
    try {
      const filterParams = Object.fromEntries(
        Object.entries(filters).filter(([_, value]) => value !== '')
      );
      
      const blob = await securityService.exportAuditLogs({ ...filterParams, format });
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `audit_logs_${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export audit logs:', error);
    } finally {
      setExporting(false);
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'login':
        return <User className="w-4 h-4 text-green-600" />;
      case 'logout':
        return <User className="w-4 h-4 text-gray-600" />;
      case 'create':
        return <CheckCircle className="w-4 h-4 text-blue-600" />;
      case 'update':
        return <FileText className="w-4 h-4 text-yellow-600" />;
      case 'delete':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'check_in':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'check_out':
        return <XCircle className="w-4 h-4 text-orange-600" />;
      default:
        return <Activity className="w-4 h-4 text-gray-600" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'login':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'logout':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'create':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'update':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'delete':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'check_in':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'check_out':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const handleLogClick = (log: any) => {
    setSelectedLog(log);
    setShowDetails(true);
    if (onLogSelected) {
      onLogSelected(log);
    }
  };

  if (showDetails && selectedLog) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => {
                  setShowDetails(false);
                  setSelectedLog(null);
                }}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Audit Log Details</h1>
                <p className="text-gray-500">
                  {format(new Date(selectedLog.timestamp), 'EEEE, MMMM d, yyyy \'at\' HH:mm:ss')}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {getActionIcon(selectedLog.action)}
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getActionColor(selectedLog.action)}`}>
                {selectedLog.action.replace('_', ' ').toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        {/* Log Details */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Basic Information */}
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Action</label>
                    <p className="text-gray-900 capitalize">{selectedLog.action.replace('_', ' ')}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Table</label>
                    <p className="text-gray-900">{selectedLog.table_name}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Record ID</label>
                    <p className="text-gray-900 font-mono text-sm">{selectedLog.record_id || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Timestamp</label>
                    <p className="text-gray-900">{format(new Date(selectedLog.timestamp), 'PPpp')}</p>
                  </div>
                </div>
              </div>

              {/* User Information */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">User Information</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">User</label>
                    <p className="text-gray-900">{selectedLog.user_name || 'System'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email</label>
                    <p className="text-gray-900">{selectedLog.user_email || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Role</label>
                    <p className="text-gray-900 capitalize">{selectedLog.user_role || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">IP Address</label>
                    <p className="text-gray-900 font-mono text-sm">{selectedLog.ip_address || 'N/A'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Technical Details */}
            <div className="space-y-6">
              {/* Compliance Flags */}
              {selectedLog.compliance_flags && selectedLog.compliance_flags.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Compliance Flags</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedLog.compliance_flags.map((flag: string, index: number) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200"
                      >
                        <Shield className="w-3 h-3 mr-1" />
                        {flag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Data Changes */}
              {selectedLog.new_values && (
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Data Changes</h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <pre className="text-sm text-gray-700 whitespace-pre-wrap overflow-auto max-h-64">
                      {JSON.stringify(selectedLog.new_values, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {/* User Agent */}
              {selectedLog.user_agent && (
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">User Agent</h3>
                  <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg break-all">
                    {selectedLog.user_agent}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">Audit Trail</h1>
            <p className="text-purple-100">
              Comprehensive system activity logs with compliance tracking
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{totalLogs.toLocaleString()}</div>
            <div className="text-purple-200 text-sm">Total Entries</div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="space-y-4">
          {/* Search and Quick Filters */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
            <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 flex-1">
              {/* Search */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search logs..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>

              {/* Action Filter */}
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <select
                  value={filters.action}
                  onChange={(e) => handleFilterChange('action', e.target.value)}
                  className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 appearance-none bg-white"
                >
                  <option value="">All Actions</option>
                  <option value="login">Login</option>
                  <option value="logout">Logout</option>
                  <option value="create">Create</option>
                  <option value="update">Update</option>
                  <option value="delete">Delete</option>
                  <option value="check_in">Check In</option>
                  <option value="check_out">Check Out</option>
                </select>
              </div>

              {/* Table Filter */}
              <div className="relative">
                <select
                  value={filters.table_name}
                  onChange={(e) => handleFilterChange('table_name', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 appearance-none bg-white"
                >
                  <option value="">All Tables</option>
                  <option value="visitors">Visitors</option>
                  <option value="visits">Visits</option>
                  <option value="profiles">Profiles</option>
                  <option value="security">Security</option>
                  <option value="facilities">Facilities</option>
                </select>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={loadAuditLogs}
                disabled={loading}
                className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              
              <LoadingButton
                loading={exporting}
                variant="secondary"
                size="sm"
                onClick={() => handleExport('csv')}
              >
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </LoadingButton>
              
              <LoadingButton
                loading={exporting}
                variant="secondary"
                size="sm"
                onClick={() => handleExport('json')}
              >
                <Download className="w-4 h-4 mr-2" />
                Export JSON
              </LoadingButton>
            </div>
          </div>

          {/* Date Range Filters */}
          <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <label className="text-sm font-medium text-gray-700">From:</label>
              <input
                type="date"
                value={filters.start_date}
                onChange={(e) => handleFilterChange('start_date', e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">To:</label>
              <input
                type="date"
                value={filters.end_date}
                onChange={(e) => handleFilterChange('end_date', e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Shield className="w-4 h-4 text-gray-400" />
              <select
                value={filters.compliance_flag}
                onChange={(e) => handleFilterChange('compliance_flag', e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 appearance-none bg-white"
              >
                <option value="">All Compliance</option>
                <option value="FICAM">FICAM</option>
                <option value="FIPS_140">FIPS 140</option>
                <option value="HIPAA">HIPAA</option>
                <option value="FERPA">FERPA</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Audit Logs List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Audit Logs ({filteredLogs.length})
          </h2>
        </div>

        {loading ? (
          <Loading message="Loading audit logs..." />
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredLogs.length === 0 ? (
              <div className="p-12 text-center">
                <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">No audit logs found</p>
                <p className="text-gray-400 text-sm">
                  Try adjusting your search or filter criteria
                </p>
              </div>
            ) : (
              filteredLogs.map((log) => (
                <div 
                  key={log.id} 
                  className="p-6 hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => handleLogClick(log)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 flex-1">
                      <div className="flex-shrink-0">
                        {getActionIcon(log.action)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-3 mb-2">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getActionColor(log.action)}`}>
                            {log.action.replace('_', ' ').toUpperCase()}
                          </span>
                          <span className="text-sm font-medium text-gray-900">
                            {log.table_name}
                          </span>
                          {log.compliance_flags && log.compliance_flags.length > 0 && (
                            <div className="flex space-x-1">
                              {log.compliance_flags.slice(0, 2).map((flag: string, index: number) => (
                                <span
                                  key={index}
                                  className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800"
                                >
                                  {flag}
                                </span>
                              ))}
                              {log.compliance_flags.length > 2 && (
                                <span className="text-xs text-gray-500">
                                  +{log.compliance_flags.length - 2} more
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                          <div className="flex items-center">
                            <User className="w-4 h-4 mr-2 text-gray-400" />
                            <span>{log.user_name || 'System'}</span>
                          </div>
                          <div className="flex items-center">
                            <Clock className="w-4 h-4 mr-2 text-gray-400" />
                            <span>{format(new Date(log.timestamp), 'MMM d, HH:mm:ss')}</span>
                          </div>
                          {log.ip_address && (
                            <div className="flex items-center">
                              <span className="text-gray-400 mr-2">IP:</span>
                              <span className="font-mono text-xs">{log.ip_address}</span>
                            </div>
                          )}
                        </div>
                        
                        {log.record_id && (
                          <div className="mt-2 text-xs text-gray-500">
                            Record ID: <span className="font-mono">{log.record_id}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleLogClick(log);
                        }}
                        className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-6 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-500">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalLogs)} of {totalLogs.toLocaleString()} logs
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="flex items-center px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Previous
                </button>
                <span className="px-3 py-2 text-sm font-medium text-gray-900">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="flex items-center px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};