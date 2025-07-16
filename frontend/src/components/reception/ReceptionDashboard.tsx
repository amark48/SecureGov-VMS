import React, { useState, useEffect, useRef } from 'react';
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
  AlertTriangle
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { CheckInOut } from '../visits/CheckInOut';
import { VisitorRegistration } from '../visitors/VisitorRegistration';
import { VisitorScreening } from '../security/VisitorScreening';
import { useVisitors } from '../../hooks/useVisitors';
import { Loading } from '../common/Loading';
import { format } from 'date-fns';

interface ReceptionDashboardProps {
  onSectionChange?: (section: string) => void;
}

export const ReceptionDashboard: React.FC<ReceptionDashboardProps> = ({ onSectionChange }) => {
  const { user } = useAuth();
  const { getTodaysVisits, loading } = useVisitors();
  const [activeTab, setActiveTab] = useState('checkin');
  const [showRegistrationForm, setShowRegistrationForm] = useState(false);
  const [todaysVisits, setTodaysVisits] = useState<any[]>([]);
  const [pendingVisits, setPendingVisits] = useState<any[]>([]);
  const [ongoingVisits, setOngoingVisits] = useState<any[]>([]);
  const [completedVisits, setCompletedVisits] = useState<any[]>([]);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  useEffect(() => {
    loadTodaysVisits();
    
    // Auto-refresh every 2 minutes
    const interval = setInterval(() => {
      loadTodaysVisits();
    }, 120000);
    
    return () => clearInterval(interval);
  }, []);

  const loadTodaysVisits = async () => {
    try {
      const visitsResponse = await getTodaysVisits();
      
      // Ensure visits is always an array
      const visitsArray = Array.isArray(visitsResponse?.visits) 
        ? visitsResponse.visits 
        : [];
      
      setTodaysVisits(visitsArray);
      
      // Categorize visits
      const pending = visitsArray.filter(visit => visit.status === 'pre_registered');
      const ongoing = visitsArray.filter(visit => visit.status === 'checked_in');
      const completed = visitsArray.filter(visit => visit.status === 'checked_out');
      
      setPendingVisits(pending);
      setOngoingVisits(ongoing);
      setCompletedVisits(completed);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Failed to load today\'s visits:', error);
    }
  };

  const handleVisitorCreated = (visitor: any) => {
    // After visitor is created, switch to check-in tab
    setActiveTab('checkin');
    setShowRegistrationForm(false);
    // Refresh the visits data
    loadTodaysVisits();
  };

  const tabs = [
    { id: 'checkin', label: 'Visit Management', icon: UserCheck, description: 'Check-in and check-out visitors' },
    { id: 'register', label: 'Register Visitor', icon: UserPlus, description: 'Add new visitors to the system' },
    { id: 'screening', label: 'Security Screening', icon: Shield, description: 'Screen visitors against watchlist', roles: ['admin', 'security'] }
  ].filter(tab => !tab.roles || (user?.role && tab.roles.includes(user.role)));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">Reception Dashboard</h1>
            <p className="text-blue-100">
              Manage visitor check-in/out, registration, and security screening
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex flex-col items-end">
              <div className="text-lg font-semibold">{new Date().toLocaleDateString('en-US', { weekday: 'long' })}</div>
              <div className="text-sm text-blue-200">{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
              <Clock className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <p className="text-sm font-medium text-gray-600">Pending Visits</p>
              <p className="text-2xl font-bold text-blue-600">{pendingVisits.length}</p>
            </div>
            <Clock className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <p className="text-sm font-medium text-gray-600">Ongoing Visits</p>
              <p className="text-2xl font-bold text-green-600">{ongoingVisits.length}</p>
            </div>
            <UserCheck className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <p className="text-sm font-medium text-gray-600">Completed Visits</p>
              <p className="text-2xl font-bold text-gray-600">{completedVisits.length}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-gray-600" />
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-200 bg-gray-50">
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-2 border-b-2 font-medium text-sm flex items-center transition-all duration-200 ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600 bg-blue-50/50'
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

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'checkin' && (
            <div className="space-y-6">
              {/* Last updated info */}
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900">Today's Visits</h2>
                <div className="flex items-center text-sm text-gray-500">
                  <Clock className="w-4 h-4 mr-1" />
                  Last updated: {format(lastRefresh, 'HH:mm:ss')}
                  <button 
                    onClick={loadTodaysVisits} 
                    className="ml-2 p-1 text-blue-600 hover:text-blue-800 rounded-full hover:bg-blue-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>
              
              {loading && todaysVisits.length === 0 ? (
                <Loading message="Loading today's visits..." />
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Pending Visits */}
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                    <div className="p-4 border-b border-gray-200 bg-blue-50">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium text-blue-800 flex items-center">
                          <Clock className="w-4 h-4 mr-2" />
                          Pending Visits ({pendingVisits.length})
                        </h3>
                      </div>
                    </div>
                    <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
                      {pendingVisits.length === 0 ? (
                        <div className="p-4 text-center text-gray-500">
                          <p>No pending visits for today</p>
                        </div>
                      ) : (
                        pendingVisits.map(visit => (
                          <div key={visit.id} className="p-4 hover:bg-gray-50">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-medium text-gray-900">{visit.first_name} {visit.last_name}</p>
                                <p className="text-sm text-gray-600">{visit.company || 'No company'}</p>
                                <div className="flex items-center mt-1 text-xs text-gray-500">
                                  <Clock className="w-3 h-3 mr-1" />
                                  {visit.scheduled_start_time || 'All day'}
                                </div>
                              </div>
                              <button 
                                className="px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded-full hover:bg-blue-700"
                                onClick={() => {
                                  // Navigate to check-in component with this visit
                                  // This would be implemented in a real application
                                  alert(`Check in ${visit.first_name} ${visit.last_name}`);
                                }}
                              >
                                Check In
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  
                  {/* Ongoing Visits */}
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                    <div className="p-4 border-b border-gray-200 bg-green-50">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium text-green-800 flex items-center">
                          <UserCheck className="w-4 h-4 mr-2" />
                          Ongoing Visits ({ongoingVisits.length})
                        </h3>
                      </div>
                    </div>
                    <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
                      {ongoingVisits.length === 0 ? (
                        <div className="p-4 text-center text-gray-500">
                          <p>No ongoing visits at the moment</p>
                        </div>
                      ) : (
                        ongoingVisits.map(visit => (
                          <div key={visit.id} className="p-4 hover:bg-gray-50">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-medium text-gray-900">{visit.first_name} {visit.last_name}</p>
                                <p className="text-sm text-gray-600">{visit.company || 'No company'}</p>
                                <div className="flex items-center mt-1 text-xs text-gray-500">
                                  <Clock className="w-3 h-3 mr-1" />
                                  Checked in: {visit.actual_check_in ? format(new Date(visit.actual_check_in), 'HH:mm') : 'Unknown'}
                                </div>
                              </div>
                              <button 
                                className="px-3 py-1 text-xs font-medium text-white bg-green-600 rounded-full hover:bg-green-700"
                                onClick={() => {
                                  // Navigate to check-out component with this visit
                                  // This would be implemented in a real application
                                  alert(`Check out ${visit.first_name} ${visit.last_name}`);
                                }}
                              >
                                Check Out
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  
                  {/* Completed Visits */}
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                    <div className="p-4 border-b border-gray-200 bg-gray-50">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium text-gray-800 flex items-center">
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Completed Visits ({completedVisits.length})
                        </h3>
                      </div>
                    </div>
                    <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
                      {completedVisits.length === 0 ? (
                        <div className="p-4 text-center text-gray-500">
                          <p>No completed visits today</p>
                        </div>
                      ) : (
                        completedVisits.map(visit => (
                          <div key={visit.id} className="p-4 hover:bg-gray-50">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-medium text-gray-900">{visit.first_name} {visit.last_name}</p>
                                <p className="text-sm text-gray-600">{visit.company || 'No company'}</p>
                                <div className="flex flex-col mt-1 text-xs text-gray-500">
                                  <div className="flex items-center">
                                    <Clock className="w-3 h-3 mr-1" />
                                    Checked in: {visit.actual_check_in ? format(new Date(visit.actual_check_in), 'HH:mm') : 'Unknown'}
                                  </div>
                                  <div className="flex items-center">
                                    <Clock className="w-3 h-3 mr-1" />
                                    Checked out: {visit.actual_check_out ? format(new Date(visit.actual_check_out), 'HH:mm') : 'Unknown'}
                                  </div>
                                </div>
                              </div>
                              <span className="px-3 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-full">
                                Completed
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
              
              {/* Full Check-In/Out Component */}
              <div className="mt-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Check-In/Out Management</h3>
                <CheckInOut 
                  onVisitorCheckedIn={loadTodaysVisits}
                  onVisitorCheckedOut={loadTodaysVisits}
                />
              </div>
            </div>
          )}

          {activeTab === 'register' && (
            <div className="space-y-6">
              {showRegistrationForm ? (
                <VisitorRegistration 
                  onVisitorCreated={handleVisitorCreated}
                  onCancel={() => setShowRegistrationForm(false)}
                />
              ) : (
                <div className="text-center py-12">
                  <UserPlus className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">Register a New Visitor</h2>
                  <p className="text-gray-600 mb-6 max-w-md mx-auto">
                    Add a new visitor to the system. You'll be able to collect their information and schedule visits.
                  </p>
                  <button
                    onClick={() => setShowRegistrationForm(true)}
                    className="inline-flex items-center px-6 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Start Registration
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'screening' && (
            <VisitorScreening />
          )}
        </div>
      </div>
    </div>
  );
};