import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Filter, 
  Plus, 
  Eye, 
  Edit, 
  Trash2,
  Building,
  Phone,
  Mail,
  Calendar,
  Shield,
  AlertTriangle,
  CheckCircle,
  Clock,
  User,
  Download,
  Upload,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  XCircle,
  Star
} from 'lucide-react';
import { useVisitors } from '../../hooks/useVisitors';
import { useAuth } from '../../hooks/useAuth';
import { LoadingButton, Loading } from '../common/Loading';
import { VisitorDetails } from './VisitorDetails';
import { VisitorRegistration } from './VisitorRegistration';
import { format } from 'date-fns';

interface VisitorsListProps {
  onVisitorSelected?: (visitor: any) => void;
}

export const VisitorsList: React.FC<VisitorsListProps> = ({ onVisitorSelected }) => {
  const { user, hasAnyRole } = useAuth();
  const { 
    getVisitors, 
    searchVisitors, 
    updateVisitor,
    loading,
    error,
    paginationData,
    clearError
  } = useVisitors();

  const [visitors, setVisitors] = useState<any[]>([]);
  const [filteredVisitors, setFilteredVisitors] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedVisitor, setSelectedVisitor] = useState<any>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showRegistration, setShowRegistration] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isSearching, setIsSearching] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Clear messages after 5 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  useEffect(() => {
    loadVisitors();
  }, [currentPage]);

  useEffect(() => {
    if (searchQuery) {
      handleSearch();
    } else {
      filterVisitors();
    }
  }, [visitors, searchQuery, statusFilter]);

  const loadVisitors = async () => {
    try {
      setErrorMessage(null);
      const offset = (currentPage - 1) * paginationData.limit;
      const response = await getVisitors(paginationData.limit, offset);
      if (response && Array.isArray(response)) {
        setVisitors(response);
      } else {
        // Handle case where response is not an array
        setVisitors([]);
        console.error('Expected array of visitors but got:', response);
      }
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to load visitors');
      console.error('Failed to load visitors:', error);
      // Ensure visitors is an array even on error
      setVisitors([]);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      filterVisitors();
      return;
    }

    setIsSearching(true);
    setErrorMessage(null);
    try {
      const searchResults = await searchVisitors(searchQuery);
      // Ensure searchResults is an array
      if (Array.isArray(searchResults)) {
        setFilteredVisitors(searchResults);
      } else {
        setFilteredVisitors([]);
        console.error('Expected array of search results but got:', searchResults);
      }
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to search visitors');
      console.error('Failed to search visitors:', error);
      // Ensure filteredVisitors is an array even on error
      setFilteredVisitors([]);
    } finally {
      setIsSearching(false);
    }
  };

  const filterVisitors = () => {
    // Ensure visitors is an array before filtering
    if (!Array.isArray(visitors)) {
      setFilteredVisitors([]);
      return;
    }

    let filtered = [...visitors];

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(visitor => {
        if (!visitor) return false; // Skip undefined/null visitors
        
        switch (statusFilter) {
          case 'active':
            return !visitor.is_blacklisted && visitor.background_check_status === 'approved';
          case 'pending':
            return visitor.background_check_status === 'pending';
          case 'blacklisted':
            return visitor.is_blacklisted;
          case 'frequent':
            return visitor.is_frequent_visitor;
          default:
            return true;
        }
      });
    }

    setFilteredVisitors(filtered);
  };

  const handleVisitorClick = (visitor: any) => {
    setSelectedVisitor(visitor);
    setShowDetails(true);
    if (onVisitorSelected) {
      onVisitorSelected(visitor);
    }
  };

  const handleVisitorCreated = (newVisitor: any) => {
    setVisitors(prev => [newVisitor, ...prev]);
    setShowRegistration(false);
    setSuccessMessage('Visitor created successfully');
    loadVisitors(); // Reload to get updated pagination
  };

  const handleVisitorUpdated = (updatedVisitor: any) => {
    setVisitors(prev => prev.map(v => v.id === updatedVisitor.id ? updatedVisitor : v));
    setSelectedVisitor(updatedVisitor);
    setSuccessMessage('Visitor updated successfully');
  };

  const handleExportVisitors = async () => {
    try {
      // This would be implemented to call an API endpoint that returns a CSV/Excel file
      alert('Export functionality would be implemented here');
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to export visitors');
    }
  };

  const handleImportVisitors = async () => {
    try {
      // This would be implemented to upload a CSV/Excel file
      alert('Import functionality would be implemented here');
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to import visitors');
    }
  };

  const getStatusColor = (visitor: any) => {
    if (!visitor) return 'bg-gray-100 text-gray-800 border-gray-200';
    
    if (visitor.is_blacklisted) {
      return 'bg-red-100 text-red-800 border-red-200';
    }
    if (visitor.background_check_status === 'failed') {
      return 'bg-red-100 text-red-800 border-red-200';
    }
    if (visitor.background_check_status === 'pending') {
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
    if (visitor.background_check_status === 'approved') {
      return 'bg-green-100 text-green-800 border-green-200';
    }
    return 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getStatusIcon = (visitor: any) => {
    if (!visitor) return <Clock className="w-4 h-4 text-gray-600" />;
    
    if (visitor.is_blacklisted) {
      return <AlertTriangle className="w-4 h-4 text-red-600" />;
    }
    if (visitor.background_check_status === 'failed') {
      return <AlertTriangle className="w-4 h-4 text-red-600" />;
    }
    if (visitor.background_check_status === 'pending') {
      return <Clock className="w-4 h-4 text-yellow-600" />;
    }
    if (visitor.background_check_status === 'approved') {
      return <CheckCircle className="w-4 h-4 text-green-600" />;
    }
    return <Clock className="w-4 h-4 text-gray-600" />;
  };

  const getStatusText = (visitor: any) => {
    if (!visitor) return 'Unknown';
    
    if (visitor.is_blacklisted) return 'Blacklisted';
    if (visitor.background_check_status === 'failed') return 'Check Failed';
    if (visitor.background_check_status === 'pending') return 'Pending Check';
    if (visitor.background_check_status === 'approved') return 'Approved';
    return 'Unknown';
  };

  const canManageVisitors = hasAnyRole(['admin', 'security', 'reception']);

  // Calculate active visitors count safely
  const getActiveVisitorsCount = () => {
    if (!Array.isArray(visitors)) return 0;
    return visitors.filter(v => v && !v.is_blacklisted && v.background_check_status === 'approved').length;
  };

  // Calculate pending checks count safely
  const getPendingChecksCount = () => {
    if (!Array.isArray(visitors)) return 0;
    return visitors.filter(v => v && v.background_check_status === 'pending').length;
  };

  // Calculate frequent visitors count safely
  const getFrequentVisitorsCount = () => {
    if (!Array.isArray(visitors)) return 0;
    return visitors.filter(v => v && v.is_frequent_visitor).length;
  };

  // Calculate blacklisted visitors count safely
  const getBlacklistedVisitorsCount = () => {
    if (!Array.isArray(visitors)) return 0;
    return visitors.filter(v => v && v.is_blacklisted).length;
  };

  if (showRegistration) {
    return (
      <VisitorRegistration
        onVisitorCreated={handleVisitorCreated}
        onCancel={() => setShowRegistration(false)}
      />
    );
  }

  if (showDetails && selectedVisitor) {
    return (
      <VisitorDetails
        visitor={selectedVisitor}
        onVisitorUpdated={handleVisitorUpdated}
        onBack={() => {
          setShowDetails(false);
          setSelectedVisitor(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">Visitor Management</h1>
            <p className="text-indigo-100">
              Manage visitor registrations, background checks, and access permissions
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{paginationData.total}</div>
            <div className="text-indigo-200 text-sm">Total Visitors</div>
          </div>
        </div>
      </div>

      {/* Success/Error Messages */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center justify-between">
          <div className="flex items-center">
            <CheckCircle className="w-5 h-5 mr-2" />
            <p>{successMessage}</p>
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
            <p>{errorMessage || error}</p>
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
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search visitors by name, email, or company..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              {isSearching && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
                </div>
              )}
            </div>

            {/* Status Filter */}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 appearance-none bg-white"
              >
                <option value="all">All Visitors</option>
                <option value="active">Active</option>
                <option value="pending">Pending Check</option>
                <option value="blacklisted">Blacklisted</option>
                <option value="frequent">Frequent Visitors</option>
              </select>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button 
              onClick={handleExportVisitors}
              className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </button>
            <button 
              onClick={handleImportVisitors}
              className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <Upload className="w-4 h-4 mr-2" />
              Import
            </button>
            {canManageVisitors && (
              <button
                onClick={() => setShowRegistration(true)}
                className="flex items-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Visitor
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Visitors</p>
              <p className="text-2xl font-bold text-green-600">
                {getActiveVisitorsCount()}
              </p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending Checks</p>
              <p className="text-2xl font-bold text-yellow-600">
                {getPendingChecksCount()}
              </p>
            </div>
            <Clock className="w-8 h-8 text-yellow-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Frequent Visitors</p>
              <p className="text-2xl font-bold text-blue-600">
                {getFrequentVisitorsCount()}
              </p>
            </div>
            <Users className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Security Alerts</p>
              <p className="text-2xl font-bold text-red-600">
                {getBlacklistedVisitorsCount()}
              </p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
        </div>
      </div>

      {/* Visitors List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Visitors ({Array.isArray(filteredVisitors) ? filteredVisitors.length : 0})
          </h2>
        </div>

        {loading && visitors.length === 0 ? (
          <Loading message="Loading visitors..." />
        ) : (
          <div className="divide-y divide-gray-200">
            {!Array.isArray(filteredVisitors) || filteredVisitors.length === 0 ? (
              <div className="p-12 text-center">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">No visitors found</p>
                <p className="text-gray-400 text-sm">
                  {searchQuery || statusFilter !== 'all' 
                    ? 'Try adjusting your search or filter criteria'
                    : 'Start by registering your first visitor'
                  }
                </p>
                {canManageVisitors && !searchQuery && statusFilter === 'all' && (
                  <button
                    onClick={() => setShowRegistration(true)}
                    className="mt-4 inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Register First Visitor
                  </button>
                )}
              </div>
            ) : (
              filteredVisitors.map((visitor) => (
                <div key={visitor.id} className="p-6 hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => handleVisitorClick(visitor)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 flex-1">
                      <div className="w-12 h-12 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                        {visitor.first_name?.[0]}{visitor.last_name?.[0]}
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-lg font-medium text-gray-900">
                            {visitor.first_name} {visitor.last_name}
                          </h3>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(visitor)}`}>
                            {getStatusIcon(visitor)}
                            <span className="ml-1">{getStatusText(visitor)}</span>
                          </span>
                          {visitor.is_frequent_visitor && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                              <Star className="w-3 h-3 mr-1" />
                              Frequent
                            </span>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                          <div className="flex items-center">
                            <Building className="w-4 h-4 mr-2 text-gray-400" />
                            <span>{visitor.company || 'No company'}</span>
                          </div>
                          {visitor.email && (
                            <div className="flex items-center">
                              <Mail className="w-4 h-4 mr-2 text-gray-400" />
                              <span>{visitor.email}</span>
                            </div>
                          )}
                          {visitor.phone && (
                            <div className="flex items-center">
                              <Phone className="w-4 h-4 mr-2 text-gray-400" />
                              <span>{visitor.phone}</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500">
                          <div className="flex items-center">
                            <Calendar className="w-3 h-3 mr-1" />
                            <span>Registered: {format(new Date(visitor.created_at), 'MMM d, yyyy')}</span>
                          </div>
                          {visitor.security_clearance && (
                            <div className="flex items-center">
                              <Shield className="w-3 h-3 mr-1" />
                              <span>Clearance: {visitor.security_clearance.toUpperCase()}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleVisitorClick(visitor);
                        }}
                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {canManageVisitors && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleVisitorClick(visitor);
                          }}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit Visitor"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      )}
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
                Showing {((currentPage - 1) * paginationData.limit) + 1} to {Math.min(currentPage * paginationData.limit, paginationData.total)} of {paginationData.total} visitors
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