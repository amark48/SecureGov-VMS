import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, XCircle, CheckCircle, Upload, Info, AlertTriangle } from 'lucide-react';
import { LoadingButton, Loading } from './Loading';

interface PhotoCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (imageFile: File) => void;
}

export const PhotoCaptureModal: React.FC<PhotoCaptureModalProps> = ({
  isOpen,
  onClose,
  onCapture,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [capturedImageBlob, setCapturedImageBlob] = useState<Blob | null>(null);
  const [capturedImagePreview, setCapturedImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
      setError(null);
      setCapturedImageBlob(null);
      setCapturedImagePreview(null);
    }
    return () => stopCamera();
  }, [isOpen]);

  const startCamera = async () => {
    setLoading(true);
    setError(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }, // Prefer rear camera on mobile
      });
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play();
      }
      setStream(mediaStream);
    } catch (err: any) {
      console.error('Error accessing camera:', err);
      setError('Could not access camera. Please check permissions or try again.');
    } finally {
      setLoading(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  const capturePhoto = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        canvas.toBlob((blob) => {
          if (blob) {
            setCapturedImageBlob(blob);
            setCapturedImagePreview(URL.createObjectURL(blob));
            stopCamera(); // Stop camera after capture
          }
        }, 'image/jpeg', 0.95); // Capture as JPEG with 95% quality
      }
    }
  }, [videoRef, canvasRef]);

  const handleSave = () => {
    if (capturedImageBlob) {
      const imageFile = new File([capturedImageBlob], `visitor_photo_${Date.now()}.jpg`, {
        type: 'image/jpeg',
      });
      onCapture(imageFile);
      onClose();
    }
  };

  const handleRetake = () => {
    setCapturedImageBlob(null);
    setCapturedImagePreview(null);
    startCamera();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900">Capture Visitor Photo</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 flex-1 overflow-auto flex flex-col items-center justify-center">
          {loading && (
            <div className="text-center text-gray-500">
              <Loading message="Starting camera..." />
            </div>
          )}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-center w-full">
              <AlertTriangle className="w-5 h-5 mr-2" />
              <p>{error}</p>
            </div>
          )}

          {!loading && !error && !capturedImagePreview && (
            <div className="relative w-full h-full flex items-center justify-center bg-gray-100 rounded-lg">
              <video ref={videoRef} className="w-full h-full object-cover rounded-lg" autoPlay playsInline />
              <canvas ref={canvasRef} className="hidden" />
            </div>
          )}

          {capturedImagePreview && (
            <div className="relative w-full h-full flex items-center justify-center">
              <img src={capturedImagePreview} alt="Captured" className="max-w-full max-h-[60vh] object-contain rounded-lg" />
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 flex justify-center space-x-3">
          {!capturedImagePreview ? (
            <LoadingButton
              loading={loading}
              variant="primary"
              size="md"
              onClick={capturePhoto}
              disabled={!stream || loading}
            >
              <Camera className="w-4 h-4 mr-2" />
              Capture Photo
            </LoadingButton>
          ) : (
            <>
              <LoadingButton
                loading={loading}
                variant="secondary"
                size="md"
                onClick={handleRetake}
              >
                <Camera className="w-4 h-4 mr-2" />
                Retake
              </LoadingButton>
              <LoadingButton
                loading={loading}
                variant="primary"
                size="md"
                onClick={handleSave}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Use Photo
              </LoadingButton>
            </>
          )}
        </div>
        <div className="p-2 bg-blue-50 border-t border-blue-100 text-blue-700 text-xs flex items-center justify-center">
          <Info className="w-3 h-3 mr-1" />
          Captured photos are not automatically saved to the backend.
        </div>
      </div>
    </div>
  );
};
