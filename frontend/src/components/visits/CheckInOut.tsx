import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  UserCheck,
  UserPlus,
  Shield,
  Clipboard,
  CheckCircle,
  Clock,
  XCircle,
  Bell,
  Users,
  Calendar,
  RefreshCw,
  AlertTriangle,
  QrCode,
  Camera,
  Scan,
  Info,
  User,
  Building,
  Phone,
  Mail,
  MapPin,
  Download,
  Printer,
  Car,
  Briefcase,
  Map,
  CreditCard
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTenant } from '../../hooks/useTenant';
import { LoadingButton, Loading } from '../common/Loading';
import { ConfirmationModal } from '../common/ConfirmationModal';
import { BadgePrinting } from './BadgePrinting';
import { useVisitors } from '../../hooks/useVisitors';
import { format } from 'date-fns';
import { BrowserQRCodeReader } from '@zxing/library';
import { PhotoCaptureModal } from '../common/PhotoCaptureModal'; // Import PhotoCaptureModal
import { getAbsoluteUrl } from '../../utils/urlUtils'; // Import getAbsoluteUrl
import type { Invitation } from '../../types/invitation'; // Import Invitation type
import type { Visit } from '../../types/visitor'; // Import Visit type

interface CheckInOutProps {
  onVisitorCheckedIn?: (visit: any) => void;
  onVisitorCheckedOut?: (visit: any) => void;
}

export const CheckInOut: React.FC<CheckInOutProps> = ({
  onVisitorCheckedIn,
  onVisitorCheckedOut
}) => {
  const { user, hasAnyRole } = useAuth();
  const { tenant } = useTenant();
  const {
    getTodaysVisits,
    checkInVisitor,
    checkOutVisitor,
    getVisitDetailsByQrToken, // Ensure this is correctly destructured
    qrCheckInVisitor,
    createBadge,
    visitsLoading,
    visitsError,
    clearError
  } = useVisitors();

  const [todaysVisits, setTodaysVisits] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVisit, setSelectedVisit] = useState<any>(null);
  const [checkingInVisitId, setCheckingInVisitId] = useState<string | null>(null);
  const [checkingOutVisitId, setCheckingOutVisitId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // QR Code Scanner State
  const videoRef = useRef<HTMLVideoElement>(null);
  const codeReader = useRef<BrowserQRCodeReader | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [qrCodeData, setQrCodeData] = useState<string | null>(null); // This will hold the extracted UUID
  const [originalQrToken, setOriginalQrToken] = useState<string | null>(null); // Stores the raw QR token for check-in
  const [qrScanError, setQrScanError] = useState<string | null>(null);
  const [scanningStatus, setScanningStatus] = useState('Ready to scan');
  const [validatedVisitDetails, setValidatedVisitDetails] = useState<Invitation | Visit | null>(null); // Holds Invitation or Visit details for modal
  const [showQrCheckInModal, setShowQrCheckInModal] = useState(false);
  const [showBadgePrintingModal, setShowBadgePrintingModal] = useState(false);
  const [printedBadge, setPrintedBadge] = useState<any>(null);
  const [selectedBadgeType, setSelectedBadgeType] = useState<'printed' | 'civ_piv_i'>('printed');

  // Photo Capture State
  const [showPhotoCaptureModal, setShowPhotoCaptureModal] = useState(false);
  const [capturedPhotoFile, setCapturedPhotoFile] = useState<File | null>(null);
  const [capturedPhotoPreview, setCapturedPhotoPreview] = useState<string | null>(null);


  // Clear messages after 5 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  useEffect(() => {
    loadTodaysVisits();
    
    // Get the tenant's default badge type or use 'printed' as fallback
    const defaultBadgeType = tenant?.default_badge_type || 'printed';
    setSelectedBadgeType(defaultBadgeType);
    
    // Auto-refresh every 2 minutes
    const interval = setInterval(() => {
      loadTodaysVisits();
    }, 120000);

    return () => clearInterval(interval);
  }, []);

  // Effect to trigger confirmation modal when validatedVisitDetails is set
  useEffect(() => {
    if (validatedVisitDetails) {
      setShowQrCheckInModal(true);
    }
  }, [validatedVisitDetails]);

  const loadTodaysVisits = async () => {
    try {
      setErrorMessage(null);
      const response = await getTodaysVisits();
      setTodaysVisits(response.visits);
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to load today\'s visits');
      console.error('Failed to load today\'s visits:', error);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const filteredVisits = todaysVisits.filter(visit =>
    visit.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    visit.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    visit.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    visit.purpose?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCheckIn = async (visit: any) => {
    setCheckingInVisitId(visit.id);
    try {
      const result = await checkInVisitor(visit.id, 'Reception Desk');
      setSuccessMessage(`${visit.first_name} ${visit.last_name} checked in successfully`);
      await loadTodaysVisits();
      if (onVisitorCheckedIn) {
        onVisitorCheckedIn(result);
      }
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to check in visitor');
      console.error('Failed to check in visitor:', error);
    } finally {
      setCheckingInVisitId(null);
    }
  };

  const handleCheckOut = async (visit: any) => {
    setCheckingOutVisitId(visit.id);
    try {
      const result = await checkOutVisitor(visit.id, 'Reception Desk');
      setSuccessMessage(`${visit.first_name} ${visit.last_name} checked out successfully`);
      await loadTodaysVisits();
      if (onVisitorCheckedOut) {
        onVisitorCheckedOut(result);
      }
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to check out visitor');
      console.error('Failed to check out visitor:', error);
    } finally {
      setCheckingOutVisitId(null);
    }
  };

  // Wrap stopScanning in useCallback
  const stopScanning = useCallback(() => {
    codeReader.current?.reset();
    setIsScanning(false);
    setScanningStatus('Scanner stopped');
  }, [codeReader, setIsScanning, setScanningStatus]);

  // Wrap handleQrCodeDecoded in useCallback
  const handleQrCodeDecoded = useCallback(async (result: any) => {
    if (!result) {
      return;
    }
    setQrScanError(null);
    
    let extractedToken = null;
    try {
      // Attempt to parse the QR code data as a URL and extract the 'token' parameter
      const url = new URL(result.getText());
      extractedToken = url.searchParams.get('token');
      if (!extractedToken) {
        // If it's a URL but no token param, or not a URL, assume the raw text is the token
        extractedToken = result.getText();
      }
    } catch (e) {
      // If parsing as URL fails, assume the raw text is the token
      extractedToken = result.getText();
    }

    setQrCodeData(extractedToken); // Store the extracted token for display
    setOriginalQrToken(extractedToken); // Store the original QR token for check-in

    try {
      console.log('Validating QR code for token:', extractedToken);
      // Call getVisitDetailsByQrToken to get the visit details (which are Invitation details from this endpoint)
      const details = await getVisitDetailsByQrToken(extractedToken); // This returns an Invitation object
      
      if (details) {
        setValidatedVisitDetails(details); // Set the Invitation object to trigger the modal
        setScanningStatus('QR code validated successfully! Confirm check-in.');
      } else {
        setQrScanError('QR code validation returned no visit data.');
        setScanningStatus('QR code validation failed.');
      }
    } catch (error: any) {
      console.error('QR Validation Error:', error);
      setQrScanError(error.message || 'Invalid QR code or validation failed.');
      setScanningStatus('QR code validation failed.');
    } finally {
      // Ensure scanner stops after validation attempt
      stopScanning();
    }
  }, [getVisitDetailsByQrToken, setQrCodeData, setOriginalQrToken, setQrScanError, setValidatedVisitDetails, setScanningStatus, stopScanning]);

  // Wrap startScanning in useCallback
  const startScanning = useCallback(async () => {
    setQrCodeData(null);
    setOriginalQrToken(null); // Clear original QR token on new scan
    setQrScanError(null); // Clear QR scan error at the start of scanning
    setValidatedVisitDetails(null); // Clear previous validation
    setShowQrCheckInModal(false); // Hide modal if it was open
    setScanningStatus('Starting scanner...');
    setIsScanning(true);

    try {
      codeReader.current = new BrowserQRCodeReader();
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoInputDevices = allDevices.filter(device => device.kind === 'videoinput');

      if (videoInputDevices.length === 0) {
        throw new Error('No video input devices found. Please ensure a camera is connected.');
      }

      const selectedDeviceId = videoInputDevices[0].deviceId;

      codeReader.current.decodeFromVideoDevice(selectedDeviceId, videoRef.current!, (result, err) => {
        if (result) {
          codeReader.current?.reset();
          setIsScanning(false);
          handleQrCodeDecoded(result); // This callback needs a stable handleQrCodeDecoded
        }
        if (err && !err.toString().includes('NotFoundException')) {
          setQrScanError(err.message);
          setScanningStatus('Error during scan');
          console.error('QR Scan Error:', err);
        }
      });
      setScanningStatus('Scanning for QR code...');
    } catch (err: any) {
      setIsScanning(false);
      setQrScanError(err.message || 'Failed to start scanner');
      setScanningStatus('Scanner failed to start');
      console.error('Scanner Init Error:', err);
    }
  }, [codeReader, setIsScanning, setScanningStatus, setQrCodeData, setOriginalQrToken, setQrScanError, setValidatedVisitDetails, setShowQrCheckInModal, handleQrCodeDecoded]);

  const handleConfirmQrCheckIn = async (details: Invitation | Visit) => { // Parameter can be Invitation or Visit
    setShowQrCheckInModal(false); // Close the confirmation modal
    
    // Use the original QR token for check-in, not the invitation_id
    if (!originalQrToken) {
      setErrorMessage('Original QR token not found. Please scan again.');
      return;
    }

    setCheckingInVisitId(originalQrToken); // Use originalQrToken for loading state
    setErrorMessage(null);
    setSuccessMessage(null);

    // Use the selected badge type for check-in
    // Get the tenant's default badge type or use 'printed' as fallback
    const defaultBadgeType = tenant?.default_badge_type || 'printed';
    setSelectedBadgeType(defaultBadgeType);

    try {
      // Call qrCheckInVisitor with the original QR token
      const checkInResult = await qrCheckInVisitor(originalQrToken, 'Reception Desk', selectedBadgeType);
      
      if (checkInResult && checkInResult.visit) {
        setValidatedVisitDetails(checkInResult.visit); // Update to the actual Visit object for badge printing
        setPrintedBadge(checkInResult.badge); // Set the Badge object
        setSuccessMessage(`${checkInResult.visit.first_name} ${checkInResult.visit.last_name} checked in successfully via QR code.`);
        setShowBadgePrintingModal(true); // Show badge printing modal
        await loadTodaysVisits(); // Refresh the list of visits
        if (onVisitorCheckedIn) {
          onVisitorCheckedIn(checkInResult.visit);
        }
      } else {
        setErrorMessage('QR check-in returned no visit data after processing.');
      }
    } catch (error: any) {
      console.error('QR Check-in Error:', error);
      setErrorMessage(error.message || 'Failed to check in visitor via QR code.');
    } finally {
      setCheckingInVisitId(null);
      setQrCodeData(null);
      setOriginalQrToken(null); // Clear original QR token after check-in attempt
      setQrScanError(null);
      // validatedVisitDetails is handled by the badge printing modal's onClose
      setScanningStatus('Ready to scan');
    }
  };

  const handlePhotoCaptured = useCallback((imageFile: File) => {
    setCapturedPhotoFile(imageFile);
    setCapturedPhotoPreview(URL.createObjectURL(imageFile));
    setShowPhotoCaptureModal(false);
    setSuccessMessage('Photo captured successfully! It will be associated with the visitor upon check-in.');
    // Note: The captured photo is not automatically sent to the backend with check-in.
    // This would require a separate API call or modification to the check-in endpoint.
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'checked_in':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'checked_out':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'pre_registered':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'denied':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'checked_in':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'checked_out':
        return <UserCheck className="w-4 h-4 text-gray-600" />;
      case 'pre_registered':
        return <Clock className="w-4 h-4 text-blue-600" />;
      case 'cancelled':
      case 'denied':
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-600" />;
    }
  };

  const canCheckIn = (visit: any) => {
    return visit.status === 'pre_registered' && hasAnyRole(['admin', 'security', 'reception']);
  };

  const canCheckOut = (visit: any) => {
    return visit.status === 'checked_in' && hasAnyRole(['admin', 'security', 'reception']);
  };

  return (
    <div className="space-y-6">
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

      {(errorMessage || visitsError) && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between">
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 mr-2" />
            <p className="font-medium">{errorMessage || visitsError}</p>
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

      {/* QR Code Scanner Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center">
            <QrCode className="w-5 h-5 mr-2 text-indigo-600" />
            QR Code Check-in
          </h2>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">{scanningStatus}</span>
            {visitsLoading && <Loader className="w-4 h-4 animate-spin text-indigo-600" />}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col items-center justify-center bg-gray-100 rounded-lg p-4 min-h-[200px]">
            {isScanning ? (
              <video ref={videoRef} className="w-full h-full object-cover rounded-lg" />
            ) : (
              <div className="text-center text-gray-500">
                <Scan className="w-16 h-16 mx-auto mb-4" />
                <p>Click "Start Scan" to activate camera</p>
              </div>
            )}
          </div>

          <div className="flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">QR Code Data:</p>
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 min-h-[60px] flex items-center">
                {qrCodeData ? (
                  <p className="text-sm text-gray-800 break-all">{qrCodeData}</p>
                ) : (
                  <p className="text-sm text-gray-500 italic">No QR code scanned yet</p>
                )}
              </div>
              {qrScanError && (
                <p className="text-sm text-red-600 flex items-center">
                  <AlertTriangle className="w-4 h-4 mr-1" /> {qrScanError}
                </p>
              )}
            </div>

            <div className="flex space-x-3">
              {!isScanning ? (
                <LoadingButton
                  loading={visitsLoading}
                  variant="primary"
                  size="md"
                  onClick={startScanning}
                >
                  <Camera className="w-4 h-4 mr-2" />
                  Start Scan
                </LoadingButton>
              ) : (
                <LoadingButton
                  loading={visitsLoading}
                  variant="secondary"
                  size="md"
                  onClick={stopScanning}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Stop Scan
                </LoadingButton>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Today's Visits List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Today's Scheduled Visits ({todaysVisits.length})
            </h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search visits..."
                value={searchTerm}
                onChange={handleSearchChange}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        {visitsLoading && todaysVisits.length === 0 ? (
          <Loading message="Loading today's visits..." />
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredVisits.length === 0 ? (
              <div className="p-12 text-center">
                <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">No visits found for today</p>
                <p className="text-gray-400 text-sm">
                  {searchTerm
                    ? 'Try adjusting your search criteria'
                    : 'All clear for security operations'
                  }
                </p>
              </div>
            ) : (
              filteredVisits.map((visit) => (
                <div key={visit.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 flex-1">
                      <div className="w-12 h-12 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                        {visit.first_name?.[0]}{visit.last_name?.[0]}
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-lg font-medium text-gray-900">
                            {visit.first_name} {visit.last_name}
                          </h3>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(visit.status)}`}>
                            {getStatusIcon(visit.status)}
                            <span className="ml-1 capitalize">{visit.status.replace('_', ' ')}</span>
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                          <div className="flex items-center">
                            <Building className="w-4 h-4 mr-2 text-gray-400" />
                            <span>{visit.company || 'No company'}</span>
                          </div>
                          <div className="flex items-center">
                            <User className="w-4 h-4 mr-2 text-gray-400" />
                            <span>Host: {visit.host_name || 'Not assigned'}</span>
                          </div>
                          <div className="flex items-center">
                            <Clock className="w-4 h-4 mr-2 text-gray-400" />
                            <span>
                              {visit.scheduled_start_time || 'All day'}
                              {visit.scheduled_end_time && ` - ${visit.scheduled_end_time}`}
                            </span>
                          </div>
                        </div>

                        <div className="mt-2">
                          <p className="text-sm text-gray-600">
                            <strong>Purpose:</strong> {visit.purpose}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 ml-4">
                      {canCheckIn(visit) && (
                        <LoadingButton
                          loading={checkingInVisitId === visit.id}
                          variant="primary"
                          size="sm"
                          onClick={() => handleCheckIn(visit)}
                        >
                          <UserCheck className="w-4 h-4 mr-1" />
                          Check In
                        </LoadingButton>
                      )}

                      {canCheckOut(visit) && (
                        <LoadingButton
                          loading={checkingOutVisitId === visit.id}
                          variant="secondary"
                          size="sm"
                          onClick={() => handleCheckOut(visit)}
                        >
                          <UserCheck className="w-4 h-4 mr-1" />
                          Check Out
                        </LoadingButton>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* QR Check-in Confirmation Modal */}
      {showQrCheckInModal && validatedVisitDetails && (
        <ConfirmationModal
          isOpen={showQrCheckInModal}
          title={`Check-in: ${validatedVisitDetails.visitor_first_name} ${validatedVisitDetails.visitor_last_name}`}
          message={
            <div className="space-y-4">
              <div className="flex items-center justify-center mb-6">
                {validatedVisitDetails.visitor_photo_url ? (
                  <img
                    src={getAbsoluteUrl(validatedVisitDetails.visitor_photo_url) || ''}
                    alt="Visitor Photo"
                    className="w-32 h-32 rounded-full object-cover border-4 border-blue-500 shadow-lg"
                  />
                ) : capturedPhotoPreview ? (
                  <img
                    src={capturedPhotoPreview}
                    alt="Captured Photo Preview"
                    className="w-32 h-32 rounded-full object-cover border-4 border-green-500 shadow-lg"
                  />
                ) : (
                  <div className="w-32 h-32 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 border-2 border-dashed border-gray-300">
                    <div className="text-center">
                      <Camera className="w-8 h-8 mx-auto mb-1 text-gray-400" />
                      <span className="text-xs">No Photo</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Visitor Information Section */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                <h3 className="text-md font-medium text-blue-800 mb-2 flex items-center">
                  <User className="w-4 h-4 mr-2" />
                  Visitor Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center">
                    <span className="font-medium text-blue-700 mr-2">Name:</span>
                    <span className="text-blue-900">{validatedVisitDetails.visitor_first_name} {validatedVisitDetails.visitor_last_name}</span>
                  </div>
                  {validatedVisitDetails.visitor_company && (
                    <div className="flex items-center">
                      <Building className="w-3 h-3 mr-1 text-blue-600" />
                      <span className="font-medium text-blue-700 mr-2">Company:</span>
                      <span className="text-blue-900">{validatedVisitDetails.visitor_company}</span>
                    </div>
                  )}
                  {validatedVisitDetails.visitor_email && (
                    <div className="flex items-center">
                      <Mail className="w-3 h-3 mr-1 text-blue-600" />
                      <span className="font-medium text-blue-700 mr-2">Email:</span>
                      <span className="text-blue-900">{validatedVisitDetails.visitor_email}</span>
                    </div>
                  )}
                  {validatedVisitDetails.visitor_phone && (
                    <div className="flex items-center">
                      <Phone className="w-3 h-3 mr-1 text-blue-600" />
                      <span className="font-medium text-blue-700 mr-2">Phone:</span>
                      <span className="text-blue-900">{validatedVisitDetails.visitor_phone}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Visit Details Section */}
              <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                <h3 className="text-md font-medium text-indigo-800 mb-2 flex items-center">
                  <Calendar className="w-4 h-4 mr-2" />
                  Visit Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center">
                    <span className="font-medium text-indigo-700 mr-2">Purpose:</span>
                    <span className="text-indigo-900">{validatedVisitDetails.purpose}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-medium text-indigo-700 mr-2">Date:</span>
                    <span className="text-indigo-900">{format(new Date(validatedVisitDetails.scheduled_date), 'PPP')}</span>
                  </div>
                  {validatedVisitDetails.scheduled_start_time && (
                    <div className="flex items-center">
                      <Clock className="w-3 h-3 mr-1 text-indigo-600" />
                      <span className="font-medium text-indigo-700 mr-2">Time:</span>
                      <span className="text-indigo-900">
                        {validatedVisitDetails.scheduled_start_time}
                        {validatedVisitDetails.scheduled_end_time && ` - ${validatedVisitDetails.scheduled_end_time}`}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center">
                    <User className="w-3 h-3 mr-1 text-indigo-600" />
                    <span className="font-medium text-indigo-700 mr-2">Host:</span>
                    <span className="text-indigo-900">{validatedVisitDetails.host_name}</span>
                  </div>
                  <div className="flex items-center">
                    <Building className="w-3 h-3 mr-1 text-indigo-600" />
                    <span className="font-medium text-indigo-700 mr-2">Facility:</span>
                    <span className="text-indigo-900">{validatedVisitDetails.facility_name}</span>
                  </div>
                </div>
              </div>

              {/* Host Information Section */}
              <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
                <h3 className="text-md font-medium text-purple-800 mb-2 flex items-center">
                  <User className="w-4 h-4 mr-2" />
                  Host Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center">
                    <span className="font-medium text-purple-700 mr-2">Name:</span>
                    <span className="text-purple-900">{validatedVisitDetails.host_name}</span>
                  </div>
                  {validatedVisitDetails.host_email && (
                    <div className="flex items-center">
                      <Mail className="w-3 h-3 mr-1 text-purple-600" />
                      <span className="font-medium text-purple-700 mr-2">Email:</span>
                      <span className="text-purple-900">{validatedVisitDetails.host_email}</span>
                    </div>
                  )}
                  {validatedVisitDetails.host_department && (
                    <div className="flex items-center">
                      <Building className="w-3 h-3 mr-1 text-purple-600" />
                      <span className="font-medium text-purple-700 mr-2">Department:</span>
                      <span className="text-purple-900">{validatedVisitDetails.host_department}</span>
                    </div>
                  )}
                  {validatedVisitDetails.host_phone && (
                    <div className="flex items-center">
                      <Phone className="w-3 h-3 mr-1 text-purple-600" />
                      <span className="font-medium text-purple-700 mr-2">Phone:</span>
                      <span className="text-purple-900">{validatedVisitDetails.host_phone}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Additional Information Section */}
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <h3 className="text-md font-medium text-gray-800 mb-2 flex items-center">
                  <Info className="w-4 h-4 mr-2" />
                  Additional Information
                </h3>
                <div className="space-y-2 text-sm">
                  {validatedVisitDetails.escort_required && (
                    <div className="flex items-center text-orange-700">
                      <Shield className="w-4 h-4 mr-2" />
                      <span>Escort Required</span>
                    </div>
                  )}
                  {validatedVisitDetails.security_approval_required && (
                    <div className="flex items-center text-red-700">
                      <Shield className="w-4 h-4 mr-2" />
                      <span>Security Approval Required</span>
                    </div>
                  )}
                  {validatedVisitDetails.pre_registration_status === 'completed' && (
                    <div className="flex items-center text-green-700">
                      <CheckCircle className="w-4 h-4 mr-2" />
                      <span>Pre-registration Completed</span>
                    </div>
                  )}
                  {validatedVisitDetails.special_instructions && (
                    <div className="mt-2">
                      <span className="font-medium text-gray-700">Special Instructions:</span>
                      <p className="text-gray-800 bg-gray-100 p-2 rounded mt-1">{validatedVisitDetails.special_instructions}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Vehicle & Equipment Section */}
              {((validatedVisitDetails.vehicle_info && Object.keys(validatedVisitDetails.vehicle_info).length > 0) ||
                (validatedVisitDetails.equipment_brought && validatedVisitDetails.equipment_brought.length > 0) ||
                (validatedVisitDetails.areas_authorized && validatedVisitDetails.areas_authorized.length > 0)) && (
                <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                  <h3 className="text-md font-medium text-green-800 mb-2 flex items-center">
                    <Briefcase className="w-4 h-4 mr-2" />
                    Vehicle & Equipment
                  </h3>
                  <div className="space-y-2 text-sm">
                    {validatedVisitDetails.vehicle_info && Object.keys(validatedVisitDetails.vehicle_info).length > 0 && (
                      <div className="flex items-start">
                        <Car className="w-4 h-4 mr-2 text-green-700 mt-0.5" />
                        <div>
                          <span className="font-medium text-green-700">Vehicle:</span>
                          <p className="text-green-800">
                            {validatedVisitDetails.vehicle_info.make} {validatedVisitDetails.vehicle_info.model}
                            {validatedVisitDetails.vehicle_info.color && `, ${validatedVisitDetails.vehicle_info.color}`}
                            {validatedVisitDetails.vehicle_info.license_plate && ` (${validatedVisitDetails.vehicle_info.license_plate})`}
                          </p>
                        </div>
                      </div>
                    )}
                    {validatedVisitDetails.equipment_brought && validatedVisitDetails.equipment_brought.length > 0 && (
                      <div className="flex items-start">
                        <Briefcase className="w-4 h-4 mr-2 text-green-700 mt-0.5" />
                        <div>
                          <span className="font-medium text-green-700">Equipment:</span>
                          <p className="text-green-800">{validatedVisitDetails.equipment_brought.join(', ')}</p>
                        </div>
                      </div>
                    )}
                    {validatedVisitDetails.areas_authorized && validatedVisitDetails.areas_authorized.length > 0 && (
                      <div className="flex items-start">
                        <Map className="w-4 h-4 mr-2 text-green-700 mt-0.5" />
                        <div>
                          <span className="font-medium text-green-700">Authorized Areas:</span>
                          <p className="text-green-800">
                            {validatedVisitDetails.areas_authorized.map((area: string) => 
                              area.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
                            ).join(', ')}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Badge Type Selection */}
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mt-4">
                <h3 className="text-md font-medium text-gray-800 mb-2 flex items-center">
                  <CreditCard className="w-4 h-4 mr-2" />
                  Badge Type
                </h3>
                <div className="space-y-2">
                  {tenant?.badge_issuance_options?.includes('printed') && (
                    <div className="flex items-center">
                      <input
                        type="radio"
                        id="badge-type-printed"
                        name="badge-type"
                        value="printed"
                        checked={selectedBadgeType === 'printed'}
                        onChange={() => setSelectedBadgeType('printed')}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                      />
                      <label htmlFor="badge-type-printed" className="ml-2 block text-sm text-gray-900">
                        Printed Badge
                      </label>
                    </div>
                  )}
                  {tenant?.badge_issuance_options?.includes('civ_piv_i') && (
                    <div className="flex items-center">
                      <input
                        type="radio"
                        id="badge-type-civ-piv-i"
                        name="badge-type"
                        value="civ_piv_i"
                        checked={selectedBadgeType === 'civ_piv_i'}
                        onChange={() => setSelectedBadgeType('civ_piv_i')}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                      />
                      <label htmlFor="badge-type-civ-piv-i" className="ml-2 block text-sm text-gray-900">
                        CIV/PIV-I Badge
                      </label>
                      {selectedBadgeType === 'civ_piv_i' && validatedVisitDetails?.visitor_id && !validatedVisitDetails?.civ_piv_card_info && (
                        <div className="ml-6 mt-1 text-xs text-orange-600">
                          Note: No CIV/PIV card data found for this visitor. Consider processing their card first.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Photo Capture Button */}
              {!validatedVisitDetails.visitor_photo_url && !capturedPhotoFile && (
                <div className="flex justify-center mt-4">
                  <LoadingButton
                    loading={false}
                    variant="secondary"
                    size="md"
                    onClick={() => setShowPhotoCaptureModal(true)}
                  >
                    <Camera className="w-4 h-4 mr-2" /> Capture Visitor Photo
                  </LoadingButton>
                </div>
              )}
            </div>
          }
          confirmText="Check In Visitor"
          onConfirm={() => handleConfirmQrCheckIn(validatedVisitDetails)}
          onCancel={() => {
            setShowQrCheckInModal(false);
            setValidatedVisitDetails(null); // Reset validatedVisitDetails on cancel
            setQrCodeData(null);
            setOriginalQrToken(null); // Clear original QR token on cancel
            setQrScanError(null);
            setScanningStatus('Ready to scan');
            setCapturedPhotoFile(null); // Clear captured photo on cancel
            setCapturedPhotoPreview(null); // Clear captured photo preview on cancel
          }}
          type="info"
        />
      )}

      {/* Badge Printing Modal */}
      {showBadgePrintingModal && printedBadge && validatedVisitDetails && (
        <BadgePrinting
          visit={validatedVisitDetails} // This is now a Visit object
          badge={printedBadge}
          onClose={() => {
            setShowBadgePrintingModal(false);
            setPrintedBadge(null);
            setValidatedVisitDetails(null);
            setCapturedPhotoFile(null); // Clear captured photo after printing
            setCapturedPhotoPreview(null); // Clear captured photo preview after printing
          }}
        />
      )}

      {/* Photo Capture Modal */}
      <PhotoCaptureModal
        isOpen={showPhotoCaptureModal}
        onClose={() => setShowPhotoCaptureModal(false)}
        onCapture={handlePhotoCaptured}
      />
    </div>
  );
};

const Loader: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);