import React, { useState, useEffect, useCallback } from 'react';
import { 
  Calendar, 
  Search, 
  Filter, 
  Plus, 
  Eye, 
  CheckCircle, 
  XCircle,
  Clock,
  User,
  Building,
  Phone,
  Mail,
  MapPin,
  AlertTriangle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  X,
  Copy,
  Link,
  QrCode // Re-added QrCode icon
} from 'lucide-react';
import { useInvitation } from '../../hooks/useInvitation';
import { useAuth } from '../../hooks/useAuth';
import { LoadingButton, Loading } from '../common/Loading';
import { format } from 'date-fns';
import { CreateInvitationForm } from './CreateInvitationForm';
import type { Invitation } from '../../types/invitation';
import { qrCodeService } from '../../services/qrCode'; // Re-added qrCodeService import

interface InvitationsListProps {
  onInvitationSelected?: (invitation: Invitation) => void;
}

export const InvitationsList: React.FC<InvitationsListProps> = ({ onInvitationSelected }) => {
  // --- ALL HOOK DECLARATIONS MUST BE AT THE TOP LEVEL ---
  const { user, hasAnyRole } = useAuth();
  const { 
    getInvitations, 
    approveInvitation, 
    rejectInvitation, 
    cancelInvitation,
    loading, 
    error, 
    paginationData, 
    clearError 
  } = useInvitation();

  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [selectedInvitation, setSelectedInvitation] = useState<Invitation | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  
  // QR Code specific states
  const [qrCodeImage, setQrCodeImage] = useState<string | null>(null);
  const [qrCodeLoading, setQrCodeLoading] = useState(false);
  const [qrCodeError, setQrCodeError] = useState<string | null>(null);
  const [showGenerateQrButton, setShowGenerateQrButton] = useState(false);
  const [generatingQrCode, setGeneratingQrCode] = useState(false);

  // Filters
  const [filters, setFilters] = useState({
    status: '',
    search: ''
  });
  // --- END OF HOOK DECLARATIONS ---

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

  // Reset link copied status after 3 seconds
  useEffect(() => {
    if (linkCopied) {
      const timer = setTimeout(() => setLinkCopied(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [linkCopied]);

  useEffect(() => {
    loadInvitations();
  }, [currentPage, filters.status, filters.search]);

  // Fetch QR code image when invitation is selected and approved
  useEffect(() => {
    if (selectedInvitation && selectedInvitation.status === 'approved' && selectedInvitation.pre_registration_required) {
      fetchQrCode(selectedInvitation.id);
    } else {
      setQrCodeImage(null);
      setQrCodeError(null);
      setShowGenerateQrButton(false);
    }
  }, [selectedInvitation]);

  const fetchQrCode = useCallback(async (invitationId: string) => {
    setQrCodeLoading(true);
    setQrCodeError(null);
    setShowGenerateQrButton(false); // Hide generate button while fetching
    try {
      const imageUrl = await qrCodeService.getQrCodeImage(invitationId);
      setQrCodeImage(imageUrl);
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to load QR code image';
      setQrCodeError(errorMsg);
      // Check if this is a QR_CODE_NOT_FOUND error
      if (errorMsg.includes('QR_CODE_NOT_FOUND')) {
        setShowGenerateQrButton(true);
      }
      console.error('Failed to load QR code image:', err);
    } finally {
      setQrCodeLoading(false);
    }
  }, []);

  const handleGenerateQrCode = async () => {
    if (!selectedInvitation) return;
    
    setGeneratingQrCode(true);
    setQrCodeError(null);
    try {
      await qrCodeService.generateQrCode(selectedInvitation.id);
      setSuccessMessage('QR code generated successfully');
      // Fetch the newly generated QR code
      await fetchQrCode(selectedInvitation.id);
    } catch (err: any) {
      setQrCodeError(err.message || 'Failed to generate QR code');
      console.error('Failed to generate QR code:', err);
    } finally {
      setGeneratingQrCode(false);
      setShowGenerateQrButton(false);
    }
  };

  const loadInvitations = async () => {
    try {
      setErrorMessage(null);
      const invitationsData = await getInvitations(
        filters.status || undefined, 
        filters.search || undefined,
        currentPage
      );
      
      // If user is a host, filter to only show their invitations
      if (user?.role === 'host') {
        const filteredInvitations = invitationsData.filter(
          invitation => invitation.host_profile_id === user.id
        );
        setInvitations(filteredInvitations);
      } else {
        setInvitations(invitationsData);
      }
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to load invitations');
      console.error('Failed to load invitations:', error);
    }
  };

  const handleInvitationClick = (invitation: Invitation) => {
    // For hosts, only allow viewing their own invitations
    if (user?.role === 'host' && invitation.host_profile_id !== user.id) {
      setErrorMessage("You don't have permission to view this invitation");
      return;
    }
    
    setSelectedInvitation(invitation);
    setShowDetails(true);
    if (onInvitationSelected) {
      onInvitationSelected(invitation);
    }
  };

  const handleApprove = async (invitation: Invitation) => {
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const updatedInvitation = await approveInvitation(invitation.id);
      setInvitations(prev => prev.map(i => i.id === updatedInvitation.id ? updatedInvitation : i));
      setSuccessMessage('Invitation approved successfully');
      setSelectedInvitation(updatedInvitation);
      // If pre-registration is required, fetch QR code after approval
      if (updatedInvitation.pre_registration_required) {
        fetchQrCode(updatedInvitation.id);
      }
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to approve invitation');
      console.error('Failed to approve invitation:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async (invitation: Invitation) => {
    if (!rejectionReason.trim()) {
      setErrorMessage('Rejection reason is required');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const updatedInvitation = await rejectInvitation(invitation.id, rejectionReason);
      setInvitations(prev => prev.map(i => i.id === updatedInvitation.id ? updatedInvitation : i));
      setSuccessMessage('Invitation rejected successfully');
      setSelectedInvitation(updatedInvitation);
      setShowRejectForm(false);
      setRejectionReason('');
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to reject invitation');
      console.error('Failed to reject invitation:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = async (invitation: Invitation) => {
    if (!confirm('Are you sure you want to cancel this invitation?')) {
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const updatedInvitation = await cancelInvitation(invitation.id);
      setInvitations(prev => prev.map(i => i.id === updatedInvitation.id ? updatedInvitation : i));
      setSuccessMessage('Invitation cancelled successfully');
      setSelectedInvitation(updatedInvitation);
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to cancel invitation');
      console.error('Failed to cancel invitation:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopyLink = (link: string) => {
    navigator.clipboard.writeText(link)
      .then(() => {
        setLinkCopied(true);
        setSuccessMessage('Pre-registration link copied to clipboard');
      })
      .catch(err => {
        console.error('Failed to copy link:', err);
        setErrorMessage('Failed to copy link to clipboard');
      });
  };

  const handleExportInvitations = () => {
    // This would be implemented to call an API endpoint that returns a CSV/Excel file
    alert('Export functionality would be implemented here');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'approved':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'approved':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'rejected':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'cancelled':
        return <X className="w-4 h-4 text-gray-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-600" />;
    }
  };

  const canApprove = (invitation: Invitation) => {
    return invitation.status === 'pending' && hasAnyRole(['admin', 'approver']);
  };

  const canReject = (invitation: Invitation) => {
    return invitation.status === 'pending' && hasAnyRole(['admin', 'approver']);
  };

  const canCancel = (invitation: Invitation) => {
    return (invitation.status === 'pending' || invitation.status === 'approved') && 
           (hasAnyRole(['admin']) || (user?.id === invitation.host_profile_id));
  };

  // Format areas authorized for better display
  const formatAreasAuthorized = (areas: string[] | null | undefined): string => {
    if (!areas || areas.length === 0) return 'None';
    
    return areas.map(area => 
      area.split('_')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ')
    ).join(', ');
  };

  // Format vehicle info for display
  const formatVehicleInfo = (vehicleInfo: any): string => {
    if (!vehicleInfo || Object.keys(vehicleInfo).length === 0) return 'None';
    
    const details = [];
    if (vehicleInfo.make) details.push(`Make: ${vehicleInfo.make}`);
    if (vehicleInfo.model) details.push(`Model: ${vehicleInfo.model}`);
    if (vehicleInfo.color) details.push(`Color: ${vehicleInfo.color}`);
    if (vehicleInfo.license_plate) details.push(`License: ${vehicleInfo.license_plate}`);
    
    return details.length > 0 ? details.join(', ') : 'None';
  };

  // Format equipment brought for display
  const formatEquipment = (equipment: string[] | null | undefined): string => {
    if (!equipment || equipment.length === 0) return 'None';
    return equipment.join(', ');
  };

  // --- CONDITIONAL RENDERING FOR FORMS/DETAILS ---
  if (showCreateForm) {
    return (
      <CreateInvitationForm 
        onInvitationCreated={(invitation) => {
          setShowCreateForm(false);
          setSuccessMessage('Invitation created successfully and is pending approval');
          loadInvitations();
        }}
        onCancel={() => setShowCreateForm(false)}
      />
    );
  }

  if (showDetails && selectedInvitation) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => {
                  setShowDetails(false);
                  setSelectedInvitation(null);
                  setShowRejectForm(false);
                  setQrCodeImage(null); // Clear QR code image on back
                  setQrCodeError(null); // Clear QR code error on back
                  setShowGenerateQrButton(false); // Clear generate button state on back
                }}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Invitation Details</h1>
                <p className="text-gray-500">
                  {selectedInvitation.visitor_first_name 
                    ? `${selectedInvitation.visitor_first_name} ${selectedInvitation.visitor_last_name}` 
                    : 'New Visitor'} • {format(new Date(selectedInvitation.scheduled_date), 'EEEE, MMMM d, yyyy')}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {getStatusIcon(selectedInvitation.status)}
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(selectedInvitation.status)}`}>
                {selectedInvitation.status.toUpperCase()}
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

        {/* Pre-registration Link / QR Code */}
        {selectedInvitation?.pre_registration_required && selectedInvitation.status === 'approved' && (
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Link className="w-5 h-5 mr-2 text-blue-600" />
              Pre-registration Link
            </h3>
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-blue-800">
                  Status: <span className="capitalize">{selectedInvitation?.pre_registration_status || 'Pending'}</span>
                </p>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  selectedInvitation?.pre_registration_status === 'completed' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {selectedInvitation?.pre_registration_status === 'completed' ? 'COMPLETED' : 'PENDING'}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={selectedInvitation?.pre_registration_link || ''}
                  readOnly
                  className="flex-1 px-3 py-2 bg-white border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
                <button
                  onClick={() => handleCopyLink(selectedInvitation?.pre_registration_link || '')}
                  className={`px-3 py-2 text-sm font-medium text-white ${
                    linkCopied ? 'bg-green-600' : 'bg-blue-600 hover:bg-blue-700'
                  } rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500`}
                >
                  {linkCopied ? (
                    <span className="flex items-center">
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Copied!
                    </span>
                  ) : (
                    <span className="flex items-center">
                      <Copy className="w-4 h-4 mr-1" />
                      Copy Link
                    </span>
                  )}
                </button>
              </div>
              <p className="text-xs text-blue-700 mt-2">
                Share this link with the visitor to complete their pre-registration before arrival.
              </p>

              {/* QR Code Display */}
              <div className="mt-6 pt-4 border-t border-blue-200">
                <h4 className="text-md font-medium text-blue-800 mb-3 flex items-center">
                  <QrCode className="w-4 h-4 mr-2" />
                  QR Code for Pre-registration
                </h4>
                {qrCodeLoading ? (
                  <Loading message="Loading QR code..." />
                ) : qrCodeError ? (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                    <div className="flex items-center mb-2">
                      <AlertTriangle className="w-5 h-5 mr-2" />
                      <p>{qrCodeError}</p>
                    </div>
                    {showGenerateQrButton && (
                      <div className="flex justify-center mt-4">
                        <LoadingButton
                          loading={generatingQrCode}
                          variant="primary"
                          size="sm"
                          onClick={handleGenerateQrCode}
                        >
                          <QrCode className="w-4 h-4 mr-2" />
                          Generate QR Code
                        </LoadingButton>
                      </div>
                    )}
                  </div>
                ) : qrCodeImage ? (
                  <div className="flex justify-center">
                    <img src={qrCodeImage} alt="QR Code" className="w-48 h-48 border border-gray-200 rounded-lg" />
                  </div>
                ) : (
                  <div className="text-center text-gray-500">No QR code available.</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Invitation Details */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Visitor Information */}
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Visitor Information</h3>
                <div className="space-y-3">
                  {selectedInvitation?.visitor_id ? (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Name</label>
                        <p className="text-gray-900">{selectedInvitation?.visitor_first_name} {selectedInvitation?.visitor_last_name}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Company</label>
                        <p className="text-gray-900">{selectedInvitation?.visitor_company || 'Not provided'}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Email</label>
                        <p className="text-gray-900">{selectedInvitation?.visitor_email || 'Not provided'}</p>
                      </div>
                    </>
                  ) : (
                    <div>
                      <p className="text-gray-700 italic">Visitor information will be collected at check-in</p>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Visitor Count</label>
                    <p className="text-gray-900">{selectedInvitation?.visitor_count || 1}</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Visit Details</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Purpose</label>
                    <p className="text-gray-900">{selectedInvitation?.purpose}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Scheduled Date</label>
                    <p className="text-gray-900">{format(new Date(selectedInvitation?.scheduled_date || new Date()), 'EEEE, MMMM d, yyyy')}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Scheduled Time</label>
                    <p className="text-gray-900">
                      {selectedInvitation?.scheduled_start_time 
                        ? `${selectedInvitation.scheduled_start_time}${selectedInvitation?.scheduled_end_time ? ` - ${selectedInvitation.scheduled_end_time}` : ''}`
                        : 'All day'
                      }
                    </p>
                  </div>
                  {selectedInvitation?.special_instructions && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Special Instructions</label>
                      <p className="text-gray-900">{selectedInvitation?.special_instructions}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Additional Details */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Additional Details</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Areas Authorized</label>
                    <p className="text-gray-900">{formatAreasAuthorized(selectedInvitation?.areas_authorized)}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Vehicle Information</label>
                    <p className="text-gray-900">{formatVehicleInfo(selectedInvitation?.vehicle_info)}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Equipment</label>
                    <p className="text-gray-900">{formatEquipment(selectedInvitation?.equipment_brought)}</p>
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
                    <p className="text-gray-900">{selectedInvitation?.host_name || 'Not assigned'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email</label>
                    <p className="text-gray-900">{selectedInvitation?.host_email || 'Not provided'}</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Facility Information</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Facility</label>
                    <p className="text-gray-900">{selectedInvitation?.facility_name}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Escort Required</label>
                    <p className="text-gray-900">{selectedInvitation?.escort_required ? 'Yes' : 'No'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Security Approval</label>
                    <p className="text-gray-900">{selectedInvitation?.security_approval_required ? 'Required' : 'Not required'}</p>
                  </div>
                </div>
              </div>

              {/* Approval Information */}
              {selectedInvitation?.status !== 'pending' && (
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Approval Information</h3>
                  <div className="space-y-3">
                    {selectedInvitation?.status === 'approved' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Approved By</label>
                          <p className="text-gray-900">{selectedInvitation?.approver_name || 'Unknown'}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Approved At</label>
                          <p className="text-gray-900">
                            {selectedInvitation?.approved_at ? format(new Date(selectedInvitation.approved_at), 'MMM d, yyyy \'at\' HH:mm') : 'Unknown'}
                          </p>
                        </div>
                      </>
                    )}
                    {selectedInvitation?.status === 'rejected' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Rejected By</label>
                          <p className="text-gray-900">{selectedInvitation?.approver_name || 'Unknown'}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Rejection Reason</label>
                          <p className="text-gray-900 bg-red-50 p-3 rounded-lg">{selectedInvitation?.rejection_reason || 'No reason provided'}</p>
                        </div>
                      </>
                    )}
                    {selectedInvitation?.status === 'cancelled' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Cancelled At</label>
                        <p className="text-gray-900">{format(new Date(selectedInvitation?.updated_at || new Date()), 'MMM d, yyyy \'at\' HH:mm')}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Reject Form */}
          {showRejectForm && (
            <div className="mt-6 p-4 bg-red-50 rounded-lg border border-red-200">
              <h3 className="text-md font-medium text-red-800 mb-2">Rejection Reason</h3>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full px-3 py-2 border border-red-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                placeholder="Please provide a reason for rejecting this invitation..."
                rows={3}
              />
              <div className="flex justify-end space-x-3 mt-3">
                <button
                  onClick={() => {
                    setShowRejectForm(false);
                    setRejectionReason('');
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <LoadingButton
                  loading={isProcessing}
                  variant="danger"
                  size="sm"
                  onClick={() => handleReject(selectedInvitation)}
                >
                  Confirm Rejection
                </LoadingButton>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-500">
                Created: {format(new Date(selectedInvitation?.created_at || new Date()), 'MMM d, yyyy \'at\' HH:mm')}
              </div>
              <div className="flex items-center space-x-3">
                {selectedInvitation && canApprove(selectedInvitation) && (
                  <LoadingButton
                    loading={isProcessing && selectedInvitation?.id === invitation.id}
                    variant="primary"
                    size="sm"
                    onClick={() => handleApprove(selectedInvitation)}
                  >
                    <ThumbsUp className="w-4 h-4 mr-2" />
                    Approve
                  </LoadingButton>
                )}
                
                {selectedInvitation && canReject(selectedInvitation) && (
                  <LoadingButton
                    loading={isProcessing && selectedInvitation?.id === invitation.id}
                    variant="danger"
                    size="sm"
                    onClick={() => setShowRejectForm(true)}
                  >
                    <ThumbsDown className="w-4 h-4 mr-2" />
                    Reject
                  </LoadingButton>
                )}
                
                {selectedInvitation && canCancel(selectedInvitation) && (
                  <LoadingButton
                    loading={isProcessing && selectedInvitation?.id === invitation.id}
                    variant="secondary"
                    size="sm"
                    onClick={() => handleCancel(selectedInvitation)}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </LoadingButton>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  // --- END OF CONDITIONAL RENDERING FOR FORMS/DETAILS ---

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">Invitations Management</h1>
            <p className="text-purple-100">
              {hasAnyRole(['admin', 'approver']) 
                ? 'Review and approve visitor invitations' 
                : 'Manage your visitor invitations'}
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{paginationData.total}</div>
            <div className="text-purple-200 text-sm">Total Invitations</div>
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
                placeholder="Search invitations..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>

            {/* Status Filter */}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 appearance-none bg-white"
              >
                <option value="">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={loadInvitations}
              disabled={loading}
              className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            
            <button
              onClick={handleExportInvitations}
              className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </button>
            
            {hasAnyRole(['host', 'admin']) && (
              <button
                onClick={() => setShowCreateForm(true)}
                className="flex items-center px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Invitation
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
              <p className="text-sm font-medium text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-yellow-600">
                {invitations.filter(i => i.status === 'pending').length}
              </p>
            </div>
            <Clock className="w-8 h-8 text-yellow-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Approved</p>
              <p className="text-2xl font-bold text-green-600">
                {invitations.filter(i => i.status === 'approved').length}
              </p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Rejected</p>
              <p className="text-2xl font-bold text-red-600">
                {invitations.filter(i => i.status === 'rejected').length}
              </p>
            </div>
            <XCircle className="w-8 h-8 text-red-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Cancelled</p>
              <p className="text-2xl font-bold text-gray-600">
                {invitations.filter(i => i.status === 'cancelled').length}
              </p>
            </div>
            <X className="w-8 h-8 text-gray-600" />
          </div>
        </div>
      </div>

      {/* Invitations List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Invitations ({invitations.length})
          </h2>
        </div>

        {loading && invitations.length === 0 ? (
          <Loading message="Loading invitations..." />
        ) : (
          <div className="divide-y divide-gray-200">
            {invitations.length === 0 ? (
              <div className="p-12 text-center">
                <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">No invitations found</p>
                <p className="text-gray-400 text-sm">
                  {filters.status || filters.search
                    ? 'Try adjusting your filter criteria'
                    : hasAnyRole(['host', 'admin']) 
                      ? 'Start by creating your first invitation'
                      : 'No invitations require your attention'
                  }
                </p>
                {hasAnyRole(['host', 'admin']) && !filters.status && !filters.search && (
                  <button
                    onClick={() => setShowCreateForm(true)}
                    className="mt-4 inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create First Invitation
                  </button>
                )}
              </div>
            ) : (
              invitations.map((invitation) => (
                <div 
                  key={invitation.id} 
                  className="p-6 hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => handleInvitationClick(invitation)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 flex-1">
                      <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold">
                        {invitation.visitor_first_name 
                          ? `${invitation.visitor_first_name[0]}${invitation.visitor_last_name[0]}`
                          : 'NV'}
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-lg font-medium text-gray-900">
                            {invitation.visitor_first_name 
                              ? `${invitation.visitor_first_name} ${invitation.visitor_last_name}`
                              : 'New Visitor'}
                          </h3>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(invitation.status)}`}>
                            {getStatusIcon(invitation.status)}
                            <span className="ml-1 capitalize">{invitation.status}</span>
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                          <div className="flex items-center">
                            <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                            <span>{format(new Date(invitation.scheduled_date), 'MMM d, yyyy')}</span>
                          </div>
                          <div className="flex items-center">
                            <User className="w-4 h-4 mr-2 text-gray-400" />
                            <span>Host: {invitation.host_name}</span>
                          </div>
                          <div className="flex items-center">
                            <Building className="w-4 h-4 mr-2 text-gray-400" />
                            <span>{invitation.facility_name}</span>
                          </div>
                        </div>
                        
                        <div className="mt-2">
                          <p className="text-sm text-gray-600">
                            <strong>Purpose:</strong> {invitation.purpose}
                          </p>
                          {invitation.status === 'rejected' && invitation.rejection_reason && (
                            <p className="text-sm text-red-600 mt-1">
                              <strong>Rejected:</strong> {invitation.rejection_reason}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 ml-4">
                      {canApprove(invitation) && (
                        <LoadingButton
                          loading={isProcessing && selectedInvitation?.id === invitation.id}
                          variant="primary"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleApprove(invitation);
                          }}
                        >
                          <ThumbsUp className="w-4 h-4 mr-1" />
                          Approve
                        </LoadingButton>
                      )}
                      
                      {canReject(invitation) && (
                        <LoadingButton
                          loading={isProcessing && selectedInvitation?.id === invitation.id}
                          variant="danger"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedInvitation(invitation);
                            setShowRejectForm(true);
                            setShowDetails(true);
                          }}
                        >
                          <ThumbsDown className="w-4 h-4 mr-1" />
                          Reject
                        </LoadingButton>
                      )}

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleInvitationClick(invitation);
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
        {paginationData.pages > 1 && (
          <div className="p-6 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-500">
                Showing {((currentPage - 1) * paginationData.limit) + 1} to {Math.min(currentPage * paginationData.limit, paginationData.total)} of {paginationData.total} invitations
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
        
        {/* Pre-registration Notice for Pending Invitations */}
        {selectedInvitation?.pre_registration_required && selectedInvitation.status === 'pending' && (
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Link className="w-5 h-5 mr-2 text-blue-600" />
              Pre-registration Link
            </h3>
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <div className="flex items-center space-x-3">
                <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-yellow-800">
                    Pre-registration link will be generated after approval
                  </p>
                  <p className="text-xs text-yellow-700 mt-1">
                    Once this invitation is approved, a pre-registration link will be available to send to the visitor.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
