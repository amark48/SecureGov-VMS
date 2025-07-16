import React, { useState } from 'react';
import { 
  UserX, 
  Search, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  User,
  Building,
  Phone,
  Mail,
  Shield,
  Eye,
  FileText,
  Clock,
  Ban,
  LoaderCircle
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { securityService } from '../../services/security';
import { LoadingButton } from '../common/Loading';

interface VisitorScreeningProps {
  onStatsUpdate?: () => void;
}

export const VisitorScreening: React.FC<VisitorScreeningProps> = ({ onStatsUpdate }) => {
  const { user } = useAuth();
  const [screeningData, setScreeningData] = useState({
    first_name: '',
    last_name: '',
    id_number: ''
  });
  const [screeningResults, setScreeningResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [hasScreened, setHasScreened] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleScreen = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      const matches = await securityService.screenVisitor(screeningData as any);
      setScreeningResults({
        matches,
        screening_summary: {
          total_matches: matches.length,
          highest_threat_level: matches.length > 0 ? matches[0].threat_level : null,
          requires_approval: matches.some((m: any) => ['high', 'critical'].includes(m.threat_level))
        }
      });
      setHasScreened(true);
      if (onStatsUpdate) onStatsUpdate();
    } catch (error: any) {
      setError(error.message || 'Failed to screen visitor');
      console.error('Failed to screen visitor:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetScreening = () => {
    setScreeningData({
      first_name: '',
      last_name: '',
      id_number: ''
    });
    setScreeningResults(null);
    setHasScreened(false);
    setError(null);
  };

  const getThreatLevelColor = (level: string) => {
    switch (level) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getThreatLevelIcon = (level: string) => {
    switch (level) {
      case 'critical':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'high':
        return <AlertTriangle className="w-4 h-4 text-orange-600" />;
      case 'medium':
        return <Shield className="w-4 h-4 text-yellow-600" />;
      case 'low':
        return <CheckCircle className="w-4 h-4 text-blue-600" />;
      default:
        return <Shield className="w-4 h-4 text-gray-600" />;
    }
  };

  const getRecommendation = () => {
    if (!screeningResults || screeningResults.matches.length === 0) {
      return {
        level: 'clear',
        message: 'No security concerns identified. Visitor may proceed with standard access procedures.',
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
        icon: CheckCircle
      };
    }

    const highestThreat = screeningResults.matches[0].threat_level;
    
    switch (highestThreat) {
      case 'critical':
        return {
          level: 'deny',
          message: 'CRITICAL THREAT DETECTED - Access must be denied. Contact security immediately.',
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          icon: XCircle
        };
      case 'high':
        return {
          level: 'approval',
          message: 'High threat level detected. Security approval and escort required.',
          color: 'text-orange-600',
          bgColor: 'bg-orange-50',
          borderColor: 'border-orange-200',
          icon: AlertTriangle
        };
      case 'medium':
        return {
          level: 'caution',
          message: 'Medium threat level detected. Additional verification recommended.',
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          icon: Shield
        };
      default:
        return {
          level: 'proceed',
          message: 'Low threat level detected. Proceed with standard security measures.',
          color: 'text-blue-600',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          icon: CheckCircle
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 mr-2" />
            <p className="font-medium">{error}</p>
          </div>
        </div>
      )}
      
      {/* Screening Form */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center">
            <UserX className="w-5 h-5 mr-2 text-blue-600" />
            Visitor Security Screening
          </h2>
          {hasScreened && (
            <button
              onClick={resetScreening}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              New Screening
            </button>
          )}
        </div>

        {!hasScreened ? (
          <form onSubmit={handleScreen} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First Name *
                </label>
                <input
                  type="text"
                  required
                  value={screeningData.first_name}
                  onChange={(e) => setScreeningData(prev => ({ ...prev, first_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter first name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name *
                </label>
                <input
                  type="text"
                  required
                  value={screeningData.last_name}
                  onChange={(e) => setScreeningData(prev => ({ ...prev, last_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter last name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ID Number (Optional)
                </label>
                <input
                  type="text"
                  value={screeningData.id_number}
                  onChange={(e) => setScreeningData(prev => ({ ...prev, id_number: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Driver's license, etc."
                />
              </div>
            </div>

            <div className="flex justify-center">
              <LoadingButton
                loading={loading}
                variant="primary"
                size="lg"
              >
                <Search className="w-4 h-4 mr-2" />
                Screen Visitor
              </LoadingButton>
            </div>
          </form>
        ) : (
          <div className="text-center py-4">
            <div className="text-lg font-medium text-gray-900 mb-2">
              Screening Results for: {screeningData.first_name} {screeningData.last_name}
            </div>
            {screeningData.id_number && (
              <div className="text-sm text-gray-600">
                ID: {screeningData.id_number}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Screening Results */}
      {hasScreened && screeningResults && (
        <div className="space-y-6">
          {/* Recommendation */}
          <div className={`rounded-lg border p-6 ${getRecommendation().bgColor} ${getRecommendation().borderColor}`}>
            <div className="flex items-start space-x-3">
              {React.createElement(getRecommendation().icon, {
                className: `w-6 h-6 ${getRecommendation().color} flex-shrink-0 mt-0.5`
              })}
              <div>
                <h3 className={'text-lg font-semibold ' + getRecommendation().color + ' mb-2'}>
                  Security Recommendation
                </h3>
                <p className={getRecommendation().color}>
                  {getRecommendation().message}
                </p>
              </div>
            </div>
          </div>

          {/* Screening Summary */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Screening Summary</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900 mb-1">
                  {screeningResults.screening_summary.total_matches}
                </div>
                <div className="text-sm text-gray-600">Watchlist Matches</div>
              </div>
              
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900 mb-1">
                  {screeningResults.screening_summary.highest_threat_level?.toUpperCase() || 'NONE'}
                </div>
                <div className="text-sm text-gray-600">Highest Threat Level</div>
              </div>
              
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className={`text-2xl font-bold mb-1 ${screeningResults.screening_summary.requires_approval ? 'text-red-600' : 'text-green-600'}`}>
                  {screeningResults.screening_summary.requires_approval ? 'YES' : 'NO'}
                </div>
                <div className="text-sm text-gray-600">Requires Approval</div>
              </div>
            </div>
          </div>

          {/* Watchlist Matches */}
          {screeningResults.matches.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <AlertTriangle className="w-5 h-5 mr-2 text-red-600" />
                  Watchlist Matches ({screeningResults.matches.length})
                </h3>
              </div>
              
              <div className="divide-y divide-gray-200">
                {screeningResults.matches.map((match: any, index: number) => (
                  <div key={index} className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-3">
                          <h4 className="text-lg font-medium text-gray-900">
                            {match.first_name} {match.last_name}
                          </h4>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getThreatLevelColor(match.threat_level)}`}>
                            {getThreatLevelIcon(match.threat_level)}
                            <span className="ml-1 capitalize">{match.threat_level} Threat</span>
                          </span>
                        </div>
                        
                        <div className="space-y-2">
                          <div>
                            <span className="text-sm font-medium text-gray-700">Reason: </span>
                            <span className="text-sm text-gray-900">{match.reason}</span>
                          </div>
                          
                          {match.source_agency && (
                            <div>
                              <span className="text-sm font-medium text-gray-700">Source Agency: </span>
                              <span className="text-sm text-gray-900">{match.source_agency}</span>
                            </div>
                          )}
                          
                          <div>
                            <span className="text-sm font-medium text-gray-700">Added: </span>
                            <span className="text-sm text-gray-900">
                              {new Date(match.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          
                          {match.expiry_date && (
                            <div>
                              <span className="text-sm font-medium text-gray-700">Expires: </span>
                              <span className="text-sm text-gray-900">
                                {new Date(match.expiry_date).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                          
                          {match.notes && (
                            <div>
                              <span className="text-sm font-medium text-gray-700">Notes: </span>
                              <span className="text-sm text-gray-900">{match.notes}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No Matches */}
          {screeningResults.matches.length === 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
              <div className="text-center">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Security Concerns</h3>
                <p className="text-gray-600">
                  This visitor does not appear on any security watchlists. Standard access procedures may be followed.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};