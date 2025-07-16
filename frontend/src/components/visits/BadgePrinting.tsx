import React, { useRef } from 'react';
import { QrCode, Printer, Download, User, Building, Calendar, Clock, MapPin, Shield } from 'lucide-react';
import { format } from 'date-fns';
import { LoadingButton } from '../common/Loading';

interface BadgePrintingProps {
  visit: any;
  badge: any;
  onClose: () => void;
  loading?: boolean;
}

export const BadgePrinting: React.FC<BadgePrintingProps> = ({ 
  visit, 
  badge, 
  onClose,
  loading = false
}) => {
  const badgeRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const printContent = badgeRef.current?.innerHTML || '';
    const printWindow = window.open('', '_blank');
    
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Visitor Badge</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                margin: 0;
                padding: 0;
              }
              .badge-container {
                width: 3.375in;
                height: 2.125in;
                border: 1px solid #ccc;
                padding: 0.25in;
                margin: 0 auto;
                page-break-inside: avoid;
              }
              .badge-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 10px;
              }
              .badge-title {
                font-size: 18px;
                font-weight: bold;
                color: #1e40af;
              }
              .badge-type {
                font-size: 14px;
                font-weight: bold;
                color: white;
                background-color: #3b82f6;
                padding: 4px 8px;
                border-radius: 4px;
              }
              .badge-content {
                display: flex;
                margin-bottom: 10px;
              }
              .badge-info {
                flex: 1;
              }
              .badge-name {
                font-size: 20px;
                font-weight: bold;
                margin-bottom: 5px;
              }
              .badge-company {
                font-size: 14px;
                margin-bottom: 10px;
              }
              .badge-detail {
                font-size: 12px;
                margin-bottom: 3px;
                display: flex;
                align-items: center;
              }
              .badge-qr {
                width: 80px;
                height: 80px;
                border: 1px solid #ddd;
                display: flex;
                align-items: center;
                justify-content: center;
              }
              .badge-footer {
                font-size: 10px;
                text-align: center;
                margin-top: 10px;
                color: #666;
              }
              @media print {
                body {
                  margin: 0;
                  padding: 0;
                }
                .badge-container {
                  border: none;
                }
              }
            </style>
          </head>
          <body>
            <div class="badge-container">
              ${printContent}
            </div>
          </body>
        </html>
      `);
      
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    }
  };

  const handleDownload = () => {
    // This would generate a PDF in a real implementation
    alert('In a production environment, this would generate a PDF badge for download');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center">
            <QrCode className="w-5 h-5 mr-2 text-blue-600" />
            Visitor Badge
          </h2>
        </div>
        
        <div className="p-6">
          {/* Badge Preview */}
          <div 
            ref={badgeRef}
            className="border border-gray-300 rounded-lg p-4 mb-6 mx-auto max-w-xs"
          >
            <div className="flex justify-between items-center mb-3">
              <div className="text-lg font-bold text-blue-800">SecureGov VMS</div>
              <div className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded">VISITOR</div>
            </div>
            
            <div className="flex mb-3">
              <div className="flex-1">
                <div className="text-xl font-bold">
                  {visit.first_name} {visit.last_name}
                </div>
                {visit.company && (
                  <div className="text-sm text-gray-600 mb-2">{visit.company}</div>
                )}
                
                <div className="text-xs text-gray-600 mb-1 flex items-center">
                  <User className="w-3 h-3 mr-1" />
                  Host: {visit.host_name}
                </div>
                
                <div className="text-xs text-gray-600 mb-1 flex items-center">
                  <Building className="w-3 h-3 mr-1" />
                  {visit.facility_name}
                </div>
                
                <div className="text-xs text-gray-600 mb-1 flex items-center">
                  <Calendar className="w-3 h-3 mr-1" />
                  {format(new Date(visit.scheduled_date), 'MMM d, yyyy')}
                </div>
                
                <div className="text-xs text-gray-600 flex items-center">
                  <Clock className="w-3 h-3 mr-1" />
                  Check-in: {visit.actual_check_in ? format(new Date(visit.actual_check_in), 'HH:mm') : 'Pending'}
                </div>
              </div>
              
              <div className="w-20 h-20 border border-gray-300 flex items-center justify-center">
                <QrCode className="w-16 h-16 text-blue-800" />
              </div>
            </div>
            
            {badge && (
              <div className="text-xs text-center text-gray-500 mt-2 space-y-1">
                <div>Badge #{badge.badge_number} • Valid until {format(new Date(), 'HH:mm')}</div>
                {badge.badge_type && (
                  <div className="flex items-center justify-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      badge.badge_type === 'civ_piv_i' 
                        ? 'bg-blue-100 text-blue-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {badge.badge_type === 'civ_piv_i' ? 'CIV/PIV-I Badge' : 'Standard Printed Badge'}
                    </span>
                  </div>
                )}
              </div>
            )}
            
            <div className="text-xs text-center text-gray-500 mt-2">
              This badge must be worn visibly at all times
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex justify-between">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Close
            </button>
            
            <div className="flex space-x-3">
              <LoadingButton
                loading={loading}
                variant="secondary"
                size="md"
                onClick={handleDownload}
              >
                <Download className="w-4 h-4 mr-2" />
                Download
              </LoadingButton>
              
              <LoadingButton
                loading={loading}
                variant="primary"
                size="md"
                onClick={handlePrint}
              >
                <Printer className="w-4 h-4 mr-2" />
                Print
              </LoadingButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};