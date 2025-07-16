import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Search, 
  Filter,
  Calendar, 
  Mail, 
  MessageSquare, 
  Bell,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  User,
  Tag
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { apiClient } from '../../services/api';
import { LoadingButton, Loading } from '../common/Loading';
import { format } from 'date-fns';
import { NotificationLog } from '../../services/notification';

export const NotificationLogs: React.FC = () => {
  const { user } = useAuth();
  const { 
    getNotificationLogs, 
    loading, 
    error, 
    paginationData, 
    clearError 
  } = useNotification();
  
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<NotificationLog | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null); 
  const [accessToken, setAccessToken] = useState<string | null>(null);
  
  // Filters
  const [filters, setFilters] = useState({
    type: '',
    event: '',
    status: '',
    start_date: '',
    end_date: ''
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
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  // Get access token for debugging
  useEffect(() => {
    const token = apiClient.getToken();
    setAccessToken(token);
  }, []);

  useEffect(() => {
    loadLogs();
  }, [currentPage, filters]);

  const loadLogs = async () => {
    try {
      setErrorMessage(null);
      const logsData = await getNotificationLogs(currentPage, 20, filters);
      setLogs(logsData);
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to load notification logs');
      console.error('Failed to load notification logs:', error);
    }
  };

  const handleLogClick = (log: NotificationLog) => {
    setSelectedLog(log);
    setShowDetails(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-600" />;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'email':
        return <Mail className="w-4 h-4 text-blue-600" />;
      case 'sms':
        return <MessageSquare className="w-4 h-4 text-green-600" />;
      case 'push':
        return <Bell className="w-4 h-4 text-purple-600" />;
      default:
        return <Bell className="w-4 h-4 text-gray-600" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'email':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'sms':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'push':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getEventName = (event: string): string => {
    const eventMap: Record<string, string> = {
      'invitation': 'Visitor Invitation',
      'approval': 'Visit Approval',
      'rejection': 'Visit Rejection',
      'check_in': 'Check-in Confirmation',
      'check_out': 'Check-out Confirmation',
      'host_notification': 'Host Notification',
      'visitor_arrived': 'Visitor Arrived',
      'security_alert': 'Security Alert'
    };
    
    return eventMap[event] || event.replace('_', ' ');
  };

  const getTypeName = (type: string): string => {
    const typeMap: Record<string, string> = {
      'email': 'Email',
      'sms': 'SMS',
      'push': 'Push Notification'
    };
    
    return typeMap[type] || type;
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
                <h1 className="text-2xl font-bold text-gray-900">Notification Details</h1>
                <p className="text-gray-500">
                  {selectedLog.template_name || getEventName(selectedLog.event)} • {format(new Date(selectedLog.created_at), 'EEEE, MMMM d, yyyy \'at\' HH:mm:ss')}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {getTypeIcon(selectedLog.type)}
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getTypeColor(selectedLog.type)}`}>
                {getTypeName(selectedLog.type)}
              </span>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(selectedLog.status)}`}>
                {getStatusIcon(selectedLog.status)}
                <span className="ml-1 uppercase">{selectedLog.status}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Notification Details */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Basic Information */}
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Notification Information</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Template</label>
                    <p className="text-gray-900">{selectedLog.template_name || 'Custom Notification'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Event</label>
                    <p className="text-gray-900">{getEventName(selectedLog.event)}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Status</label>
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(selectedLog.status)}
                      <span className="capitalize">{selectedLog.status}</span>
                    </div>
                  </div>
                  {selectedLog.sent_at && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Sent At</label>
                      <p className="text-gray-900">{format(new Date(selectedLog.sent_at), 'PPpp')}</p>
                    </div>
                  )}
                  {selectedLog.error_message && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Error Message</label>
                      <p className="text-red-600 bg-red-50 p-2 rounded-md">{selectedLog.error_message}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Recipient Information */}
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Recipient Information</h3>
                <div className="space-y-3">
                  {selectedLog.recipient_name && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Recipient</label>
                      <p className="text-gray-900">{selectedLog.recipient_name}</p>
                    </div>
                  )}
                  {selectedLog.recipient_email && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Email</label>
                      <p className="text-gray-900">{selectedLog.recipient_email}</p>
                    </div>
                  )}
                  {selectedLog.recipient_phone && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Phone</label>
                      <p className="text-gray-900">{selectedLog.recipient_phone}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Message Content */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Message Content</h3>
            
            {selectedLog.subject && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                  {selectedLog.subject}
                </div>
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Body</label>
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 whitespace-pre-wrap">
                {selectedLog.body}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">Notification Logs</h1>
            <p className="text-indigo-100">
              Track and monitor all notifications sent through the system
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{paginationData.total}</div>
            <div className="text-indigo-200 text-sm">Total Notifications</div>
          </div>
        </div>
      </div>

      {/* Success/Error Messages */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center justify-between">
          <div className="flex items-center">
            <CheckCircle className="w-5 h-5 mr-2" />
            <p className="font-medium">{successMessage}</p>
          </div>
          <button 
            onClick={() => setSuccessMessage(null)}
            className="text-green-700 hover:text-green-900"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>
      )}

      {(errorMessage || error) && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between">
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 mr-2" />
            <p className="font-medium">{errorMessage || error}</p>
          </div>
          <button 
            onClick={() => {
              setErrorMessage(null);
              clearError();
            }}
            className="text-red-700 hover:text-red-900"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Controls */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
          <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 flex-1">
            {/* Type Filter */}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <select
                value={filters.type}
                onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value }))}
                className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 appearance-none bg-white"
              >
                <option value="">All Types</option>
                <option value="email">Email</option>
                <option value="sms">SMS</option>
                <option value="push">Push Notification</option>
              </select>
            </div>

            {/* Event Filter */}
            <div className="relative">
              <select
                value={filters.event}
                onChange={(e) => setFilters(prev => ({ ...prev, event: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 appearance-none bg-white"
              >
                <option value="">All Events</option>
                <option value="invitation">Visitor Invitation</option>
                <option value="approval">Visit Approval</option>
                <option value="rejection">Visit Rejection</option>
                <option value="check_in">Check-in Confirmation</option>
                <option value="check_out">Check-out Confirmation</option>
                <option value="host_notification">Host Notification</option>
                <option value="visitor_arrived">Visitor Arrived</option>
                <option value="security_alert">Security Alert</option>
              </select>
            </div>

            {/* Status Filter */}
            <div className="relative">
              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 appearance-none bg-white"
              >
                <option value="">All Status</option>
                <option value="sent">Sent</option>
                <option value="failed">Failed</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={loadLogs}
              disabled={loading}
              className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Date Range */}
        <div className="mt-4 flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <label className="text-sm font-medium text-gray-700">From:</label>
            <input
              type="date"
              value={filters.start_date}
              onChange={(e) => setFilters(prev => ({ ...prev, start_date: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">To:</label>
            <input
              type="date"
              value={filters.end_date}
              onChange={(e) => setFilters(prev => ({ ...prev, end_date: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Notification Logs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Notification Logs ({logs.length})
          </h2>
        </div>

        {loading && logs.length === 0 ? (
          <Loading message="Loading notification logs..." />
        ) : (
          <div className="divide-y divide-gray-200">
            {logs.length === 0 ? (
              <div className="p-12 text-center">
                <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">No notification logs found</p>
                <p className="text-gray-400 text-sm">
                  {filters.type || filters.event || filters.status || filters.start_date || filters.end_date
                    ? 'Try adjusting your filter criteria'
                    : 'No notifications have been sent yet'
                  }
                </p>
              </div>
            ) : (
              logs.map((log) => (
                <div 
                  key={log.id} 
                  className="p-6 hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => handleLogClick(log)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 flex-1">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        log.type === 'email' ? 'bg-blue-100' : 
                        log.type === 'sms' ? 'bg-green-100' : 'bg-purple-100'
                      }`}>
                        {getTypeIcon(log.type)}
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-lg font-medium text-gray-900">
                            {log.template_name || getEventName(log.event)}
                          </h3>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getTypeColor(log.type)}`}>
                            {getTypeName(log.type)}
                          </span>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(log.status)}`}>
                            {getStatusIcon(log.status)}
                            <span className="ml-1 uppercase">{log.status}</span>
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                          <div className="flex items-center">
                            <Tag className="w-4 h-4 mr-2 text-gray-400" />
                            <span>Event: {getEventName(log.event)}</span>
                          </div>
                          <div className="flex items-center">
                            <User className="w-4 h-4 mr-2 text-gray-400" />
                            <span>Recipient: {log.recipient_name || log.recipient_email || log.recipient_phone || 'Unknown'}</span>
                          </div>
                          <div className="flex items-center">
                            <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                            <span>{format(new Date(log.created_at), 'MMM d, yyyy HH:mm')}</span>
                          </div>
                        </div>
                        
                        {log.subject && (
                          <div className="mt-2 text-sm text-gray-500">
                            <p className="line-clamp-1">
                              <span className="font-medium">Subject:</span> {log.subject}
                            </p>
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
                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
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
        {paginationData.pages > 1 && (
          <div className="p-6 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-500">
                Showing {((currentPage - 1) * paginationData.limit) + 1} to {Math.min(currentPage * paginationData.limit, paginationData.total)} of {paginationData.total} logs
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1 || loading}
                  className="flex items-center px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Previous
                </button>
                <span className="px-3 py-2 text-sm font-medium text-gray-900">
                  Page {currentPage} of {paginationData.pages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, paginationData.pages))}
                  disabled={currentPage === paginationData.pages || loading}
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
      
      {/* Token Debugging Display */}
      <div className="fixed bottom-2 right-2 max-w-xs bg-gray-800 text-white text-xs p-2 rounded-lg opacity-50 hover:opacity-100 transition-opacity overflow-hidden">
        <div className="font-mono overflow-x-auto whitespace-nowrap">
          <strong>Token:</strong> {accessToken ? accessToken.substring(0, 15) + '...' : 'No token'}
        </div>
      </div>
    </div>
  );
};