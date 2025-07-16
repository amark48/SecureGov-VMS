import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Search, 
  Filter, 
  Plus, 
  Eye, 
  Edit, 
  UserCheck,
  UserX,
  Clock,
  User,
  Building,
  Phone,
  Mail,
  MapPin,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Download,
  Upload,
  FileText,
  Shield
} from 'lucide-react';
import { useVisitors } from '../../hooks/useVisitors';
import { useAuth } from '../../hooks/useAuth';
import { LoadingButton, Loading } from '../common/Loading';
import { format } from 'date-fns';

interface VisitsListProps {
  onVisitSelected?: (visit: any) => void;
}

const VisitsList: React.FC<VisitsListProps> = ({ onVisitSelected }) => {
  const { user, hasAnyRole } = useAuth();
  const { 
    getVisits, 
    checkInVisitor, 
    checkOutVisitor, 
    updateVisit,
    loading,
    error,
    paginationData,
    clearError
  } = useVisitors();

  const [visits, setVisits] = useState<any[]>([]);
  const [filteredVisits, setFilteredVisits] = useState<any[]>([]);
  const [selectedVisit, setSelectedVisit] = useState<any>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Filters
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    facility_id: '',
    date_range: 'all',
    start_date: '',
    end_date: ''
  });
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

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

  useEffect(() => {
    loadVisits();
  }, [currentPage]);

  useEffect(() => {
    if (visits.length > 0) {
      filterVisits();
    }
  }, [visits, filters]);

  const loadVisits = async () => {
    try {
      setErrorMessage(null);
      const visitsData = await getVisits(undefined, undefined, currentPage, paginationData.limit);
      
      // If user is a host, filter to only show their visits
      if (user?.role === 'host') {
        // Filter visits where the host_profile_id matches the current user's id
        const filteredVisits = visitsData.filter(visit => visit.host_profile_id === user.id);
        setVisits(filteredVisits);
      } else {
        setVisits(visitsData);
      }
      
      setFilteredVisits(visitsData);
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to load visits');
      console.error('Failed to load visits:', error);
    }
  };

  const filterVisits = () => {
    let filtered = visits;

    // Search filter
    if (filters.search) {
      filtered = filtered.filter(visit => 
        visit.first_name?.toLowerCase().includes(filters.search.toLowerCase()) ||
        visit.last_name?.toLowerCase().includes(filters.search.toLowerCase()) ||
        visit.company?.toLowerCase().includes(filters.search.toLowerCase()) ||
        visit.purpose?.toLowerCase().includes(filters.search.toLowerCase()) ||
        visit.host_name?.toLowerCase().includes(filters.search.toLowerCase())
      );
    }

    // Status filter
    if (filters.status) {
      filtered = filtered.filter(visit => visit.status === filters.status);
    }

    // Date range filter
    if (filters.date_range !== 'all') {
      const now = new Date();
      let startDate: Date;
      
      switch (filters.date_range) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          filtered = filtered.filter(visit => 
            new Date(visit.scheduled_date) >= startDate
          );
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          filtered = filtered.filter(visit => 
            new Date(visit.scheduled_date) >= startDate
          );
          break;
        case 'month':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          filtered = filtered.filter(visit => 
            new Date(visit.scheduled_date) >= startDate
          );
          break;
        case 'custom':
          if (filters.start_date) {
            filtered = filtered.filter(visit => 
              new Date(visit.scheduled_date) >= new Date(filters.start_date)
            );
          }
          if (filters.end_date) {
            filtered = filtered.filter(visit => 
              new Date(visit.scheduled_date) <= new Date(filters.end_date)
            );
          }
          break;
      }
    }

    setFilteredVisits(filtered);
  };

  const handleCheckIn = async (visit: any) => {
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const updatedVisit = await checkInVisitor(visit.id, 'Main Entrance');
      setVisits(prev => prev.map(v => v.id === visit.id ? { ...v, ...updatedVisit } : v));
      setSuccessMessage(`${visit.first_name} ${visit.last_name} checked in successfully`);
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to check in visitor');
      console.error('Failed to check in visitor:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCheckOut = async (visit: any) => {
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const updatedVisit = await checkOutVisitor(visit.id, 'Main Entrance');
      setVisits(prev => prev.map(v => v.id === visit.id ? { ...v, ...updatedVisit } : v));
      setSuccessMessage(`${visit.first_name} ${visit.last_name} checked out successfully`);
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to check out visitor');
      console.error('Failed to check out visitor:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleVisitClick = (visit: any) => {
    setSelectedVisit(visit);
    setShowDetails(true);
    if (onVisitSelected) {
      onVisitSelected(visit);
    }
  };

  const handleExportVisits = () => {
    // This would be implemented to call an API endpoint that returns a CSV/Excel file
    alert('Export functionality would be implemented here');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'checked_in':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'checked_out':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'pre_registered':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'denied':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'checked_in':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'checked_out':
        return <UserX className="w-4 h-4 text-gray-600" />;
      case 'pre_registered':
        return <Clock className="w-4 h-4 text-blue-600" />;
      case 'cancelled':
      case 'denied':
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-600" />;
    }
  };

  const canCheckIn = (visit: any) => {
    return visit.status === 'pre_registered' && hasAnyRole(['admin', 'security', 'reception']);
  };

  const canCheckOut = (visit: any) => {
    return visit.status === 'checked_in' && hasAnyRole(['admin', 'security', 'reception']);
  };

  if (showDetails && selectedVisit) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => {
                  setShowDetails(false);
                  setSelectedVisit(null);
                }}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Visit Details</h1>
                <p className="text-gray-500">
                  {selectedVisit.first_name} {selectedVisit.last_name} • {format(new Date(selectedVisit.scheduled_date), 'EEEE, MMMM d, yyyy')}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {getStatusIcon(selectedVisit.status)}
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(selectedVisit.status)}`}>
                {selectedVisit.status.replace('_', ' ').toUpperCase()}
              </span>
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

        {/* Visit Details */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Visitor Information */}
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Visitor Information</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Name</label>
                    <p className="text-gray-900">{selectedVisit.first_name} {selectedVisit.last_name}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Company</label>
                    <p className="text-gray-900">{selectedVisit.company || 'Not provided'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email</label>
                    <p className="text-gray-900">{selectedVisit.email || 'Not provided'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Phone</label>
                    <p className="text-gray-900">{selectedVisit.phone || 'Not provided'}</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Visit Details</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Purpose</label>
                    <p className="text-gray-900">{selectedVisit.purpose}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Scheduled Date</label>
                    <p className="text-gray-900">{format(new Date(selectedVisit.scheduled_date), 'EEEE, MMMM d, yyyy')}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Scheduled Time</label>
                    <p className="text-gray-900">
                      {selectedVisit.scheduled_start_time 
                        ? `${selectedVisit.scheduled_start_time}${selectedVisit.scheduled_end_time ? ` - ${selectedVisit.scheduled_end_time}` : ''}`
                        : 'All day'
                      }
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Visitor Count</label>
                    <p className="text-gray-900">{selectedVisit.visitor_count || 1}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Host and Facility Information */}
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Host Information</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Host</label>
                    <p className="text-gray-900">{selectedVisit.host_name || 'Not assigned'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Department</label>
                    <p className="text-gray-900">{selectedVisit.host_department || 'Not specified'}</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Facility Information</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Facility</label>
                    <p className="text-gray-900">{selectedVisit.facility_name}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Escort Required</label>
                    <p className="text-gray-900">{selectedVisit.escort_required ? 'Yes' : 'No'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Security Approval</label>
                    <p className="text-gray-900">{selectedVisit.security_approval_required ? 'Required' : 'Not required'}</p>
                  </div>
                </div>
              </div>

              {/* Check-in/out Information */}
              {(selectedVisit.actual_check_in || selectedVisit.actual_check_out) && (
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Activity Log</h3>
                  <div className="space-y-3">
                    {selectedVisit.actual_check_in && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Checked In</label>
                        <p className="text-gray-900">
                          {format(new Date(selectedVisit.actual_check_in), 'MMM d, yyyy \'at\' HH:mm')}
                          {selectedVisit.check_in_location && ` at ${selectedVisit.check_in_location}`}
                        </p>
                      </div>
                    )}
                    {selectedVisit.actual_check_out && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Checked Out</label>
                        <p className="text-gray-900">
                          {format(new Date(selectedVisit.actual_check_out), 'MMM d, yyyy \'at\' HH:mm')}
                          {selectedVisit.check_out_location && ` at ${selectedVisit.check_out_location}`}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-500">
                Created: {format(new Date(selectedVisit.created_at), 'MMM d, yyyy \'at\' HH:mm')}
              </div>
              <div className="flex items-center space-x-3">
                {canCheckIn(selectedVisit) && (
                  <LoadingButton
                    loading={isProcessing}
                    variant="primary"
                    size="sm"
                    onClick={() => handleCheckIn(selectedVisit)}
                  >
                    <UserCheck className="w-4 h-4 mr-2" />
                    Check In
                  </LoadingButton>
                )}
                
                {canCheckOut(selectedVisit) && (
                  <LoadingButton
                    loading={isProcessing}
                    variant="secondary"
                    size="sm"
                    onClick={() => handleCheckOut(selectedVisit)}
                  >
                    <UserX className="w-4 h-4 mr-2" />
                    Check Out
                  </LoadingButton>
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
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">All Visits</h1>
            <p className="text-indigo-100">
              {user?.role === 'host' 
                ? 'View and manage your visitor visits'
                : 'Comprehensive visit management and history across all facilities'}
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{paginationData.total.toLocaleString()}</div>
            <div className="text-indigo-200 text-sm">Total Visits</div>
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
        <div className="space-y-4">
          {/* Search and Quick Filters */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
            <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 flex-1">
              {/* Search */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search visits..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              {/* Status Filter */}
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <select
                  value={filters.status}
                  onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                  className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 appearance-none bg-white"
                >
                  <option value="">All Status</option>
                  <option value="pre_registered">Pre-registered</option>
                  <option value="checked_in">Checked In</option>
                  <option value="checked_out">Checked Out</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="denied">Denied</option>
                </select>
              </div>

              {/* Date Range Filter */}
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <select
                  value={filters.date_range}
                  onChange={(e) => setFilters(prev => ({ ...prev, date_range: e.target.value }))}
                  className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 appearance-none bg-white"
                >
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                  <option value="custom">Custom Range</option>
                </select>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={loadVisits}
                disabled={loading}
                className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              
              <button 
                onClick={handleExportVisits}
                className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </button>
            </div>
          </div>

          {/* Custom Date Range */}
          {filters.date_range === 'custom' && (
            <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
              <div className="flex items-center space-x-2">
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
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pre-registered</p>
              <p className="text-2xl font-bold text-blue-600">
                {filteredVisits.filter(v => v.status === 'pre_registered').length}
              </p>
            </div>
            <Clock className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Checked In</p>
              <p className="text-2xl font-bold text-green-600">
                {filteredVisits.filter(v => v.status === 'checked_in').length}
              </p>
            </div>
            <UserCheck className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Checked Out</p>
              <p className="text-2xl font-bold text-gray-600">
                {filteredVisits.filter(v => v.status === 'checked_out').length}
              </p>
            </div>
            <UserX className="w-8 h-8 text-gray-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Cancelled</p>
              <p className="text-2xl font-bold text-orange-600">
                {filteredVisits.filter(v => v.status === 'cancelled').length}
              </p>
            </div>
            <XCircle className="w-8 h-8 text-orange-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Denied</p>
              <p className="text-2xl font-bold text-red-600">
                {filteredVisits.filter(v => v.status === 'denied').length}
              </p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
        </div>
      </div>

      {/* Visits List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Visits ({filteredVisits.length})
          </h2>
        </div>

        {loading && visits.length === 0 ? (
          <Loading message="Loading visits..." />
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredVisits.length === 0 ? (
              <div className="p-12 text-center">
                <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">No visits found</p>
                <p className="text-gray-400 text-sm">
                  {filters.search || filters.status || filters.date_range !== 'all'
                    ? 'Try adjusting your search or filter criteria'
                    : 'No visits have been scheduled yet'
                  }
                </p>
              </div>
            ) : (
              filteredVisits.map((visit) => (
                <div 
                  key={visit.id} 
                  className="p-6 hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => handleVisitClick(visit)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 flex-1">
                      <div className="w-12 h-12 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                        {visit.first_name?.[0]}{visit.last_name?.[0]}
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-lg font-medium text-gray-900">
                            {visit.first_name} {visit.last_name}
                          </h3>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(visit.status)}`}>
                            {getStatusIcon(visit.status)}
                            <span className="ml-1 capitalize">{visit.status.replace('_', ' ')}</span>
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm text-gray-600">
                          <div className="flex items-center">
                            <Building className="w-4 h-4 mr-2 text-gray-400" />
                            <span>{visit.company || 'No company'}</span>
                          </div>
                          <div className="flex items-center">
                            <User className="w-4 h-4 mr-2 text-gray-400" />
                            <span>Host: {visit.host_name || 'Not assigned'}</span>
                          </div>
                          <div className="flex items-center">
                            <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                            <span>{format(new Date(visit.scheduled_date), 'MMM d, yyyy')}</span>
                          </div>
                          <div className="flex items-center">
                            <Clock className="w-4 h-4 mr-2 text-gray-400" />
                            <span>
                              {visit.scheduled_start_time || 'All day'}
                            </span>
                          </div>
                        </div>
                        
                        <div className="mt-2">
                          <p className="text-sm text-gray-600">
                            <strong>Purpose:</strong> {visit.purpose}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 ml-4">
                      {canCheckIn(visit) && (
                        <LoadingButton
                          loading={isProcessing}
                          variant="primary"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCheckIn(visit);
                          }}
                        >
                          <UserCheck className="w-4 h-4 mr-1" />
                          Check In
                        </LoadingButton>
                      )}
                      
                      {canCheckOut(visit) && (
                        <LoadingButton
                          loading={isProcessing}
                          variant="secondary"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCheckOut(visit);
                          }}
                        >
                          <UserX className="w-4 h-4 mr-1" />
                          Check Out
                        </LoadingButton>
                      )}

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleVisitClick(visit);
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
                Showing {((currentPage - 1) * paginationData.limit) + 1} to {Math.min(currentPage * paginationData.limit, paginationData.total)} of {paginationData.total} visits
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
    </div>
  );
};

export default VisitsList;