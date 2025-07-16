import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Building, 
  Plus, 
  Search, 
  Filter, 
  Edit, 
  Trash2,
  CheckCircle,
  XCircle,
  Bell,
  Settings,
  RefreshCw,
  User,
  Mail,
  Phone,
  Calendar,
  AlertTriangle,
  Info
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useVisitors } from '../../hooks/useVisitors';
import { LoadingButton, Loading } from '../common/Loading';
import { format } from 'date-fns';

export const HostManagement: React.FC = () => {
  const { user, getAllUsers } = useAuth();
  const { 
    getHosts, 
    getFacilities, 
    createHost, 
    updateHost, 
    deactivateHost,
    loading, 
    error, 
    clearError 
  } = useVisitors();
  
  const [hosts, setHosts] = useState<any[]>([]);
  const [facilities, setFacilities] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [filteredHosts, setFilteredHosts] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingHost, setEditingHost] = useState<any>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Form data
  const [formData, setFormData] = useState({
    profile_id: '',
    facility_id: '',
    notification_preferences: {
      email: true,
      sms: false,
      push: true
    },
    max_concurrent_visitors: 5,
    is_available: true
  });
  
  // Filters
  const [filters, setFilters] = useState({
    search: '',
    facility_id: '',
    is_available: ''
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

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    filterHosts();
  }, [hosts, filters]);

  const loadInitialData = async () => {
    setErrorMessage(null);
    try {
      const [hostsData, facilitiesData, usersResponse] = await Promise.all([
        getHosts(),
        getFacilities(),
        getAllUsers()
      ]);
      
      setHosts(hostsData);
      setFacilities(facilitiesData);
      
      // Handle users data - check if it's an array directly or wrapped in an object
      if (Array.isArray(usersResponse)) {
        setUsers(usersResponse);
      } else if (usersResponse && usersResponse.users && Array.isArray(usersResponse.users)) {
        // Filter out users that already have host associations for all facilities
        const usersWithoutAllFacilities = usersResponse.users.filter(user => {
          // Count how many facilities this user is a host for
          const hostFacilityCount = hostsData.filter(host => 
            host.profile_id === user.id
          ).length;
          
          // If the user is a host for fewer facilities than total facilities, include them
          return hostFacilityCount < facilitiesData.length;
        });
        
        setUsers(usersWithoutAllFacilities);
      } else {
        console.error('Expected users array in response but got:', usersResponse);
        setUsers([]);
      }
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to load data');
      console.error('Failed to load data:', error);
    }
  };

  const filterHosts = () => {
    let filtered = [...hosts];

    // Search filter
    if (filters.search) {
      filtered = filtered.filter(host => 
        host.full_name?.toLowerCase().includes(filters.search.toLowerCase()) ||
        host.email?.toLowerCase().includes(filters.search.toLowerCase()) ||
        host.facility_name?.toLowerCase().includes(filters.search.toLowerCase()) ||
        host.department?.toLowerCase().includes(filters.search.toLowerCase())
      );
    }

    // Facility filter
    if (filters.facility_id) {
      filtered = filtered.filter(host => host.facility_id === filters.facility_id);
    }

    // Availability filter
    if (filters.is_available !== '') {
      const isAvailable = filters.is_available === 'true';
      filtered = filtered.filter(host => host.is_available === isAvailable);
    }

    setFilteredHosts(filtered);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    
    try {
      if (editingHost) {
        // Update existing host
        const { notification_preferences, max_concurrent_visitors, is_available } = formData;
        const updatedHost = await updateHost(editingHost.id, {
          notification_preferences,
          max_concurrent_visitors,
          is_available
        });
        
        setHosts(prev => prev.map(h => h.id === updatedHost.id ? updatedHost : h));
        setSuccessMessage(`Host "${updatedHost.full_name}" updated successfully`);
      } else {
        // Create new host
        const newHost = await createHost(formData);
        setHosts(prev => [newHost, ...prev]);
        setSuccessMessage(`Host "${newHost.full_name}" created successfully`);
      }
      
      resetForm();
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to save host');
      console.error('Failed to save host:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      profile_id: '',
      facility_id: '',
      notification_preferences: {
        email: true,
        sms: false,
        push: true
      },
      max_concurrent_visitors: 5,
      is_available: true
    });
    setEditingHost(null);
    setShowForm(false);
  };

  const handleEdit = (host: any) => {
    setFormData({
      profile_id: host.profile_id,
      facility_id: host.facility_id,
      notification_preferences: host.notification_preferences || {
        email: true,
        sms: false,
        push: true
      },
      max_concurrent_visitors: host.max_concurrent_visitors || 5,
      is_available: host.is_available
    });
    setEditingHost(host);
    setShowForm(true);
  };

  const handleDeactivate = async (hostId: string, hostName: string) => {
    if (!confirm(`Are you sure you want to deactivate ${hostName} as a host?`)) {
      return;
    }
    
    setErrorMessage(null);
    setSuccessMessage(null);
    
    try {
      await deactivateHost(hostId);
      setHosts(prev => prev.map(h => h.id === hostId ? { ...h, is_available: false } : h));
      setSuccessMessage(`Host "${hostName}" deactivated successfully`);
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to deactivate host');
      console.error('Failed to deactivate host:', error);
    }
  };

  // Filter users for the dropdown to only show those who aren't already hosts for the selected facility
  const getAvailableUsers = () => {
    if (!formData.facility_id) return users;
    
    return users.filter(user => {
      // If we're editing, we want to include the current user
      if (editingHost && user.id === editingHost.profile_id) return true;
      
      // Check if this user is already a host for the selected facility
      const isHostForFacility = hosts.some(host => 
        host.profile_id === user.id && 
        host.facility_id === formData.facility_id
      );
      
      return !isHostForFacility;
    });
  };

  // Filter facilities for the dropdown to only show those where the selected user isn't already a host
  const getAvailableFacilities = () => {
    if (!formData.profile_id) return facilities;
    
    return facilities.filter(facility => {
      // If we're editing, we want to include the current facility
      if (editingHost && facility.id === editingHost.facility_id) return true;
      
      // Check if the selected user is already a host for this facility
      const isHostForFacility = hosts.some(host => 
        host.profile_id === formData.profile_id && 
        host.facility_id === facility.id
      );
      
      return !isHostForFacility;
    });
  };

  if (showForm) {
    return (
      <div className="space-y-6">
        {/* Form Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            {editingHost ? 'Edit Host' : 'Add New Host'}
          </h2>
          <button
            onClick={resetForm}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
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

        {/* Form */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* User and Facility Selection */}
            <div className="space-y-4">
              <h3 className="text-md font-medium text-gray-900 flex items-center">
                <User className="w-4 h-4 mr-2" />
                Host Assignment
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {!editingHost && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        User *
                      </label>
                      <select
                        required
                        value={formData.profile_id}
                        onChange={(e) => setFormData(prev => ({ ...prev, profile_id: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        disabled={editingHost !== null}
                      >
                        <option value="">Select a user</option>
                        {getAvailableUsers().map(user => (
                          <option key={user.id} value={user.id}>
                            {user.full_name} ({user.email})
                          </option>
                        ))}
                      </select>
                      {formData.profile_id && getAvailableUsers().length === 0 && (
                        <p className="text-xs text-red-600 mt-1">
                          This user is already a host for all facilities
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Facility *
                      </label>
                      <select
                        required
                        value={formData.facility_id}
                        onChange={(e) => setFormData(prev => ({ ...prev, facility_id: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        disabled={editingHost !== null}
                      >
                        <option value="">Select a facility</option>
                        {getAvailableFacilities().map(facility => (
                          <option key={facility.id} value={facility.id}>
                            {facility.name}
                          </option>
                        ))}
                      </select>
                      {formData.facility_id && getAvailableFacilities().length === 0 && (
                        <p className="text-xs text-red-600 mt-1">
                          This user is already a host for all facilities
                        </p>
                      )}
                    </div>
                  </>
                )}

                {editingHost && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        User
                      </label>
                      <p className="text-gray-900">{editingHost.full_name}</p>
                      <p className="text-sm text-gray-500">{editingHost.email}</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Facility
                      </label>
                      <p className="text-gray-900">{editingHost.facility_name}</p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Host Settings */}
            <div className="space-y-4">
              <h3 className="text-md font-medium text-gray-900 flex items-center">
                <Settings className="w-4 h-4 mr-2" />
                Host Settings
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Concurrent Visitors
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={formData.max_concurrent_visitors}
                    onChange={(e) => setFormData(prev => ({ ...prev, max_concurrent_visitors: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="is_available"
                    checked={formData.is_available}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_available: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="is_available" className="ml-2 block text-sm text-gray-900">
                    Available for Hosting
                  </label>
                </div>
              </div>

              {/* Notification Preferences */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notification Preferences
                </label>
                <div className="space-y-2">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="notify_email"
                      checked={formData.notification_preferences.email}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        notification_preferences: {
                          ...prev.notification_preferences,
                          email: e.target.checked
                        }
                      }))}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="notify_email" className="ml-2 block text-sm text-gray-900">
                      Email Notifications
                    </label>
                  </div>
                  
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="notify_sms"
                      checked={formData.notification_preferences.sms}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        notification_preferences: {
                          ...prev.notification_preferences,
                          sms: e.target.checked
                        }
                      }))}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="notify_sms" className="ml-2 block text-sm text-gray-900">
                      SMS Notifications
                    </label>
                  </div>
                  
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="notify_push"
                      checked={formData.notification_preferences.push}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        notification_preferences: {
                          ...prev.notification_preferences,
                          push: e.target.checked
                        }
                      }))}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="notify_push" className="ml-2 block text-sm text-gray-900">
                      Push Notifications
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancel
              </button>
              
              <LoadingButton
                loading={loading}
                variant="primary"
                size="md"
                type="submit"
              >
                {editingHost ? 'Update Host' : 'Create Host'}
              </LoadingButton>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">Host Management</h1>
            <p className="text-blue-100">
              Manage user-facility host associations and permissions
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{hosts.length}</div>
            <div className="text-blue-200 text-sm">Total Hosts</div>
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
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search hosts..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Facility Filter */}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <select
                value={filters.facility_id}
                onChange={(e) => setFilters(prev => ({ ...prev, facility_id: e.target.value }))}
                className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
              >
                <option value="">All Facilities</option>
                {facilities.map(facility => (
                  <option key={facility.id} value={facility.id}>
                    {facility.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Availability Filter */}
            <div className="relative">
              <select
                value={filters.is_available}
                onChange={(e) => setFilters(prev => ({ ...prev, is_available: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
              >
                <option value="">All Status</option>
                <option value="true">Available</option>
                <option value="false">Unavailable</option>
              </select>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={loadInitialData}
              disabled={loading}
              className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Host
            </button>
          </div>
        </div>
      </div>

      {/* Hosts List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Hosts ({filteredHosts.length})
          </h2>
        </div>

        {loading && hosts.length === 0 ? (
          <Loading message="Loading hosts..." />
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredHosts.length === 0 ? (
              <div className="p-12 text-center">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">No hosts found</p>
                <p className="text-gray-400 text-sm">
                  {filters.search || filters.facility_id || filters.is_available
                    ? 'Try adjusting your search or filter criteria'
                    : 'Start by adding your first host'
                  }
                </p>
                {!filters.search && !filters.facility_id && !filters.is_available && (
                  <button
                    onClick={() => setShowForm(true)}
                    className="mt-4 inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add First Host
                  </button>
                )}
              </div>
            ) : (
              filteredHosts.map((host) => (
                <div key={host.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 flex-1">
                      <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold">
                        {host.full_name?.split(' ').map((n: string) => n[0]).join('').toUpperCase() || 'U'}
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-lg font-medium text-gray-900">
                            {host.full_name}
                          </h3>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            host.is_available 
                              ? 'bg-green-100 text-green-800 border border-green-200' 
                              : 'bg-red-100 text-red-800 border border-red-200'
                          }`}>
                            {host.is_available ? 'Available' : 'Unavailable'}
                          </span>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200 capitalize">
                            {host.role}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                          <div className="flex items-center">
                            <Mail className="w-4 h-4 mr-2 text-gray-400" />
                            <span>{host.email}</span>
                          </div>
                          <div className="flex items-center">
                            <Building className="w-4 h-4 mr-2 text-gray-400" />
                            <span>{host.facility_name}</span>
                          </div>
                          <div className="flex items-center">
                            <Users className="w-4 h-4 mr-2 text-gray-400" />
                            <span>Max Visitors: {host.max_concurrent_visitors || 5}</span>
                          </div>
                        </div>
                        
                        <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500">
                          <div className="flex items-center">
                            <Calendar className="w-3 h-3 mr-1" />
                            <span>Created: {format(new Date(host.created_at), 'MMM d, yyyy')}</span>
                          </div>
                          <div className="flex items-center">
                            <Bell className="w-3 h-3 mr-1" />
                            <span>
                              Notifications: {Object.entries(host.notification_preferences || {})
                                .filter(([_, enabled]) => enabled)
                                .map(([type]) => type.charAt(0).toUpperCase() + type.slice(1))
                                .join(', ') || 'None'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => handleEdit(host)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit Host"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      {host.is_available && (
                        <button
                          onClick={() => handleDeactivate(host.id, host.full_name)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Deactivate Host"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Information Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-blue-800">About Host Management</h3>
            <p className="text-sm text-blue-700 mt-1">
              Hosts are users who can receive visitors at specific facilities. Each user can be a host at multiple facilities, and each facility can have multiple hosts.
            </p>
            <p className="text-sm text-blue-700 mt-1">
              When creating a visit or invitation, a host must be selected. Only users who are designated as hosts for a facility can receive visitors at that facility.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
