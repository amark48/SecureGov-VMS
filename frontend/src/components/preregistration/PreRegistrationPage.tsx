import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { 
  User, 
  Building, 
  Calendar, 
  Clock, 
  Shield, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Mail,
  Phone,
  CreditCard,
  Globe,
  FileText,
  Info,
  Camera,
  Upload,
  Image,
  X
} from 'lucide-react';
import { useInvitation } from '../../hooks/useInvitation';
import { LoadingButton, Loading } from '../common/Loading';
import { format } from 'date-fns';
import { ID_TYPES } from '../../utils/constants';

interface PreRegistrationFormData {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  company: string;
  id_number: string;
  id_type: string;
  date_of_birth: string;
  citizenship: string;
  nationality: string;
  ssn: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
}

export const PreRegistrationPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { getPreRegistrationDetails, submitPreRegistration, loading } = useInvitation();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [invitation, setInvitation] = useState<any>(null);
  const [idImage, setIdImage] = useState<File | null>(null);
  const [idImagePreview, setIdImagePreview] = useState<string | null>(null);
  const [useCameraForId, setUseCameraForId] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  
  const { register, handleSubmit, setValue, formState: { errors }, watch } = useForm<PreRegistrationFormData>();
  const selectedIdType = watch('id_type');

  useEffect(() => {
    if (!token) {
      setError('Invalid pre-registration link');
      return;
    }

    loadInvitationDetails();

    // Clean up camera stream when component unmounts
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [token]);

  const loadInvitationDetails = async () => {
    try {
      const response = await getPreRegistrationDetails(token!);
      setInvitation(response.invitation);
      
      // Pre-populate form with visitor data if available
      if (response.invitation.visitor) {
        const visitor = response.invitation.visitor;
        setValue('first_name', visitor.first_name);
        setValue('last_name', visitor.last_name);
        setValue('email', visitor.email || '');
        setValue('phone', visitor.phone || '');
        setValue('company', visitor.company || '');
        setValue('id_type', visitor.id_type || '');
        setValue('id_number', visitor.id_number || '');
        setValue('date_of_birth', visitor.date_of_birth ? new Date(visitor.date_of_birth).toISOString().split('T')[0] : '');
        setValue('citizenship', visitor.citizenship || '');
        setValue('nationality', visitor.nationality || '');
        setValue('ssn', visitor.ssn || '');
        setValue('emergency_contact_name', visitor.emergency_contact_name || '');
        setValue('emergency_contact_phone', visitor.emergency_contact_phone || '');
      }
    } catch (error: any) {
      setError(error.message || 'Failed to load invitation details');
    }
  };

  const startCamera = async () => {
    try {
      if (videoRef.current) {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' } 
        });
        videoRef.current.srcObject = stream;
        setCameraStream(stream);
        setUseCameraForId(true);
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      setError('Could not access camera. Please check permissions or use file upload instead.');
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setUseCameraForId(false);
  };

  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // Draw the video frame to the canvas
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convert canvas to blob
        canvas.toBlob((blob) => {
          if (blob) {
            // Create a File object from the blob
            const file = new File([blob], `id-capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
            setIdImage(file);
            
            // Create a preview URL
            const previewUrl = URL.createObjectURL(blob);
            setIdImagePreview(previewUrl);
            
            // Stop the camera
            stopCamera();
          }
        }, 'image/jpeg', 0.95);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      setIdImage(file);
      
      // Create a preview URL
      const previewUrl = URL.createObjectURL(file);
      setIdImagePreview(previewUrl);
    }
  };

  const clearIdImage = () => {
    if (idImagePreview) {
      URL.revokeObjectURL(idImagePreview);
    }
    setIdImage(null);
    setIdImagePreview(null);
  };

  const onSubmit = async (data: PreRegistrationFormData) => {
    if (!token) {
      setError('Invalid pre-registration link');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Create FormData if we have an ID image
      if (idImage) {
        const formData = new FormData();
        
        // Add all form fields to FormData
        Object.entries(data).forEach(([key, value]) => {
          if (value) formData.append(key, value);
        });
        
        // Add the ID image
        formData.append('id_image', idImage);
        
        await submitPreRegistration(token, formData);
      } else {
        // Submit without image
        await submitPreRegistration(token, data);
      }
      
      setSuccess(true);
      window.scrollTo(0, 0);
    } catch (error: any) {
      setError(error.message || 'Failed to submit pre-registration');
      window.scrollTo(0, 0);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !invitation) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loading message="Loading pre-registration details..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Pre-registration Error</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Return to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Pre-registration Complete</h2>
            <p className="text-gray-600 mb-6">
              Thank you for completing your pre-registration. Your information has been saved and your visit has been confirmed.
            </p>
            <div className="bg-blue-50 rounded-lg p-4 text-left mb-6">
              <div className="flex items-center space-x-2 mb-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">Visit Details</span>
              </div>
              <p className="text-sm text-blue-700">
                <strong>Date:</strong> {format(new Date(invitation.scheduled_date), 'EEEE, MMMM d, yyyy')}
              </p>
              {invitation.scheduled_start_time && (
                <p className="text-sm text-blue-700">
                  <strong>Time:</strong> {invitation.scheduled_start_time}
                  {invitation.scheduled_end_time && ` - ${invitation.scheduled_end_time}`}
                </p>
              )}
              <p className="text-sm text-blue-700">
                <strong>Host:</strong> {invitation.host_name}
              </p>
              <p className="text-sm text-blue-700">
                <strong>Facility:</strong> {invitation.facility_name}
              </p>
              <p className="text-sm text-blue-700">
                <strong>Purpose:</strong> {invitation.purpose}
              </p>
            </div>
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Return to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-lg shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-8 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">Visitor Pre-Registration</h1>
                <p className="text-blue-100 mt-1">
                  Please complete this form to confirm your upcoming visit
                </p>
              </div>
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                <Shield className="w-8 h-8 text-white" />
              </div>
            </div>
          </div>

          {/* Visit Information */}
          <div className="px-6 py-4 bg-blue-50 border-b border-blue-100">
            <div className="flex items-center space-x-2 mb-2">
              <Info className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-medium text-blue-800">Visit Information</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-600">
                  <span className="font-medium text-gray-700">Date:</span> {format(new Date(invitation.scheduled_date), 'EEEE, MMMM d, yyyy')}
                </p>
                {invitation.scheduled_start_time && (
                  <p className="text-gray-600">
                    <span className="font-medium text-gray-700">Time:</span> {invitation.scheduled_start_time}
                    {invitation.scheduled_end_time && ` - ${invitation.scheduled_end_time}`}
                  </p>
                )}
              </div>
              <div>
                <p className="text-gray-600">
                  <span className="font-medium text-gray-700">Host:</span> {invitation.host_name}
                </p>
                <p className="text-gray-600">
                  <span className="font-medium text-gray-700">Facility:</span> {invitation.facility_name}
                </p>
                <p className="text-gray-600">
                  <span className="font-medium text-gray-700">Purpose:</span> {invitation.purpose}
                </p>
              </div>
            </div>
          </div>

          {/* Registration Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
            {/* Personal Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <User className="w-5 h-5 mr-2 text-blue-600" />
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
                    readOnly={invitation.visitor?.first_name ? true : false}
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
                    readOnly={invitation.visitor?.last_name ? true : false}
                  />
                  {errors.last_name && (
                    <p className="text-sm text-red-600 mt-1">{errors.last_name.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email *
                  </label>
                  <div className="flex items-center">
                    <Mail className="w-4 h-4 text-gray-400 absolute ml-3" />
                    <input
                      type="email"
                      {...register('email', { 
                        required: 'Email is required',
                        pattern: {
                          value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                          message: 'Invalid email address'
                        }
                      })}
                      className="w-full pl-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      readOnly={invitation.visitor?.email ? true : false}
                    />
                  </div>
                  {errors.email && (
                    <p className="text-sm text-red-600 mt-1">{errors.email.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone *
                  </label>
                  <div className="flex items-center">
                    <Phone className="w-4 h-4 text-gray-400 absolute ml-3" />
                    <input
                      type="tel"
                      {...register('phone', { required: 'Phone number is required' })}
                      className="w-full pl-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  {errors.phone && (
                    <p className="text-sm text-red-600 mt-1">{errors.phone.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Company
                  </label>
                  <div className="flex items-center">
                    <Building className="w-4 h-4 text-gray-400 absolute ml-3" />
                    <input
                      {...register('company')}
                      className="w-full pl-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
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
              </div>
            </div>

            {/* Identification */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <CreditCard className="w-5 h-5 mr-2 text-blue-600" />
                Identification
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ID Type *
                  </label>
                  <select
                    {...register('id_type', { required: 'ID type is required' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select ID Type</option>
                    {ID_TYPES.map(type => (
                      <option key={type} value={type}>
                        {type.replace('_', ' ').toUpperCase()}
                      </option>
                    ))}
                  </select>
                  {errors.id_type && (
                    <p className="text-sm text-red-600 mt-1">{errors.id_type.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ID Number *
                  </label>
                  <input
                    {...register('id_number', { required: 'ID number is required' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {errors.id_number && (
                    <p className="text-sm text-red-600 mt-1">{errors.id_number.message}</p>
                  )}
                </div>
              </div>

              {/* ID Document Upload/Capture Section */}
              {selectedIdType && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h4 className="text-md font-medium text-gray-900 mb-3 flex items-center">
                    <Image className="w-4 h-4 mr-2 text-blue-600" />
                    Upload ID Document
                  </h4>
                  
                  {!idImagePreview && !useCameraForId ? (
                    <div className="space-y-4">
                      <p className="text-sm text-gray-600">
                        Please upload or take a photo of your {selectedIdType.replace('_', ' ')}
                      </p>
                      
                      <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
                        <div className="flex-1">
                          <label className="flex justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer">
                            <Upload className="w-5 h-5 mr-2" />
                            <span>Upload ID Image</span>
                            <input 
                              type="file" 
                              className="hidden" 
                              accept="image/*"
                              onChange={handleFileChange}
                            />
                          </label>
                        </div>
                        
                        <div className="flex-1">
                          <button
                            type="button"
                            onClick={startCamera}
                            className="w-full flex justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                          >
                            <Camera className="w-5 h-5 mr-2" />
                            <span>Take Photo</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                  
                  {/* Camera View */}
                  {useCameraForId && (
                    <div className="space-y-4">
                      <div className="relative">
                        <video 
                          ref={videoRef} 
                          autoPlay 
                          playsInline 
                          className="w-full h-auto rounded-lg border border-gray-300"
                        />
                        <canvas ref={canvasRef} className="hidden" />
                      </div>
                      
                      <div className="flex justify-center space-x-3">
                        <button
                          type="button"
                          onClick={captureImage}
                          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
                        >
                          <Camera className="w-4 h-4 mr-2" />
                          Capture
                        </button>
                        <button
                          type="button"
                          onClick={stopCamera}
                          className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 flex items-center"
                        >
                          <XCircle className="w-4 h-4 mr-2" />
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {/* Image Preview */}
                  {idImagePreview && (
                    <div className="space-y-4">
                      <div className="relative">
                        <img 
                          src={idImagePreview} 
                          alt="ID Preview" 
                          className="max-w-full h-auto rounded-lg border border-gray-300"
                        />
                      </div>
                      
                      <div className="flex justify-center">
                        <button
                          type="button"
                          onClick={clearIdImage}
                          className="px-4 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 flex items-center"
                        >
                          <XCircle className="w-4 h-4 mr-2" />
                          Remove Image
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Citizenship
                  </label>
                  <div className="flex items-center">
                    <Globe className="w-4 h-4 text-gray-400 absolute ml-3" />
                    <input
                      {...register('citizenship')}
                      className="w-full pl-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., United States"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nationality
                  </label>
                  <input
                    {...register('nationality')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., American"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    SSN (Last 4 digits)
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    pattern="[0-9]{4}"
                    {...register('ssn')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Last 4 digits only"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Required for government facility access
                  </p>
                </div>
              </div>
            </div>

            {/* Emergency Contact */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <Phone className="w-5 h-5 mr-2 text-blue-600" />
                Emergency Contact
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Emergency Contact Name
                  </label>
                  <input
                    {...register('emergency_contact_name')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Emergency Contact Phone
                  </label>
                  <input
                    type="tel"
                    {...register('emergency_contact_phone')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Privacy Notice */}
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <div className="flex items-center space-x-2 mb-2">
                <Shield className="w-5 h-5 text-blue-600" />
                <h3 className="text-md font-medium text-gray-900">Privacy Notice</h3>
              </div>
              <p className="text-sm text-gray-600 mb-2">
                The information you provide will be used solely for the purpose of your visit and security screening. Your data will be handled in accordance with our privacy policy and applicable regulations.
              </p>
              <p className="text-sm text-gray-600">
                By submitting this form, you consent to the processing of your personal information for visitor management purposes.
              </p>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end">
              <LoadingButton
                loading={submitting}
                variant="primary"
                size="lg"
                type="submit"
              >
                <CheckCircle className="w-5 h-5 mr-2" />
                Complete Pre-Registration
              </LoadingButton>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};