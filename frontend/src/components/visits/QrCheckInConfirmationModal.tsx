import React from 'react';
import { CheckCircle, XCircle, User, Building, Clock, Calendar, MapPin, Phone, Mail, Info } from 'lucide-react';
import { format } from 'date-fns';
import { LoadingButton } from '../common/Loading';

interface QrCheckInConfirmationModalProps {
  visit: any;
  onConfirm: (visit: any) => void;
  onCancel: () => void;
  isProcessing: boolean;
}

export const QrCheckInConfirmationModal: React.FC<QrCheckInConfirmationModalProps> = ({
  visit,
  onConfirm,
  onCancel,
  isProcessing,
}) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Confirm Visitor Check-in</h2>
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-500"
              disabled={isProcessing}
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg flex items-center">
            <Info className="w-5 h-5 mr-2" />
            <p className="font-medium">
              Please verify the visitor's details before confirming check-in.
            </p>
          </div>

          {/* Visitor Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <User className="w-5 h-5 mr-2 text-blue-600" />
                Visitor Information
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Name</label>
                  <p className="text-gray-900">{visit.first_name} {visit.last_name}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Company</label>
                  <p className="text-gray-900">{visit.company || 'Not provided'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <p className="text-gray-900">{visit.email || 'Not provided'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Phone</label>
                  <p className="text-gray-900">{visit.phone || 'Not provided'}</p>
                </div>
              </div>
            </div>

            {/* Visit Details */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <Calendar className="w-5 h-5 mr-2 text-blue-600" />
                Visit Details
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Purpose</label>
                  <p className="text-gray-900">{visit.purpose}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Scheduled Date</label>
                  <p className="text-gray-900">{format(new Date(visit.scheduled_date), 'EEEE, MMMM d, yyyy')}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Scheduled Time</label>
                  <p className="text-gray-900">
                    {visit.scheduled_start_time
                      ? `${visit.scheduled_start_time}${visit.scheduled_end_time ? ` - ${visit.scheduled_end_time}` : ''}`
                      : 'All day'
                    }
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Visitor Count</label>
                  <p className="text-gray-900">{visit.visitor_count || 1}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Host and Facility Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <User className="w-5 h-5 mr-2 text-blue-600" />
                Host Information
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Host</label>
                  <p className="text-gray-900">{visit.host_name || 'Not assigned'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Host Email</label>
                  <p className="text-gray-900">{visit.host_email || 'Not provided'}</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <Building className="w-5 h-5 mr-2 text-blue-600" />
                Facility Information
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Facility</label>
                  <p className="text-gray-900">{visit.facility_name}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Escort Required</label>
                  <p className="text-gray-900">{visit.escort_required ? 'Yes' : 'No'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Security Approval</label>
                  <p className="text-gray-900">{visit.security_approval_required ? 'Required' : 'Not required'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            disabled={isProcessing}
          >
            Cancel
          </button>
          <LoadingButton
            loading={isProcessing}
            variant="primary"
            size="md"
            onClick={() => onConfirm(visit)}
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Confirm Check-in
          </LoadingButton>
        </div>
      </div>
    </div>
  );
};
