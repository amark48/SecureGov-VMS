import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { 
  Calendar, 
  Clock, 
  User, 
  Building, 
  MapPin, 
  Shield, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info,
  Users
} from 'lucide-react';
import { useVisitors } from '../../hooks/useVisitors';
import { useAuth } from '../../hooks/useAuth';
import { useInvitation } from '../../hooks/useInvitation';
import { LoadingButton, Loading } from '../common/Loading';
import { format } from 'date-fns';

interface CreateVisitFormProps {
  onVisitCreated?: (visit: any) => void;
  onCancel?: () => void;
  requiresApproval?: boolean;
}

interface VisitFormData {
  visitor_id?: string;
  host_id: string;
  facility_id: string;
  purpose: string;
  scheduled_date: string;
  scheduled_start_time?: string;
  scheduled_end_time?: string;
  visitor_count: number;
  escort_required: boolean;
  security_approval_required: boolean;
  areas_authorized?: string[];
  special_instructions?: string;
}

export const CreateVisitForm: React.FC<CreateVisitFormProps> = ({
  onVisitCreated,
  onCancel,
  requiresApproval = false
}) => {
  const { user } = useAuth();
  const { 
    createVisit, 
    getHosts, 
    getFacilities, 
    getVisitors, 
    loading: visitorLoading, 
    error: visitorError 
  } = useVisitors();
  const { 
    createInvitation, 
    loading: invitationLoading, 
    error: invitationError 
  } = useInvitation();

  const [hosts, setHosts] = useState<any[]>([]);
  const [facilities, setFacilities] = useState<any[]>([]);
  const [visitors, setVisitors] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedVisitor, setSelectedVisitor] = useState<any | null>(null);
  const [createNewVisitor, setCreateNewVisitor] = useState(false);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<VisitFormData>({
    defaultValues: {
      visitor_count: 1,
      escort_required: false,
      security_approval_required: requiresApproval,
      scheduled_date: format(new Date(), 'yyyy-MM-dd')
    }
  });

  const watchFacilityId = watch('facility_id');
  const watchHostId = watch('host_id');

  // Clear success message after 5 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Clear error message after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    loadFormData();
  }, []);

  useEffect(() => {
    // If user is a host, set the host_id to their host record
    if (user?.role === 'host' && hosts.length > 0) {
      const userHost = hosts.find(host => host.profile_id === user.id);
      if (userHost) {
        setValue('host_id', userHost.id);
      }
    }
  }, [hosts, user]);

  const loadFormData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [hostsData, facilitiesData, visitorsData] = await Promise.all([
        getHosts(),
        getFacilities(),
        getVisitors(100, 0)
      ]);
      
      setHosts(hostsData);
      setFacilities(facilitiesData);
      
      // Handle visitors data which might be wrapped in a pagination object
      if (Array.isArray(visitorsData)) {
        setVisitors(visitorsData);
      } else if (visitorsData && Array.isArray(visitorsData.visitors)) {
        setVisitors(visitorsData.visitors);
      } else {
        setVisitors([]);
        console.error('Expected array of visitors but got:', visitorsData);
      }
    } catch (error: any) {
      setError(error.message || 'Failed to load form data');
      console.error('Failed to load form data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: VisitFormData) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      if (requiresApproval) {
        // Create invitation that requires approval
        const invitation = await createInvitation({
          ...data,
          tenant_id: user?.tenant_id || '',
          security_approval_required: true
        });
        
        setSuccess('Invitation created successfully and is pending approval');
        
        if (onVisitCreated) {
          onVisitCreated(invitation);
        }
      } else {
        // Create visit directly
        const visit = await createVisit(data);
        
        setSuccess('Visit created successfully');
        
        if (onVisitCreated) {
          onVisitCreated(visit);
        }
      }
    } catch (error: any) {
      setError(error.message || 'Failed to create visit');
      console.error('Failed to create visit:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVisitorSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const visitorId = e.target.value;
    if (visitorId === 'new') {
      setCreateNewVisitor(true);
      setSelectedVisitor(null);
      setValue('visitor_id', undefined);
    } else if (visitorId) {
      const visitor = visitors.find(v => v.id === visitorId);
      setSelectedVisitor(visitor);
      setValue('visitor_id', visitorId);
      setCreateNewVisitor(false);
    } else {
      setSelectedVisitor(null);
      setValue('visitor_id', undefined);
      setCreateNewVisitor(false);
    }
  };

  if (loading && (!hosts.length || !facilities.length)) {
    return <Loading message="Loading form data..." />;
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {requiresApproval ? 'Create Invitation' : 'Schedule Visit'}
          </h2>
          {onCancel && (
            <button
              onClick={onCancel}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="mx-6 mt-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center justify-between">
          <div className="flex items-center">
            <CheckCircle className="w-5 h-5 mr-2" />
            <p className="font-medium">{success}</p>
          </div>
          <button 
            onClick={() => setSuccess(null)}
            className="text-green-700 hover:text-green-900"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>
      )}

      {(error || visitorError || invitationError) && (
        <div className="mx-6 mt-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between">
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 mr-2" />
            <p className="font-medium">{error || visitorError || invitationError}</p>
          </div>
          <button 
            onClick={() => setError(null)}
            className="text-red-700 hover:text-red-900"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Approval Notice */}
      {requiresApproval && (
        <div className="mx-6 mt-6 bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg flex items-center">
          <Info className="w-5 h-5 mr-2" />
          <p className="font-medium">This invitation will require approval before the visit is scheduled.</p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
        {/* Visitor Information */}
        <div className="space-y-4">
          <h3 className="text-md font-medium text-gray-900 flex items-center">
            <User className="w-4 h-4 mr-2" />
            Visitor Information
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select Visitor
              </label>
              <select
                onChange={handleVisitorSelect}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">Select a visitor or create new</option>
                <option value="new">+ Create New Visitor</option>
                {visitors.map(visitor => (
                  <option key={visitor.id} value={visitor.id}>
                    {visitor.first_name} {visitor.last_name} {visitor.company ? `(${visitor.company})` : ''}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {createNewVisitor 
                  ? 'Visitor information will be collected at check-in' 
                  : 'Select an existing visitor or create a new one'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Visitor Count *
              </label>
              <input
                type="number"
                min="1"
                max="50"
                {...register('visitor_count', { required: 'Visitor count is required', min: 1, max: 50 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              {errors.visitor_count && (
                <p className="text-sm text-red-600 mt-1">{errors.visitor_count.message}</p>
              )}
            </div>
          </div>

          {selectedVisitor && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Selected Visitor Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Name:</span> {selectedVisitor.first_name} {selectedVisitor.last_name}
                </div>
                {selectedVisitor.company && (
                  <div>
                    <span className="font-medium">Company:</span> {selectedVisitor.company}
                  </div>
                )}
                {selectedVisitor.email && (
                  <div>
                    <span className="font-medium">Email:</span> {selectedVisitor.email}
                  </div>
                )}
                {selectedVisitor.phone && (
                  <div>
                    <span className="font-medium">Phone:</span> {selectedVisitor.phone}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Visit Details */}
        <div className="space-y-4">
          <h3 className="text-md font-medium text-gray-900 flex items-center">
            <Calendar className="w-4 h-4 mr-2" />
            Visit Details
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Purpose *
              </label>
              <input
                {...register('purpose', { required: 'Purpose is required' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Meeting, Interview, etc."
              />
              {errors.purpose && (
                <p className="text-sm text-red-600 mt-1">{errors.purpose.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date *
              </label>
              <input
                type="date"
                {...register('scheduled_date', { required: 'Date is required' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              {errors.scheduled_date && (
                <p className="text-sm text-red-600 mt-1">{errors.scheduled_date.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Time
              </label>
              <input
                type="time"
                {...register('scheduled_start_time')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Time
              </label>
              <input
                type="time"
                {...register('scheduled_end_time')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Special Instructions
            </label>
            <textarea
              {...register('special_instructions')}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Any special requirements or notes..."
            />
          </div>
        </div>

        {/* Host and Facility */}
        <div className="space-y-4">
          <h3 className="text-md font-medium text-gray-900 flex items-center">
            <Building className="w-4 h-4 mr-2" />
            Host and Facility
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Host *
              </label>
              <select
                {...register('host_id', { required: 'Host is required' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                disabled={user?.role === 'host'} // Disable if user is a host (they can only create for themselves)
              >
                <option value="">Select a host</option>
                {hosts.map(host => (
                  <option key={host.id} value={host.id}>
                    {host.full_name} ({host.department || 'No department'})
                  </option>
                ))}
              </select>
              {errors.host_id && (
                <p className="text-sm text-red-600 mt-1">{errors.host_id.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Facility *
              </label>
              <select
                {...register('facility_id', { required: 'Facility is required' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">Select a facility</option>
                {facilities.map(facility => (
                  <option key={facility.id} value={facility.id}>
                    {facility.name}
                  </option>
                ))}
              </select>
              {errors.facility_id && (
                <p className="text-sm text-red-600 mt-1">{errors.facility_id.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="escort_required"
                {...register('escort_required')}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <label htmlFor="escort_required" className="ml-2 block text-sm text-gray-900">
                Escort Required
              </label>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="security_approval_required"
                {...register('security_approval_required')}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                checked={requiresApproval || watch('security_approval_required')}
                disabled={requiresApproval} // Disable if approval is required by default
              />
              <label htmlFor="security_approval_required" className="ml-2 block text-sm text-gray-900">
                Security Approval Required
              </label>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Cancel
            </button>
          )}
          
          <LoadingButton
            loading={loading || visitorLoading || invitationLoading}
            variant="primary"
            size="md"
            type="submit"
          >
            {requiresApproval ? 'Submit for Approval' : 'Schedule Visit'}
          </LoadingButton>
        </div>
      </form>
    </div>
  );
};