import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  User, 
  Building, 
  Phone, 
  Mail, 
  Calendar, 
  Shield, 
  AlertTriangle,
  CheckCircle,
  Clock,
  Edit,
  Save,
  X,
  Eye,
  FileText,
  MapPin,
  Users,
  Badge,
  Image,
  Check,
  CreditCard as IdCard,
  XCircle
} from 'lucide-react';
import { useVisitors } from '../../hooks/useVisitors';
import { useAuth } from '../../hooks/useAuth';
import { useCivPiv } from '../../hooks/useCivPiv';
import { LoadingButton } from '../common/Loading';
import { CivPivCardProcessor } from '../security/CivPivCardProcessor';
import { CivPivCardProcessor } from '../security/CivPivCardProcessor';
import { format } from 'date-fns';

interface VisitorDetailsProps {
  visitor: any;
  onVisitorUpdated?: (visitor: any) => void;
  onBack: () => void;
}

export const VisitorDetails: React.FC<VisitorDetailsProps> = ({
  visitor,
  onVisitorUpdated,
  onBack
}) => {
  const { user } = useAuth();
  const { updateVisitor, getVisits, loading } = useVisitors();
  const { associateCardWithVisitor, loading: civPivLoading, error: civPivError } = useCivPiv();
  
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState(visitor);
  const [visits, setVisits] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('details');
  const [showImageModal, setShowImageModal] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [showCivPivProcessor, setShowCivPivProcessor] = useState(false);
  const [cardData, setCardData] = useState<any>(null);
  const [showCivPivProcessor, setShowCivPivProcessor] = useState(false);
  const [cardData, setCardData] = useState<any>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    loadVisitorVisits();
  }, [visitor.id]);

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

  const handleCardProcessed = async (processedCardData: any) => {
    setCardData(processedCardData);
    
    try {
      // Associate the card with the visitor
      const result = await associateCardWithVisitor(visitor.id, processedCardData);
      
      if (result.success) {
        setSuccessMessage('CIV/PIV card successfully associated with visitor.');
        
        // Update the edit data with card information
        setEditData(prev => ({
          ...prev,
          id_type: 'civ_piv_i',
          id_number: processedCardData.edipi,
          civ_piv_card_info: processedCardData
        }));
        
        // Close the card processor
        setShowCivPivProcessor(false);
        
        // If we're not in edit mode, update the visitor record
        if (!isEditing) {
          const updatedVisitor = await updateVisitor(visitor.id, {
            id_type: 'civ_piv_i',
            id_number: processedCardData.edipi,
            civ_piv_card_info: processedCardData
          });
          
          if (onVisitorUpdated) {
            onVisitorUpdated(updatedVisitor);
          }
        }
      } else {
        setErrorMessage(result.message || 'Failed to associate card with visitor.');
      }
    } catch (error: any) {
      setErrorMessage(error.message || 'An error occurred while processing the card.');
      console.error('Error associating card with visitor:', error);
    }
  };

  const loadVisitorVisits = async () => {
    try {
      // In a real implementation, you'd have a getVisitsByVisitor method
      // For now, we'll simulate this
      const allVisits = await getVisits();
      const visitorVisits = allVisits.filter(visit => visit.visitor_id === visitor.id);
      setVisits(visitorVisits);
    } catch (error) {
      console.error('Failed to load visitor visits:', error);
    }
  };

  const handleCardProcessed = async (processedCardData: any) => {
    setCardData(processedCardData);
    
    try {
      // Associate the card with the visitor
      const result = await associateCardWithVisitor(visitor.id, processedCardData);
      
      if (result.success) {
        setSuccessMessage('CIV/PIV card successfully associated with visitor.');
        
        // Update the edit data with card information
        setEditData(prev => ({
          ...prev,
          id_type: 'civ_piv_i',
          id_number: processedCardData.edipi,
          civ_piv_card_info: processedCardData
        }));
        
        // Close the card processor
        setShowCivPivProcessor(false);
        
        // If we're not in edit mode, update the visitor record
        if (!isEditing) {
          const updatedVisitor = await updateVisitor(visitor.id, {
            id_type: 'civ_piv_i',
            id_number: processedCardData.edipi,
            civ_piv_card_info: processedCardData
          });
          
          if (onVisitorUpdated) {
            onVisitorUpdated(updatedVisitor);
          }
        }
      } else {
        setErrorMessage(result.message || 'Failed to associate card with visitor.');
      }
    } catch (error: any) {
      setErrorMessage(error.message || 'An error occurred while processing the card.');
      console.error('Error associating card with visitor:', error);
    }
  };

  const handleSave = async () => {
    try {
      const updatedVisitor = await updateVisitor(visitor.id, editData);
      if (onVisitorUpdated) {
        onVisitorUpdated(updatedVisitor);
      }
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update visitor:', error);
    }
  };

  const handleCancel = () => {
    setEditData(visitor);
    setIsEditing(false);
  };

  const handleUpdateBackgroundCheck = async (status: string) => {
    setIsUpdatingStatus(true);
    try {
      const updatedVisitor = await updateVisitor(visitor.id, {
        background_check_status: status,
        background_check_date: new Date().toISOString()
      });
      if (onVisitorUpdated) {
        onVisitorUpdated(updatedVisitor);
      }
    } catch (error) {
      console.error('Failed to update background check status:', error);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'failed':
        return <AlertTriangle className="w-4 h-4 text-red-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-600" />;
    }
  };

  const getVisitStatusColor = (status: string) => {
    switch (status) {
      case 'checked_in':
        return 'bg-green-100 text-green-800';
      case 'checked_out':
        return 'bg-gray-100 text-gray-800';
      case 'pre_registered':
        return 'bg-blue-100 text-blue-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      case 'denied':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const canEdit = user?.role && ['admin', 'security', 'reception'].includes(user.role);
  const canUpdateBackgroundCheck = user?.role && ['admin', 'security'].includes(user.role);

  const tabs = [
    { id: 'details', label: 'Details', icon: User },
    { id: 'visits', label: 'Visit History', icon: Calendar },
    { id: 'security', label: 'Security', icon: Shield }
  ];

 // Format the photo URL to ensure it always builds correctly
const getPhotoUrl = (url: string | undefined) => {
  if (!url) return null;
  // absolute URLs pass through
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  const baseUrl = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:3001';
  // leading slash → just concat
  if (url.startsWith('/')) {
    return `${baseUrl}${url}`;
  }
  // otherwise insert a slash
  return `${baseUrl}/${url}`;
};


  const photoUrl = getPhotoUrl(visitor.photo_url);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={onBack}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-16 h-16 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-xl">
              {visitor.first_name?.[0]}{visitor.last_name?.[0]}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {visitor.first_name} {visitor.last_name}
                {visitor.civ_piv_card_info && (
                  <span className="ml-2 text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                    CIV/PIV Card
                  </span>
                )}
              </h1>
              <div className="flex items-center space-x-3 mt-1">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(visitor.background_check_status)}`}>
                  {getStatusIcon(visitor.background_check_status)}
                  <span className="ml-1 capitalize">{visitor.background_check_status}</span>
                </span>
                {visitor.is_frequent_visitor && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                    <Users className="w-3 h-3 mr-1" />
                    Frequent Visitor
                  </span>
                )}
                {visitor.is_blacklisted && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Blacklisted
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {!showCivPivProcessor && (
              <button
                onClick={() => setShowCivPivProcessor(true)}
                className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <IdCard className="w-4 h-4 mr-2" />
                Process CIV/PIV Card
              </button>
            )}
            {canEdit && !isEditing && (
              <button
                onClick={() => setShowCivPivProcessor(true)}
                className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <IdCard className="w-4 h-4 mr-2" />
                Process CIV/PIV Card
              </button>
            )}
            {canEdit && !isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </button>
            )}
            {isEditing && (
              <div className="flex items-center space-x-2">
                <LoadingButton
                  loading={loading}
                  variant="primary"
                  size="sm"
                  onClick={handleSave}
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save
                </LoadingButton>
                <button
                  onClick={handleCancel}
                  className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CIV/PIV Card Processor */}
      {showCivPivProcessor && (
        <div className="mb-6">
          <CivPivCardProcessor
            onCardProcessed={handleCardProcessed}
            onCancel={() => setShowCivPivProcessor(false)}
          />
        </div>
      )}

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

      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between">
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 mr-2" />
            <p className="font-medium">{errorMessage}</p>
          </div>
          <button 
            onClick={() => setErrorMessage(null)}
            className="text-red-700 hover:text-red-900"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* CIV/PIV Card Processor */}
      {showCivPivProcessor && (
        <div className="mb-6">
          <CivPivCardProcessor
            onCardProcessed={handleCardProcessed}
            onCancel={() => setShowCivPivProcessor(false)}
          />
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-2 border-b-2 font-medium text-sm flex items-center transition-all duration-200 ${
                    activeTab === tab.id
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'details' && (
            <div className="space-y-6">
              {/* Personal Information */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <User className="w-5 h-5 mr-2" />
                  Personal Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editData.first_name}
                        onChange={(e) => setEditData(prev => ({ ...prev, first_name: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    ) : (
                      <p className="text-gray-900">{visitor.first_name}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editData.last_name}
                        onChange={(e) => setEditData(prev => ({ ...prev, last_name: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    ) : (
                      <p className="text-gray-900">{visitor.last_name}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    {isEditing ? (
                      <input
                        type="email"
                        value={editData.email || ''}
                        onChange={(e) => setEditData(prev => ({ ...prev, email: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    ) : (
                      <p className="text-gray-900">{visitor.email || 'Not provided'}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    {isEditing ? (
                      <input
                        type="tel"
                        value={editData.phone || ''}
                        onChange={(e) => setEditData(prev => ({ ...prev, phone: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    ) : (
                      <p className="text-gray-900">{visitor.phone || 'Not provided'}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editData.company || ''}
                        onChange={(e) => setEditData(prev => ({ ...prev, company: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    ) : (
                      <p className="text-gray-900">{visitor.company || 'Not provided'}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                    {isEditing ? (
                      <input
                        type="date"
                        value={editData.date_of_birth || ''}
                        onChange={(e) => setEditData(prev => ({ ...prev, date_of_birth: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    ) : (
                      <p className="text-gray-900">
                        {visitor.date_of_birth ? format(new Date(visitor.date_of_birth), 'MMM d, yyyy') : 'Not provided'}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Identification */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <Badge className="w-5 h-5 mr-2" />
                  Identification
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ID Type</label>
                    <p className="text-gray-900 capitalize">{visitor.id_type?.replace('_', ' ') || 'Not provided'}</p>
                  </div>
                  {visitor.id_type === 'civ_piv_i' && visitor.civ_piv_card_info && (
                    <div className="md:col-span-2 mt-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">CIV/PIV Card Details</label>
                      <div className="bg-blue-50 p-3 rounded-lg">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                          {visitor.civ_piv_card_info.edipi && (
                            <div>
                              <span className="font-medium text-blue-700">EDIPI:</span>
                              <span className="ml-2 text-blue-900">{visitor.civ_piv_card_info.edipi}</span>
                            </div>
                          )}
                          {visitor.civ_piv_card_info.upn && (
                            <div>
                              <span className="font-medium text-blue-700">UPN:</span>
                              <span className="ml-2 text-blue-900">{visitor.civ_piv_card_info.upn}</span>
                            </div>
                          )}
                          {visitor.civ_piv_card_info.organization && (
                            <div>
                              <span className="font-medium text-blue-700">Organization:</span>
                              <span className="ml-2 text-blue-900">{visitor.civ_piv_card_info.organization}</span>
                            </div>
                          )}
                          {visitor.civ_piv_card_info.expirationDate && (
                            <div>
                              <span className="font-medium text-blue-700">Expiration:</span>
                              <span className="ml-2 text-blue-900">
                                {new Date(visitor.civ_piv_card_info.expirationDate).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                          {visitor.civ_piv_card_info.certificateStatus && (
                            <div>
                              <span className="font-medium text-blue-700">Certificate Status:</span>
                              <span className="ml-2 text-blue-900 capitalize">
                                {visitor.civ_piv_card_info.certificateStatus}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  {visitor.id_type === 'civ_piv_i' && visitor.civ_piv_card_info && (
                    <div className="md:col-span-2 mt-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">CIV/PIV Card Details</label>
                      <div className="bg-blue-50 p-3 rounded-lg">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                          {visitor.civ_piv_card_info.edipi && (
                            <div>
                              <span className="font-medium text-blue-700">EDIPI:</span>
                              <span className="ml-2 text-blue-900">{visitor.civ_piv_card_info.edipi}</span>
                            </div>
                          )}
                          {visitor.civ_piv_card_info.upn && (
                            <div>
                              <span className="font-medium text-blue-700">UPN:</span>
                              <span className="ml-2 text-blue-900">{visitor.civ_piv_card_info.upn}</span>
                            </div>
                          )}
                          {visitor.civ_piv_card_info.organization && (
                            <div>
                              <span className="font-medium text-blue-700">Organization:</span>
                              <span className="ml-2 text-blue-900">{visitor.civ_piv_card_info.organization}</span>
                            </div>
                          )}
                          {visitor.civ_piv_card_info.expirationDate && (
                            <div>
                              <span className="font-medium text-blue-700">Expiration:</span>
                              <span className="ml-2 text-blue-900">
                                {new Date(visitor.civ_piv_card_info.expirationDate).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                          {visitor.civ_piv_card_info.certificateStatus && (
                            <div>
                              <span className="font-medium text-blue-700">Certificate Status:</span>
                              <span className="ml-2 text-blue-900 capitalize">
                                {visitor.civ_piv_card_info.certificateStatus}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ID Number</label>
                    <p className="text-gray-900">{visitor.id_number || 'Not provided'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Citizenship</label>
                    <p className="text-gray-900">{visitor.citizenship || 'Not provided'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Security Clearance</label>
                    <p className="text-gray-900 capitalize">{visitor.security_clearance?.replace('_', ' ') || 'Unclassified'}</p>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">ID Document</label>
                    {photoUrl ? (
                      <div className="mt-2">
                        <div className="flex items-center space-x-4">
                          <img 
                            src={photoUrl} 
                            alt="ID Document" 
                            className="max-h-48 rounded cursor-pointer"
                            onClick={() => setShowImageModal(true)}
                          />
                          <button
                            onClick={() => setShowImageModal(true)}
                            className="px-3 py-1 text-sm text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md flex items-center"
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            View
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-gray-500 italic">No ID document uploaded</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Emergency Contact */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <Phone className="w-5 h-5 mr-2" />
                  Emergency Contact
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Contact Name</label>
                    <p className="text-gray-900">{visitor.emergency_contact_name || 'Not provided'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Contact Phone</label>
                    <p className="text-gray-900">{visitor.emergency_contact_phone || 'Not provided'}</p>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {visitor.notes && (
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                    <FileText className="w-5 h-5 mr-2" />
                    Notes
                  </h3>
                  <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">{visitor.notes}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'visits' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Visit History</h3>
                <span className="text-sm text-gray-500">{visits.length} total visits</span>
              </div>

              {visits.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No visits recorded</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {visits.map((visit) => (
                    <div key={visit.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getVisitStatusColor(visit.status)}`}>
                            {visit.status.replace('_', ' ').toUpperCase()}
                          </span>
                          <span className="text-sm font-medium text-gray-900">
                            {format(new Date(visit.scheduled_date), 'MMM d, yyyy')}
                          </span>
                        </div>
                        <span className="text-sm text-gray-500">
                          {visit.scheduled_start_time || 'All day'}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium text-gray-700">Purpose:</span>
                          <span className="ml-2 text-gray-600">{visit.purpose}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">Host:</span>
                          <span className="ml-2 text-gray-600">{visit.host_name || 'Not assigned'}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">Facility:</span>
                          <span className="ml-2 text-gray-600">{visit.facility_name}</span>
                        </div>
                        {visit.actual_check_in && (
                          <div>
                            <span className="font-medium text-gray-700">Check-in:</span>
                            <span className="ml-2 text-gray-600">
                              {format(new Date(visit.actual_check_in), 'HH:mm')}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <Shield className="w-5 h-5 mr-2" />
                  Security Information
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-2">Background Check Status</h4>
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(visitor.background_check_status)}
                      <span className="capitalize">{visitor.background_check_status}</span>
                    </div>
                    {visitor.background_check_date && (
                      <p className="text-sm text-gray-500 mt-1">
                        Completed: {format(new Date(visitor.background_check_date), 'MMM d, yyyy')}
                      </p>
                    )}
                    
                    {/* Manual Background Check Status Update */}
                    {canUpdateBackgroundCheck && (
                      <div className="mt-4 border-t border-gray-200 pt-4">
                        <h5 className="text-sm font-medium text-gray-700 mb-2">Update Background Check Status</h5>
                        <div className="flex flex-wrap gap-2">
                          <LoadingButton
                            loading={isUpdatingStatus}
                            variant="primary"
                            size="sm"
                            onClick={() => handleUpdateBackgroundCheck('approved')}
                          >
                            <Check className="w-4 h-4 mr-1" />
                            Approve
                          </LoadingButton>
                          
                          <LoadingButton
                            loading={isUpdatingStatus}
                            variant="danger"
                            size="sm"
                            onClick={() => handleUpdateBackgroundCheck('failed')}
                          >
                            <X className="w-4 h-4 mr-1" />
                            Reject
                          </LoadingButton>
                          
                          <LoadingButton
                            loading={isUpdatingStatus}
                            variant="secondary"
                            size="sm"
                            onClick={() => handleUpdateBackgroundCheck('pending')}
                          >
                            <Clock className="w-4 h-4 mr-1" />
                            Mark Pending
                          </LoadingButton>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-2">Security Flags</h4>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Frequent Visitor</span>
                        <span className={`text-sm font-medium ${visitor.is_frequent_visitor ? 'text-green-600' : 'text-gray-400'}`}>
                          {visitor.is_frequent_visitor ? 'Yes' : 'No'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Blacklisted</span>
                        <span className={`text-sm font-medium ${visitor.is_blacklisted ? 'text-red-600' : 'text-green-600'}`}>
                          {visitor.is_blacklisted ? 'Yes' : 'No'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-3">Registration Details</h4>
                <div className="bg-gray-50 p-4 rounded-lg space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Registered:</span>
                    <span className="text-gray-900">{format(new Date(visitor.created_at), 'MMM d, yyyy HH:mm')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Last Updated:</span>
                    <span className="text-gray-900">{format(new Date(visitor.updated_at), 'MMM d, yyyy HH:mm')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Visits:</span>
                    <span className="text-gray-900">{visits.length}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Image Modal */}
      {showImageModal && photoUrl && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900">ID Document</h3>
              <button 
                onClick={() => setShowImageModal(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 flex-1 overflow-auto flex items-center justify-center">
              <img 
                src={photoUrl} 
                alt="ID Document" 
                className="max-w-full max-h-[70vh] object-contain"
              />
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setShowImageModal(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};