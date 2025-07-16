import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  RefreshCw, 
  Shield, 
  User, 
  Calendar, 
  Building,
  Key
} from 'lucide-react';
import { useCivPiv } from '../../hooks/useCivPiv';
import { LoadingButton } from '../common/Loading';
import { format } from 'date-fns';

interface CivPivCardProcessorProps {
  onCardProcessed: (cardData: any) => void;
  onCancel: () => void;
}

export const CivPivCardProcessor: React.FC<CivPivCardProcessorProps> = ({
  onCardProcessed,
  onCancel
}) => {
  const { 
    validateCard, 
    simulateCardRead, 
    loading, 
    error, 
    clearError 
  } = useCivPiv();
  
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [cardData, setCardData] = useState<any>(null);
  const [manualEntry, setManualEntry] = useState(false);
  const [formData, setFormData] = useState({
    edipi: '',
    upn: '',
    firstName: '',
    lastName: '',
    organization: '',
    expirationDate: ''
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
      const timer = setTimeout(() => clearError(), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleSimulateCardRead = async () => {
    try {
      const result = await simulateCardRead();
      
      if (result.success && result.cardData) {
        setCardData(result.cardData);
        setSuccessMessage('Card read successfully');
      } else {
        // Error is already set by the hook
        console.error('Failed to read card:', result.errorMessage);
      }
    } catch (err: any) {
      // Error is already set by the hook
      console.error('Error in handleSimulateCardRead:', err);
    }
  };

  const handleManualValidate = async () => {
    try {
      // Validate required fields
      if (!formData.edipi) {
        throw new Error('EDIPI is required');
      }
      
      if (!formData.firstName || !formData.lastName) {
        throw new Error('First and last name are required');
      }
      
      // Call the validate endpoint
      const result = await validateCard({
        edipi: formData.edipi,
        upn: formData.upn || undefined
      });
      
      if (result.isValid) {
        // Create card data object from form data and validation result
        const validatedCardData = {
          edipi: formData.edipi,
          upn: formData.upn || undefined,
          firstName: formData.firstName,
          lastName: formData.lastName,
          organization: formData.organization || undefined,
          expirationDate: formData.expirationDate || undefined,
          certificateStatus: result.certificateStatus || 'valid'
        };
        
        setCardData(validatedCardData);
        setSuccessMessage('Card validated successfully');
      } else {
        // Error is already set by the hook
        console.error('Card validation failed:', result.errorMessage);
      }
    } catch (err: any) {
      // Error is already set by the hook
      console.error('Error in handleManualValidate:', err);
    }
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = () => {
    if (cardData) {
      onCardProcessed(cardData);
    } else {
      setError('No valid card data available');
    }
  };

  const getCertificateStatusColor = (status?: string) => {
    switch (status) {
      case 'valid':
        return 'text-green-600';
      case 'expired':
        return 'text-orange-600';
      case 'revoked':
      case 'invalid':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getCertificateStatusIcon = (status?: string) => {
    switch (status) {
      case 'valid':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'expired':
        return <Calendar className="w-4 h-4 text-orange-600" />;
      case 'revoked':
      case 'invalid':
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return <Shield className="w-4 h-4 text-gray-600" />;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center">
          <CreditCard className="w-5 h-5 mr-2 text-blue-600" />
          CIV/PIV Card Processing
        </h2>
      </div>

      {/* Success/Error Messages */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center justify-between mb-4">
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

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between mb-4">
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 mr-2" />
            <p className="font-medium">{error}</p>
          </div>
          <button 
            onClick={() => setError(null)}
            className="text-red-700 hover:text-red-900"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Card Reader Section */}
      {!manualEntry && !cardData && (
        <div className="space-y-6">
          <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
            <div className="flex items-center justify-center mb-6">
              <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center">
                <CreditCard className="w-12 h-12 text-blue-600" />
              </div>
            </div>
            
            <p className="text-center text-gray-600 mb-6">
              Please insert a CIV/PIV card into the reader or click the button below to simulate a card read.
            </p>
            
            <div className="flex justify-center">
              <LoadingButton
                loading={loading}
                variant="primary"
                size="lg"
                onClick={handleSimulateCardRead}
              >
                <RefreshCw className="w-5 h-5 mr-2" />
                Simulate Card Read
              </LoadingButton>
            </div>
            
            <div className="text-center mt-4">
              <button
                onClick={() => setManualEntry(true)}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Enter card details manually
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Entry Form */}
      {manualEntry && !cardData && (
        <div className="space-y-6">
          <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
            <h3 className="text-md font-medium text-gray-900 mb-4">Manual Card Entry</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  EDIPI (Electronic Data Interchange Personal Identifier) *
                </label>
                <input
                  type="text"
                  name="edipi"
                  value={formData.edipi}
                  onChange={handleFormChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., 1234567890"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  UPN (User Principal Name)
                </label>
                <input
                  type="text"
                  name="upn"
                  value={formData.upn}
                  onChange={handleFormChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., john.doe@mail.mil"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First Name *
                </label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleFormChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="First Name"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name *
                </label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleFormChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Last Name"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Organization
                </label>
                <input
                  type="text"
                  name="organization"
                  value={formData.organization}
                  onChange={handleFormChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Department of Defense"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expiration Date
                </label>
                <input
                  type="date"
                  name="expirationDate"
                  value={formData.expirationDate}
                  onChange={handleFormChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            
            <div className="flex justify-between">
              <button
                onClick={() => setManualEntry(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Back to Card Reader
              </button>
              
              <LoadingButton
                loading={loading}
                variant="primary"
                size="md"
                onClick={handleManualValidate}
              >
                Validate Card
              </LoadingButton>
            </div>
          </div>
        </div>
      )}

      {/* Card Data Display */}
      {cardData && (
        <div className="space-y-6">
          <div className="bg-green-50 p-6 rounded-lg border border-green-200">
            <div className="flex items-center mb-4">
              <CheckCircle className="w-6 h-6 text-green-600 mr-2" />
              <h3 className="text-lg font-medium text-green-800">Card Processed Successfully</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  EDIPI
                </label>
                <div className="flex items-center">
                  <Key className="w-4 h-4 text-gray-400 mr-2" />
                  <p className="text-gray-900 font-mono">{cardData.edipi}</p>
                </div>
              </div>
              
              {cardData.upn && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    UPN
                  </label>
                  <p className="text-gray-900">{cardData.upn}</p>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <div className="flex items-center">
                  <User className="w-4 h-4 text-gray-400 mr-2" />
                  <p className="text-gray-900">{cardData.firstName} {cardData.lastName}</p>
                </div>
              </div>
              
              {cardData.organization && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Organization
                  </label>
                  <div className="flex items-center">
                    <Building className="w-4 h-4 text-gray-400 mr-2" />
                    <p className="text-gray-900">{cardData.organization}</p>
                  </div>
                </div>
              )}
              
              {cardData.expirationDate && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Expiration Date
                  </label>
                  <div className="flex items-center">
                    <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                    <p className="text-gray-900">
                      {format(new Date(cardData.expirationDate), 'MMMM d, yyyy')}
                    </p>
                  </div>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Certificate Status
                </label>
                <div className="flex items-center">
                  {getCertificateStatusIcon(cardData.certificateStatus)}
                  <p className={`ml-2 capitalize ${getCertificateStatusColor(cardData.certificateStatus)}`}>
                    {cardData.certificateStatus || 'Unknown'}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex justify-between">
              <button
                onClick={() => {
                  setCardData(null);
                  setManualEntry(false);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Start Over
              </button>
              
              <LoadingButton
                loading={loading}
                variant="primary"
                size="md"
                onClick={handleSubmit}
              >
                Use Card Data
              </LoadingButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};