import React, { useState, useEffect } from 'react';
import { Eye, Plus, Search, Filter, Edit, Trash2, AlertTriangle, User, Calendar, Shield, FileText, Download, Upload, RefreshCw, ChevronLeft, ChevronRight, Ban, CheckCircle, XCircle, UserCircle as LoaderCircle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { securityService } from '../../services/security';
import { LoadingButton, Loading } from '../common/Loading';
import { format } from 'date-fns';

interface WatchlistManagementProps {
  onStatsUpdate?: () => void;
}

export const WatchlistManagement: React.FC<WatchlistManagementProps> = ({ onStatsUpdate }) => {
  const { user } = useAuth();
  const [watchlist, setWatchlist] = useState<any[]>([]);
  const [filteredWatchlist, setFilteredWatchlist] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Filters
  const [filters, setFilters] = useState({
    search: '',
    threat_level: '',
    source_agency: ''
  });
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 20;

  // Form data
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    aliases: [] as string[],
    id_numbers: [] as string[],
    reason: '',
    threat_level: 'medium',
    source_agency: '',
    expiry_date: '',
    notes: ''
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
    loadWatchlist();
  }, [currentPage]);

  useEffect(() => {
    filterWatchlist();
  }, [watchlist, filters]);

  const loadWatchlist = async () => {
    setLoading(true);
    setError(null);
    try {
      const entries = await securityService.getWatchlist();
      setWatchlist(entries);
      setTotalPages(Math.ceil(entries.length / itemsPerPage));
    } catch (error: any) {
      setError(error.message || 'Failed to load watchlist');
      console.error('Failed to load watchlist:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterWatchlist = () => {
    let filtered = [...watchlist];

    if (filters.search) {
      filtered = filtered.filter(entry => 
        entry.first_name?.toLowerCase().includes(filters.search.toLowerCase()) ||
        entry.last_name?.toLowerCase().includes(filters.search.toLowerCase()) ||
        entry.reason?.toLowerCase().includes(filters.search.toLowerCase())
      );
    }

    if (filters.threat_level) {
      filtered = filtered.filter(entry => entry.threat_level === filters.threat_level);
    }

    if (filters.source_agency) {
      filtered = filtered.filter(entry => 
        entry.source_agency?.toLowerCase().includes(filters.source_agency.toLowerCase())
      );
    }

    setFilteredWatchlist(filtered);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      if (editingEntry) {
        await securityService.updateWatchlistEntry(editingEntry.id, formData);
        setSuccessMessage('Watchlist entry updated successfully');
      } else {
        await securityService.createWatchlistEntry(formData);
        setSuccessMessage('Watchlist entry created successfully');
      }
      
      await loadWatchlist();
      resetForm();
      if (onStatsUpdate) onStatsUpdate();
    } catch (error: any) {
      setError(error.message || 'Failed to save watchlist entry');
      console.error('Failed to save watchlist entry:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      first_name: '',
      last_name: '',
      aliases: [],
      id_numbers: [],
      reason: '',
      threat_level: 'medium',
      source_agency: '',
      expiry_date: '',
      notes: ''
    });
    setEditingEntry(null);
    setShowForm(false);
  };

  const handleEdit = (entry: any) => {
    setFormData({
      first_name: entry.first_name,
      last_name: entry.last_name,
      aliases: entry.aliases || [],
      id_numbers: entry.id_numbers || [],
      reason: entry.reason,
      threat_level: entry.threat_level,
      source_agency: entry.source_agency || '',
      expiry_date: entry.expiry_date || '',
      notes: entry.notes || ''
    });
    setEditingEntry(entry);
    setShowForm(true);
  };

  const handleDeactivate = async (entryId: string) => {
    if (!confirm('Are you sure you want to deactivate this watchlist entry?')) return;
    
    setLoading(true);
    setError(null);
    try {
      await securityService.updateWatchlistEntry(entryId, { is_active: false });
      setSuccessMessage('Watchlist entry deactivated successfully');
      await loadWatchlist();
      if (onStatsUpdate) onStatsUpdate();
    } catch (error: any) {
      setError(error.message || 'Failed to deactivate entry');
      console.error('Failed to deactivate entry:', error);
    } finally {
      setLoading(false);
    }
  };

  const getThreatLevelColor = (level: string) => {
    switch (level) {
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

  const getThreatLevelIcon = (level: string) => {
    switch (level) {
      case 'critical':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'high':
        return <AlertTriangle className="w-4 h-4 text-orange-600" />;
      case 'medium':
        return <Shield className="w-4 h-4 text-yellow-600" />;
      case 'low':
        return <CheckCircle className="w-4 h-4 text-blue-600" />;
      default:
        return <Shield className="w-4 h-4 text-gray-600" />;
    }
  };

  if (showForm) {
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
        
        {/* Form Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={resetForm}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-semibold text-gray-900">
              {editingEntry ? 'Edit Watchlist Entry' : 'Add Watchlist Entry'}
            </h2>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Personal Information */}
            <div className="space-y-4">
              <h3 className="text-md font-medium text-gray-900 flex items-center">
                <User className="w-4 h-4 mr-2" />
                Personal Information
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.first_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.last_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  />
                </div>
              </div>
            </div>

            {/* Threat Assessment */}
            <div className="space-y-4">
              <h3 className="text-md font-medium text-gray-900 flex items-center">
                <AlertTriangle className="w-4 h-4 mr-2" />
                Threat Assessment
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Threat Level *
                  </label>
                  <select
                    required
                    value={formData.threat_level}
                    onChange={(e) => setFormData(prev => ({ ...prev, threat_level: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Source Agency
                  </label>
                  <input
                    type="text"
                    value={formData.source_agency}
                    onChange={(e) => setFormData(prev => ({ ...prev, source_agency: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    placeholder="FBI, DHS, Local PD, etc."
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason for Watchlist *
                </label>
                <textarea
                  required
                  rows={3}
                  value={formData.reason}
                  onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  placeholder="Describe the security concern or threat..."
                />
              </div>
            </div>

            {/* Additional Information */}
            <div className="space-y-4">
              <h3 className="text-md font-medium text-gray-900 flex items-center">
                <FileText className="w-4 h-4 mr-2" />
                Additional Information
              </h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expiry Date
                </label>
                <input
                  type="date"
                  value={formData.expiry_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, expiry_date: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Additional Notes
                </label>
                <textarea
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  placeholder="Any additional security notes or observations..."
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Cancel
              </button>
              
              <LoadingButton
                loading={loading}
                variant="danger"
                size="md"
                type="submit"
              >
                {editingEntry ? 'Update Entry' : 'Add to Watchlist'}
              </LoadingButton>
            </div>
          </form>
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
              placeholder="Search watchlist..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
            />
          </div>

          {/* Threat Level Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <select
              value={filters.threat_level}
              onChange={(e) => setFilters(prev => ({ ...prev, threat_level: e.target.value }))}
              className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 appearance-none bg-white"
            >
              <option value="">All Threat Levels</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={loadWatchlist}
            disabled={loading}
            className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Entry
          </button>
        </div>
      </div>

      {/* Watchlist */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Watchlist Entries ({filteredWatchlist.length})
          </h2>
        </div>

        {loading ? (
          <Loading message="Loading watchlist..." />
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredWatchlist.length === 0 ? (
              <div className="p-12 text-center">
                <Eye className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">No watchlist entries found</p>
                <p className="text-gray-400 text-sm">
                  {filters.search || filters.threat_level 
                    ? 'Try adjusting your search or filter criteria'
                    : 'Start by adding your first watchlist entry'
                  }
                </p>
                {!filters.search && !filters.threat_level && (
                  <button
                    onClick={() => setShowForm(true)}
                    className="mt-4 inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add First Entry
                  </button>
                )}
              </div>
            ) : (
              filteredWatchlist.map((entry) => (
                <div key={entry.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 flex-1">
                      <div className="w-12 h-12 bg-gradient-to-r from-red-500 to-orange-600 rounded-full flex items-center justify-center text-white font-bold">
                        {entry.first_name?.[0]}{entry.last_name?.[0]}
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-lg font-medium text-gray-900">
                            {entry.first_name} {entry.last_name}
                          </h3>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getThreatLevelColor(entry.threat_level)}`}>
                            {getThreatLevelIcon(entry.threat_level)}
                            <span className="ml-1 capitalize">{entry.threat_level}</span>
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                          <div>
                            <span className="font-medium">Reason:</span> {entry.reason}
                          </div>
                          {entry.source_agency && (
                            <div>
                              <span className="font-medium">Source:</span> {entry.source_agency}
                            </div>
                          )}
                        </div>
                        
                        <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500">
                          <div className="flex items-center">
                            <Calendar className="w-3 h-3 mr-1" />
                            <span>Added: {format(new Date(entry.created_at), 'MMM d, yyyy')}</span>
                          </div>
                          {entry.expiry_date && (
                            <div className="flex items-center">
                              <span>Expires: {format(new Date(entry.expiry_date), 'MMM d, yyyy')}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => handleEdit(entry)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit Entry"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeactivate(entry.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Deactivate Entry"
                      >
                        <Ban className="w-4 h-4" />
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
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredWatchlist.length)} of {filteredWatchlist.length} entries
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
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages || loading}
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