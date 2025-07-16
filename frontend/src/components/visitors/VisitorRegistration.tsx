import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { User, Building, Phone, Mail, Car as IdCard, AlertTriangle } from 'lucide-react';
import { useVisitors } from '../../hooks/useVisitors';
import { useCivPiv } from '../../hooks/useCivPiv';
import { useCivPiv } from '../../hooks/useCivPiv';
import { securityService } from '../../services/security';
import { LoadingButton, Loading } from '../common/Loading';
import { CivPivCardProcessor } from '../security/CivPivCardProcessor';
import { CivPivCardProcessor } from '../security/CivPivCardProcessor';
import { ID_TYPES, SECURITY_CLEARANCES } from '../../utils/constants';
import type { Visitor } from '../../types/visitor';

interface VisitorRegistrationProps {
  onVisitorCreated?: (visitor: Visitor) => void;
  onCancel?: () => void;
}

interface VisitorFormData {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  company: string;
  id_number: string;
  id_type: string;
  date_of_birth: string;
  citizenship: string;
  security_clearance: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  notes: string;
}

export const VisitorRegistration: React.FC<VisitorRegistrationProps> = ({
  onVisitorCreated,
  onCancel
}) => {
  const { user, hasAnyRole } = useAuth();
  const { 
    getVisitors, 
    createVisitor,
    loading, 
    error, 
    clearError 
  } = useVisitors();
  const {
    loading: civPivLoading,
    error: civPivError,
    clearError: clearCivPivError
  } = useCivPiv();

  const [watchlistMatches, setWatchlistMatches] = useState<any[]>([]);
  const [isScreening, setIsScreening] = useState(false);
  const [showCivPivProcessor, setShowCivPivProcessor] = useState(false);
  const [cardData, setCardData] = useState<any>(null);
  const [showCivPivProcessor, setShowCivPivProcessor] = useState(false);
  const [cardData, setCardData] = useState<any>(null);
  
  const { register, handleSubmit, watch, formState: { errors } } = useForm<VisitorFormData>({
    defaultValues: {
      id_type: 'drivers_license',
      security_clearance: 'unclassified',
      citizenship: 'US'
    }
  });

  const firstName = watch('first_name');
  const lastName = watch('last_name');
  const idNumber = watch('id_number');

  // Screen visitor against watchlist when name or ID changes
  useEffect(() => {
    if (firstName && lastName && firstName.length > 2 && lastName.length > 2) {
      screenVisitor();
    }
  }, [firstName, lastName, idNumber]);

  const handleCardProcessed = (processedCardData: any) => {
    setCardData(processedCardData);
    
    // Pre-fill form fields with card data
    setValue('first_name', processedCardData.firstName);
    setValue('last_name', processedCardData.lastName);
    setValue('id_type', 'civ_piv_i');
    setValue('id_number', processedCardData.edipi);
    
    // Close the card processor
    setShowCivPivProcessor(false);
    
    // Show success message
    setSuccessMessage('CIV/PIV card processed successfully. Form has been pre-filled with card data.');
  };

  const screenVisitor = async () => {
    if (!firstName || !lastName) return;
    
    setIsScreening(true);
    try {
      const tempVisitor = {
        first_name: firstName,
        last_name: lastName,
        id_number: idNumber
      };
      const matches = await securityService.screenVisitor(tempVisitor as Visitor);
      setWatchlistMatches(matches);
    } catch (error) {
      console.error('Failed to screen visitor:', error);
    } finally {
      setIsScreening(false);
    }
  };

  const handleCardProcessed = (processedCardData: any) => {
    setCardData(processedCardData);
    
    // Pre-fill form fields with card data
    setValue('first_name', processedCardData.firstName);
    setValue('last_name', processedCardData.lastName);
    setValue('id_type', 'civ_piv_i');
    setValue('id_number', processedCardData.edipi);
    
    // Close the card processor
    setShowCivPivProcessor(false);
    
    // Show success message
    setSuccessMessage('CIV/PIV card processed successfully. Form has been pre-filled with card data.');
  };

  const onSubmit = async (data: VisitorFormData) => {
    try {
      const visitorData = {
        ...data,
        background_check_status: 'pending',
        is_frequent_visitor: false,
        is_blacklisted: false,
        civ_piv_card_info: cardData // Include the card data if available
        civ_piv_card_info: cardData // Include the card data if available
      };

      const visitor = await createVisitor(visitorData);
      
      if (onVisitorCreated) {
        onVisitorCreated(visitor);
      }
    } catch (error) {
      console.error('Failed to create visitor:', error);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Visitor Registration</h2>
          {!showCivPivProcessor && (
            <button
              onClick={() => setShowCivPivProcessor(true)}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center"
            >
              <IdCard className="w-4 h-4 mr-1" />
              Process CIV/PIV Card
            </button>
          )}
          {!showCivPivProcessor && (
            <button
              onClick={() => setShowCivPivProcessor(true)}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center"
            >
              <IdCard className="w-4 h-4 mr-1" />
              Process CIV/PIV Card
            </button>
          )}
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

      {/* CIV/PIV Card Processor */}
      {showCivPivProcessor && (
        <div className="p-6 border-b border-gray-200">
          <CivPivCardProcessor
            onCardProcessed={handleCardProcessed}
            onCancel={() => setShowCivPivProcessor(false)}
          />
        </div>
      )}

      {/* CIV/PIV Card Processor */}
      {showCivPivProcessor && (
        <div className="p-6 border-b border-gray-200">
          <CivPivCardProcessor
            onCardProcessed={handleCardProcessed}
            onCancel={() => setShowCivPivProcessor(false)}
          />
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
        {/* Security Alerts */}
        {watchlistMatches.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-medium text-red-800">Security Alert</h3>
                <div className="mt-2 space-y-1">
                  {watchlistMatches.map((match, index) => (
                    <p key={index} className="text-sm text-red-700">
                      <strong>{match.threat_level.toUpperCase()}</strong>: {match.reason}
                    </p>
                  ))}
                </div>
                <p className="text-xs text-red-600 mt-2">
                  Security approval required before proceeding
                </p>
              </div>
            </div>
          </div>
        )}

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
                {...register('first_name', { required: 'First name is required' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {errors.first_name && (
                <p className="text-sm text-red-600 mt-1">{errors.first_name.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Last Name *
              </label>
              <input
                {...register('last_name', { required: 'Last name is required' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {errors.last_name && (
                <p className="text-sm text-red-600 mt-1">{errors.last_name.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                {...register('email')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone
              </label>
              <input
                type="tel"
                {...register('phone')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date of Birth
              </label>
              <input
                type="date"
                {...register('date_of_birth')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Citizenship
              </label>
              <input
                {...register('citizenship')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Organization Information */}
        <div className="space-y-4">
          <h3 className="text-md font-medium text-gray-900 flex items-center">
            <Building className="w-4 h-4 mr-2" />
            Organization Information
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Company/Organization
              </label>
              <input
                {...register('company')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Security Clearance
              </label>
              <select
                {...register('security_clearance')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {SECURITY_CLEARANCES.map(clearance => (
                  <option key={clearance} value={clearance}>
                    {clearance.split('_')
                        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                        .join(' ')}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Identification */}
        <div className="space-y-4">
          <h3 className="text-md font-medium text-gray-900 flex items-center">
            <IdCard className="w-4 h-4 mr-2" />
            Identification
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ID Type
              </label>
              <select
                disabled={!!cardData} // Disable if card data is present
                {...register('id_type')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {ID_TYPES.map(type => (
                  <option key={type} value={type}>
                    {type.split('_')
                        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                        .join(' ')} 
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ID Number
              </label>
              <input
                disabled={!!cardData} // Disable if card data is present
                disabled={!!cardData} // Disable if card data is present
                {...register('id_number')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          
          {/* Display card data if available */}
          {cardData && (
            <div className="mt-4 bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h4 className="text-sm font-medium text-blue-800 mb-2">CIV/PIV Card Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="font-medium text-blue-700">EDIPI:</span>
                  <span className="ml-2 text-blue-900">{cardData.edipi}</span>
                </div>
                {cardData.upn && (
                  <div>
                    <span className="font-medium text-blue-700">UPN:</span>
                    <span className="ml-2 text-blue-900">{cardData.upn}</span>
                  </div>
                )}
                {cardData.organization && (
                  <div>
                    <span className="font-medium text-blue-700">Organization:</span>
                    <span className="ml-2 text-blue-900">{cardData.organization}</span>
                  </div>
                )}
                {cardData.expirationDate && (
                  <div>
                    <span className="font-medium text-blue-700">Expiration:</span>
                    <span className="ml-2 text-blue-900">{new Date(cardData.expirationDate).toLocaleDateString()}</span>
                  </div>
                )}
                {cardData.certificateStatus && (
                  <div>
                    <span className="font-medium text-blue-700">Certificate Status:</span>
                    <span className="ml-2 text-blue-900 capitalize">{cardData.certificateStatus}</span>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Display card data if available */}
          {cardData && (
            <div className="mt-4 bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h4 className="text-sm font-medium text-blue-800 mb-2">CIV/PIV Card Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="font-medium text-blue-700">EDIPI:</span>
                  <span className="ml-2 text-blue-900">{cardData.edipi}</span>
                </div>
                {cardData.upn && (
                  <div>
                    <span className="font-medium text-blue-700">UPN:</span>
                    <span className="ml-2 text-blue-900">{cardData.upn}</span>
                  </div>
                )}
                {cardData.organization && (
                  <div>
                    <span className="font-medium text-blue-700">Organization:</span>
                    <span className="ml-2 text-blue-900">{cardData.organization}</span>
                  </div>
                )}
                {cardData.expirationDate && (
                  <div>
                    <span className="font-medium text-blue-700">Expiration:</span>
                    <span className="ml-2 text-blue-900">{new Date(cardData.expirationDate).toLocaleDateString()}</span>
                  </div>
                )}
                {cardData.certificateStatus && (
                  <div>
                    <span className="font-medium text-blue-700">Certificate Status:</span>
                    <span className="ml-2 text-blue-900 capitalize">{cardData.certificateStatus}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Emergency Contact */}
        <div className="space-y-4">
          <h3 className="text-md font-medium text-gray-900 flex items-center">
            <Phone className="w-4 h-4 mr-2" />
            Emergency Contact
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contact Name
              </label>
              <input
                {...register('emergency_contact_name')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contact Phone
              </label>
              <input
                type="tel"
                {...register('emergency_contact_phone')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Additional Notes
          </label>
          <textarea
            {...register('notes')}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Any additional information or special requirements..."
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancel
            </button>
          )}
          
          <LoadingButton
            loading={loading || isScreening}
            variant="primary"
            size="md"
          >
            {isScreening ? 'Screening...' : 'Register Visitor'}
          </LoadingButton>
        </div>
      </form>
    </div>
  );
};