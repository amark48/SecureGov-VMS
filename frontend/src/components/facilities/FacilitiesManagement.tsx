import React, { useState, useEffect } from 'react';
import { 
  Building, 
  Plus, 
  Search, 
  Filter, 
  Edit, 
  Settings, 
  Users,
  MapPin,
  Clock,
  Shield,
  AlertTriangle,
  CheckCircle,
  Eye,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Download,
  Upload,
  Calendar,
  Phone,
  Mail,
  FileText,
  Zap,
  XCircle
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useVisitors } from '../../hooks/useVisitors';
import { LoadingButton, Loading } from '../common/Loading';
import { format } from 'date-fns';
import type { Facility } from '../../types/visitor';

interface FacilitiesManagementProps {
  onFacilitySelected?: (facility: any) => void;
}

export const FacilitiesManagement: React.FC<FacilitiesManagementProps> = ({ onFacilitySelected }) => {
  const { user, hasRole } = useAuth();
  const { 
    getFacilities, 
    createFacility, 
    updateFacility, 
    loading, 
    error, 
    clearError 
  } = useVisitors();
  
  const [facilities, setFacilities] = useState<any[]>([]);
  const [filteredFacilities, setFilteredFacilities] = useState<any[]>([]);
  const [selectedFacility, setSelectedFacility] = useState<any>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingFacility, setEditingFacility] = useState<any>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Filters
  const [filters, setFilters] = useState({
    search: '',
    security_level: '',
    is_active: 'true'
  });

  // Form data
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    security_level: 'standard',
    max_visitors: 100,
    operating_hours: {
      monday: { open: '08:00', close: '17:00' },
      tuesday: { open: '08:00', close: '17:00' },
      wednesday: { open: '08:00', close: '17:00' },
      thursday: { open: '08:00', close: '17:00' },
      friday: { open: '08:00', close: '17:00' },
      saturday: { open: '09:00', close: '15:00' },
      sunday: { open: '10:00', close: '14:00' }
    },
    emergency_procedures: ''
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
    loadFacilities();
  }, []);

  useEffect(() => {
    filterFacilities();
  }, [facilities, filters]);

  const loadFacilities = async () => {
    try {
      setErrorMessage(null);
      const facilitiesData = await getFacilities();
      setFacilities(facilitiesData);
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to load facilities');
      console.error('Failed to load facilities:', error);
    }
  };

  const filterFacilities = () => {
    let filtered = facilities;

    if (filters.search) {
      filtered = filtered.filter(facility => 
        facility.name.toLowerCase().includes(filters.search.toLowerCase()) ||
        facility.address.toLowerCase().includes(filters.search.toLowerCase())
      );
    }

    if (filters.security_level) {
      filtered = filtered.filter(facility => facility.security_level === filters.security_level);
    }

    if (filters.is_active !== '') {
      const isActive = filters.is_active === 'true';
      filtered = filtered.filter(facility => facility.is_active === isActive);
    }

    setFilteredFacilities(filtered);
  };

  const handleFacilityClick = (facility: any) => {
    setSelectedFacility(facility);
    setShowDetails(true);
    if (onFacilitySelected) {
      onFacilitySelected(facility);
    }
  };

  const handleEdit = (facility: any) => {
    setFormData({
      name: facility.name,
      address: facility.address,
      security_level: facility.security_level,
      max_visitors: facility.max_visitors,
      operating_hours: facility.operating_hours || formData.operating_hours,
      emergency_procedures: facility.emergency_procedures || ''
    });
    setEditingFacility(facility);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    
    try {
      if (editingFacility) {
        // Update existing facility
        const updatedFacility = await updateFacility(editingFacility.id, formData);
        setFacilities(prev => prev.map(f => f.id === updatedFacility.id ? updatedFacility : f));
        setSuccessMessage(`Facility "${updatedFacility.name}" updated successfully`);
      } else {
        // Create new facility - add tenant_id from current user
        const facilityData = {
          ...formData,
          tenant_id: user?.tenant_id // Add tenant_id from the current user
        };
        
        // Create new facility
        const newFacility = await createFacility(facilityData);
        setFacilities(prev => [newFacility, ...prev]);
        setSuccessMessage(`Facility "${newFacility.name}" created successfully`);
      }
      resetForm();
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to save facility');
      console.error('Failed to save facility:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      address: '',
      security_level: 'standard',
      max_visitors: 100,
      operating_hours: {
        monday: { open: '08:00', close: '17:00' },
        tuesday: { open: '08:00', close: '17:00' },
        wednesday: { open: '08:00', close: '17:00' },
        thursday: { open: '08:00', close: '17:00' },
        friday: { open: '08:00', close: '17:00' },
        saturday: { open: '09:00', close: '15:00' },
        sunday: { open: '10:00', close: '14:00' }
      },
      emergency_procedures: ''
    });
    setEditingFacility(null);
    setShowForm(false);
  };

  const getSecurityLevelColor = (level: string) => {
    switch (level) {
      case 'maximum':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'standard':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getSecurityLevelIcon = (level: string) => {
    switch (level) {
      case 'maximum':
        return <Shield className="w-4 h-4 text-red-600" />;
      case 'high':
        return <AlertTriangle className="w-4 h-4 text-orange-600" />;
      case 'standard':
        return <Shield className="w-4 h-4 text-blue-600" />;
      case 'low':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      default:
        return <Shield className="w-4 h-4 text-gray-600" />;
    }
  };

  const canManageFacilities = hasRole('admin');

  if (showForm) {
    return (
      <div className="space-y-6">
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
              {editingFacility ? 'Edit Facility' : 'Add New Facility'}
            </h2>
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

        {/* Form */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-md font-medium text-gray-900 flex items-center">
                <Building className="w-4 h-4 mr-2" />
                Basic Information
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Facility Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Main Government Building"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Security Level *
                  </label>
                  <select
                    required
                    value={formData.security_level}
                    onChange={(e) => setFormData(prev => ({ ...prev, security_level: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="low">Low Security</option>
                    <option value="standard">Standard Security</option>
                    <option value="high">High Security</option>
                    <option value="maximum">Maximum Security</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address *
                </label>
                <textarea
                  required
                  rows={3}
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="123 Government Ave, Washington DC 20001"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Maximum Visitors
                </label>
                <input
                  type="number"
                  min="1"
                  max="10000"
                  value={formData.max_visitors}
                  onChange={(e) => setFormData(prev => ({ ...prev, max_visitors: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Operating Hours */}
            <div className="space-y-4">
              <h3 className="text-md font-medium text-gray-900 flex items-center">
                <Clock className="w-4 h-4 mr-2" />
                Operating Hours
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(formData.operating_hours).map(([day, hours]) => (
                  <div key={day} className="flex items-center space-x-4">
                    <div className="w-20 text-sm font-medium text-gray-700 capitalize">
                      {day}
                    </div>
                    <input
                      type="time"
                      value={hours.open}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        operating_hours: {
                          ...prev.operating_hours,
                          [day]: { ...hours, open: e.target.value }
                        }
                      }))}
                      className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <span className="text-gray-500">to</span>
                    <input
                      type="time"
                      value={hours.close}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        operating_hours: {
                          ...prev.operating_hours,
                          [day]: { ...hours, close: e.target.value }
                        }
                      }))}
                      className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Emergency Procedures */}
            <div className="space-y-4">
              <h3 className="text-md font-medium text-gray-900 flex items-center">
                <AlertTriangle className="w-4 h-4 mr-2" />
                Emergency Procedures
              </h3>
              
              <div>
                <textarea
                  rows={6}
                  value={formData.emergency_procedures}
                  onChange={(e) => setFormData(prev => ({ ...prev, emergency_procedures: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Describe emergency evacuation procedures, assembly points, emergency contacts, and safety protocols..."
                />
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
                {editingFacility ? 'Update Facility' : 'Create Facility'}
              </LoadingButton>
            </div>
          </form>
        </div>
      </div>
    );
  }

  if (showDetails && selectedFacility) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => {
                  setShowDetails(false);
                  setSelectedFacility(null);
                }}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{selectedFacility.name}</h1>
                <p className="text-gray-500">{selectedFacility.address}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getSecurityLevelColor(selectedFacility.security_level)}`}>
                {getSecurityLevelIcon(selectedFacility.security_level)}
                <span className="ml-1 capitalize">{selectedFacility.security_level} Security</span>
              </span>
              {canManageFacilities && (
                <button
                  onClick={() => handleEdit(selectedFacility)}
                  className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </button>
              )}
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

        {/* Facility Details */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Basic Information */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Facility Information</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <p className="text-gray-900">{selectedFacility.name}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Address</label>
                <p className="text-gray-900">{selectedFacility.address}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Security Level</label>
                <div className="flex items-center space-x-2">
                  {getSecurityLevelIcon(selectedFacility.security_level)}
                  <span className="capitalize">{selectedFacility.security_level}</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Maximum Visitors</label>
                <p className="text-gray-900">{selectedFacility.max_visitors}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Status</label>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  selectedFacility.is_active 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {selectedFacility.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </div>

          {/* Operating Hours */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Operating Hours</h3>
            <div className="space-y-3">
              {selectedFacility.operating_hours ? (
                Object.entries(selectedFacility.operating_hours).map(([day, hours]: [string, any]) => (
                  <div key={day} className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700 capitalize">{day}</span>
                    <span className="text-sm text-gray-900">
                      {hours.open} - {hours.close}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-gray-500">No operating hours configured</p>
              )}
            </div>
          </div>
        </div>

        {/* Emergency Procedures */}
        {selectedFacility.emergency_procedures && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Emergency Procedures</h3>
            <div className="prose max-w-none">
              <p className="text-gray-700 whitespace-pre-wrap">{selectedFacility.emergency_procedures}</p>
            </div>
          </div>
        )}

        {/* Statistics */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Facility Statistics</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600 mb-1">
                {selectedFacility.total_visits || 0}
              </div>
              <div className="text-sm text-gray-600">Total Visits</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600 mb-1">
                {selectedFacility.today_visits || 0}
              </div>
              <div className="text-sm text-gray-600">Today's Visits</div>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600 mb-1">
                {selectedFacility.current_visitors || 0}
              </div>
              <div className="text-sm text-gray-600">Current Visitors</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600 mb-1">
                {Math.round(((selectedFacility.current_visitors || 0) / selectedFacility.max_visitors) * 100)}%
              </div>
              <div className="text-sm text-gray-600">Capacity Used</div>
            </div>
          </div>
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
            <h1 className="text-2xl font-bold mb-2">Facility Management</h1>
            <p className="text-blue-100">
              Manage secure facilities, operating hours, and emergency procedures
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{facilities.length}</div>
            <div className="text-blue-200 text-sm">Total Facilities</div>
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
                placeholder="Search facilities..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Security Level Filter */}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <select
                value={filters.security_level}
                onChange={(e) => setFilters(prev => ({ ...prev, security_level: e.target.value }))}
                className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
              >
                <option value="">All Security Levels</option>
                <option value="low">Low Security</option>
                <option value="standard">Standard Security</option>
                <option value="high">High Security</option>
                <option value="maximum">Maximum Security</option>
              </select>
            </div>

            {/* Status Filter */}
            <div className="relative">
              <select
                value={filters.is_active}
                onChange={(e) => setFilters(prev => ({ ...prev, is_active: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
              >
                <option value="">All Status</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={loadFacilities}
              disabled={loading}
              className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            
            {canManageFacilities && (
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Facility
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
              <p className="text-sm font-medium text-gray-600">Active Facilities</p>
              <p className="text-2xl font-bold text-green-600">
                {facilities.filter(f => f.is_active).length}
              </p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">High Security</p>
              <p className="text-2xl font-bold text-red-600">
                {facilities.filter(f => ['high', 'maximum'].includes(f.security_level)).length}
              </p>
            </div>
            <Shield className="w-8 h-8 text-red-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Capacity</p>
              <p className="text-2xl font-bold text-blue-600">
                {facilities.reduce((sum, f) => sum + (f.max_visitors || 0), 0)}
              </p>
            </div>
            <Users className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Current Visitors</p>
              <p className="text-2xl font-bold text-orange-600">
                {facilities.reduce((sum, f) => sum + (f.current_visitors || 0), 0)}
              </p>
            </div>
            <Eye className="w-8 h-8 text-orange-600" />
          </div>
        </div>
      </div>

      {/* Facilities List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Facilities ({filteredFacilities.length})
          </h2>
        </div>

        {loading && facilities.length === 0 ? (
          <Loading message="Loading facilities..." />
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredFacilities.length === 0 ? (
              <div className="p-12 text-center">
                <Building className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">No facilities found</p>
                <p className="text-gray-400 text-sm">
                  {filters.search || filters.security_level || filters.is_active !== 'true'
                    ? 'Try adjusting your search or filter criteria'
                    : 'Start by adding your first facility'
                  }
                </p>
                {canManageFacilities && !filters.search && !filters.security_level && filters.is_active === 'true' && (
                  <button
                    onClick={() => setShowForm(true)}
                    className="mt-4 inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add First Facility
                  </button>
                )}
              </div>
            ) : (
              filteredFacilities.map((facility) => (
                <div 
                  key={facility.id} 
                  className="p-6 hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => handleFacilityClick(facility)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 flex-1">
                      <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold">
                        <Building className="w-6 h-6" />
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-lg font-medium text-gray-900">
                            {facility.name}
                          </h3>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getSecurityLevelColor(facility.security_level)}`}>
                            {getSecurityLevelIcon(facility.security_level)}
                            <span className="ml-1 capitalize">{facility.security_level}</span>
                          </span>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            facility.is_active 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {facility.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                          <div className="flex items-center">
                            <MapPin className="w-4 h-4 mr-2 text-gray-400" />
                            <span className="truncate">{facility.address}</span>
                          </div>
                          <div className="flex items-center">
                            <Users className="w-4 h-4 mr-2 text-gray-400" />
                            <span>Capacity: {facility.max_visitors}</span>
                          </div>
                          <div className="flex items-center">
                            <Eye className="w-4 h-4 mr-2 text-gray-400" />
                            <span>Current: {facility.current_visitors || 0}</span>
                          </div>
                        </div>
                        
                        <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500">
                          <div className="flex items-center">
                            <Calendar className="w-3 h-3 mr-1" />
                            <span>Created: {format(new Date(facility.created_at), 'MMM d, yyyy')}</span>
                          </div>
                          <div className="flex items-center">
                            <Zap className="w-3 h-3 mr-1" />
                            <span>Visits Today: {facility.today_visits || 0}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFacilityClick(facility);
                        }}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {canManageFacilities && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(facility);
                          }}
                          className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Edit Facility"
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
      </div>
    </div>
  );
};