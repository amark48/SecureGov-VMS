import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  PieChart, 
  TrendingUp, 
  Download, 
  Calendar, 
  Filter,
  Users,
  Building,
  Shield,
  Activity,
  Clock,
  FileText,
  Eye,
  RefreshCw,
  Settings,
  Zap,
  Target,
  Award,
  CheckCircle,
  XCircle,
  AlertTriangle
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useVisitors } from '../../hooks/useVisitors';
import { securityService } from '../../services/security';
import { LoadingButton, Loading } from '../common/Loading';
import { VisitorTrafficChart } from '../dashboard/charts/VisitorTrafficChart';
import { VisitorPurposeChart } from '../dashboard/charts/VisitorPurposeChart';
import { SecurityAlertsChart } from '../dashboard/charts/SecurityAlertsChart';
import { ComplianceMetrics } from '../dashboard/charts/ComplianceMetrics';
import { format } from 'date-fns';

interface ReportsAndAnalyticsProps {
  onReportGenerated?: (report: any) => void;
  reportParams?: {
    generate?: string;
    facility?: string;
    dateRange?: {
      start: string;
      end: string;
    };
  };
}

export const ReportsAndAnalytics: React.FC<ReportsAndAnalyticsProps> = ({ 
  onReportGenerated,
  reportParams
}) => {
  const { user, isSuperAdmin } = useAuth();
  const { 
    getVisitStats, 
    getTodaysVisits, 
    getFacilities, 
    getVisits,
    loading: visitorLoading, 
    error: visitorError,
    clearError: clearVisitorError
  } = useVisitors();
  
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<any>(null);
  const [facilities, setFacilities] = useState<any[]>([]);
  const [selectedFacility, setSelectedFacility] = useState<string>('all');
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Data for charts
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [todaysVisits, setTodaysVisits] = useState<any[]>([]);
  const [securityAlerts, setSecurityAlerts] = useState<any[]>([]);
  const [auditStats, setAuditStats] = useState<any>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  // Clear error message after 5 seconds
  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  // Clear success message after 5 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Load data when component mounts or filters change
  useEffect(() => {
    loadReportData();
  }, [selectedFacility, dateRange]);

  // Handle reportParams changes
  useEffect(() => {
    if (reportParams?.generate) {
      generateReport(reportParams.generate);
    }
  }, [reportParams]);

  const loadReportData = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      // Load facilities
      const facilitiesData = await getFacilities();
      setFacilities(facilitiesData);
      
      // Load today's visits
      const visitsResponse = await getTodaysVisits(selectedFacility !== 'all' ? selectedFacility : undefined);
      const visitsArray = visitsResponse?.visits || [];
      setTodaysVisits(visitsArray);
      
      // Load visit stats
      const statsData = await getVisitStats(selectedFacility !== 'all' ? selectedFacility : undefined);
      setReportData(statsData);

      // Load weekly data for charts
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 6); // Last 7 days
      
      const weeklyVisits = await getVisits(
        selectedFacility !== 'all' ? selectedFacility : undefined,
        undefined,
        1,
        1000,
        format(startDate, 'yyyy-MM-dd'),
        format(new Date(), 'yyyy-MM-dd')
      );
      
      // Process weekly data for chart
      const weeklyDataMap = new Map();
      
      // Initialize with all 7 days
      for (let i = 0; i < 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = format(date, 'yyyy-MM-dd');
        weeklyDataMap.set(dateStr, {
          date: dateStr,
          visit_count: 0,
          checked_in_count: 0
        });
      }
      
      // Fill in actual data
      weeklyVisits.forEach(visit => {
        const dateStr = visit.scheduled_date;
        if (weeklyDataMap.has(dateStr)) {
          const data = weeklyDataMap.get(dateStr);
          data.visit_count++;
          if (visit.status === 'checked_in') {
            data.checked_in_count++;
          }
        }
      });
      
      // Convert map to array and sort by date
      const processedWeeklyData = Array.from(weeklyDataMap.values())
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      setWeeklyData(processedWeeklyData);

      // Load security data if user has access
      if (user?.role && ['admin', 'security', 'super_admin'].includes(user.role)) {
        try {
          const [alerts, auditData] = await Promise.all([
            securityService.getActiveSecurityAlerts(selectedFacility !== 'all' ? selectedFacility : undefined),
            securityService.getAuditLogs(100, 0, {
              start_date: dateRange.start,
              end_date: dateRange.end
            })
          ]);
          
          setSecurityAlerts(alerts);
          
          // Process audit stats
          const processedAuditStats = {
            total_entries: auditData.length,
            entries_today: auditData.filter(log => 
              new Date(log.timestamp).toDateString() === new Date().toDateString()
            ).length,
            entries_week: auditData.filter(log => 
              new Date(log.timestamp) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
            ).length,
            unique_users: [...new Set(auditData.map(log => log.user_id))].length,
            actions: Object.entries(
              auditData.reduce((acc: any, log) => {
                acc[log.action] = (acc[log.action] || 0) + 1;
                return acc;
              }, {})
            ).map(([action, count]) => ({ action, count })),
            compliance: Object.entries(
              auditData.reduce((acc: any, log) => {
                log.compliance_flags?.forEach((flag: string) => {
                  acc[flag] = (acc[flag] || 0) + 1;
                });
                return acc;
              }, {})
            ).map(([flag, count]) => ({ flag, count })),
            user_activity: Object.entries(
              auditData.reduce((acc: any, log) => {
                if (log.user?.full_name) {
                  const key = log.user.full_name;
                  if (!acc[key]) {
                    acc[key] = {
                      full_name: log.user.full_name,
                      role: 'user',
                      activity_count: 0,
                      last_activity: log.timestamp
                    };
                  }
                  acc[key].activity_count++;
                  if (new Date(log.timestamp) > new Date(acc[key].last_activity)) {
                    acc[key].last_activity = log.timestamp;
                  }
                }
                return acc;
              }, {})
            ).map(([_, data]) => data)
          };
          
          setAuditStats(processedAuditStats);
        } catch (error) {
          console.error('Failed to load security/audit data:', error);
        }
      }
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to load report data');
      console.error('Failed to load report data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateReport = async (reportType: string) => {
    setIsGeneratingReport(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    
    try {
      // Prepare report data
      const report = {
        type: reportType,
        facility: selectedFacility !== 'all' ? 
          facilities.find(f => f.id === selectedFacility)?.name : 'All Facilities',
        dateRange,
        generatedAt: new Date().toISOString(),
        generatedBy: user?.full_name,
        data: {}
      };
      
      // Add specific data based on report type
      switch (reportType) {
        case 'visitor_summary':
          report.data = {
            stats: reportData,
            visits: todaysVisits.length,
            weeklyData
          };
          break;
        case 'facility_usage':
          // Get facility-specific data
          if (selectedFacility !== 'all') {
            const facilityStats = await getVisitStats(selectedFacility);
            report.data = {
              facility: facilities.find(f => f.id === selectedFacility),
              stats: facilityStats,
              weeklyData: weeklyData.filter(d => d.facility_id === selectedFacility)
            };
          } else {
            // Get data for all facilities
            const facilityPromises = facilities.map(facility => getVisitStats(facility.id));
            const facilityResults = await Promise.all(facilityPromises);
            
            report.data = {
              facilities: facilities.map((facility, index) => ({
                ...facility,
                stats: facilityResults[index]
              }))
            };
          }
          break;
        case 'security_summary':
          report.data = {
            alerts: securityAlerts,
            auditStats
          };
          break;
        case 'system_summary':
          // For system-wide summary (super admin)
          report.data = {
            stats: reportData,
            visits: todaysVisits,
            securityAlerts,
            auditStats,
            facilities: facilities.length,
            tenants: isSuperAdmin() ? 'Multiple' : 1
          };
          break;
        default:
          report.data = {
            stats: reportData,
            visits: todaysVisits
          };
      }
      
      if (onReportGenerated) {
        onReportGenerated(report);
      }
      
      // Create and download report
      const reportContent = JSON.stringify(report, null, 2);
      const blob = new Blob([reportContent], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${reportType}_report_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      setSuccessMessage(`${reportType.replace('_', ' ')} report generated successfully`);
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to generate report');
      console.error('Failed to generate report:', error);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'visitors', label: 'Visitor Analytics', icon: Users },
    { id: 'security', label: 'Security Reports', icon: Shield, roles: ['admin', 'security', 'super_admin'] },
    { id: 'compliance', label: 'Compliance', icon: Award, roles: ['admin', 'security', 'super_admin'] },
    { id: 'custom', label: 'Custom Reports', icon: FileText }
  ].filter(tab => !tab.roles || (user?.role && tab.roles.includes(user.role)));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">Reports & Analytics</h1>
            <p className="text-purple-100">
              Comprehensive reporting, analytics, and business intelligence
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">
              {reportData?.total_visits || 0}
            </div>
            <div className="text-purple-200 text-sm">Total Visits</div>
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

      {(errorMessage || visitorError) && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between">
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 mr-2" />
            <p className="font-medium">{errorMessage || visitorError}</p>
          </div>
          <button 
            onClick={() => {
              setErrorMessage(null);
              clearVisitorError();
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
          <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
            {/* Facility Filter */}
            <div className="relative">
              <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <select
                value={selectedFacility}
                onChange={(e) => setSelectedFacility(e.target.value)}
                className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 appearance-none bg-white"
              >
                <option value="all">All Facilities</option>
                {facilities.map(facility => (
                  <option key={facility.id} value={facility.id}>
                    {facility.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Range */}
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
              <span className="text-gray-500">to</span>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={loadReportData}
              disabled={loading}
              className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Visits</p>
              <p className="text-2xl font-bold text-blue-600">
                {reportData?.total_visits || 0}
              </p>
            </div>
            <Calendar className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Currently On-Site</p>
              <p className="text-2xl font-bold text-green-600">
                {reportData?.checked_in || 0}
              </p>
            </div>
            <Users className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Today's Visits</p>
              <p className="text-2xl font-bold text-purple-600">
                {reportData?.today_visits || 0}
              </p>
            </div>
            <Clock className="w-8 h-8 text-purple-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending Check-ins</p>
              <p className="text-2xl font-bold text-orange-600">
                {reportData?.pre_registered || 0}
              </p>
            </div>
            <Clock className="w-8 h-8 text-orange-600" />
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
                      ? 'border-purple-500 text-purple-600 bg-purple-50/50'
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
          {loading ? (
            <Loading message="Loading report data..." />
          ) : (
            <>
              {activeTab === 'overview' && (
                <div className="space-y-8">
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                    <VisitorTrafficChart data={weeklyData} />
                    <VisitorPurposeChart data={todaysVisits} />
                  </div>
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                    <SecurityAlertsChart data={securityAlerts} />
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
                        <Activity className="w-5 h-5 mr-2 text-indigo-600" />
                        System Activity
                      </h3>
                      <div className="space-y-4">
                        <div className="bg-gradient-to-r from-indigo-50 to-indigo-100 rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-indigo-600">Audit Logs Today</p>
                              <p className="text-2xl font-bold text-indigo-900">
                                {auditStats?.entries_today || 0}
                              </p>
                            </div>
                            <Activity className="w-8 h-8 text-indigo-600" />
                          </div>
                        </div>
                        
                        <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-blue-600">Active Users</p>
                              <p className="text-2xl font-bold text-blue-900">
                                {auditStats?.unique_users || 0}
                              </p>
                            </div>
                            <Users className="w-8 h-8 text-blue-600" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Quick Reports */}
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-6">Quick Reports</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <LoadingButton
                        loading={isGeneratingReport}
                        variant="secondary"
                        size="md"
                        onClick={() => generateReport('visitor_summary')}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Visitor Summary
                      </LoadingButton>
                      
                      <LoadingButton
                        loading={isGeneratingReport}
                        variant="secondary"
                        size="md"
                        onClick={() => generateReport('facility_usage')}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Facility Usage
                      </LoadingButton>
                      
                      <LoadingButton
                        loading={isGeneratingReport}
                        variant="secondary"
                        size="md"
                        onClick={() => generateReport('security_summary')}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Security Summary
                      </LoadingButton>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'visitors' && (
                <div className="space-y-8">
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                    <VisitorTrafficChart data={weeklyData} />
                    <VisitorPurposeChart data={todaysVisits} />
                  </div>
                  
                  {/* Visitor Analytics Table */}
                  <div className="bg-white rounded-xl border border-gray-200">
                    <div className="p-6 border-b border-gray-200">
                      <h3 className="text-lg font-semibold text-gray-900">Visitor Analytics</h3>
                    </div>
                    <div className="p-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                          <h4 className="font-medium text-gray-900 mb-4">Top Visiting Companies</h4>
                          <div className="space-y-3">
                            {/* Group visitors by company and count */}
                            {Array.from(
                              todaysVisits.reduce((acc, visit) => {
                                const company = visit.company || 'No Company';
                                acc.set(company, (acc.get(company) || 0) + 1);
                                return acc;
                              }, new Map())
                            )
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 5)
                            .map(([company, count], index) => (
                              <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                                <span className="font-medium text-gray-900">{company}</span>
                                <span className="text-sm text-gray-600">{count} visits</span>
                              </div>
                            ))}
                            
                            {todaysVisits.length === 0 && (
                              <div className="text-center py-4">
                                <p className="text-gray-500">No visitor data available</p>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div>
                          <h4 className="font-medium text-gray-900 mb-4">Visit Status Distribution</h4>
                          <div className="space-y-3">
                            {/* Group visits by status and count */}
                            {Object.entries(
                              todaysVisits.reduce((acc: Record<string, number>, visit) => {
                                acc[visit.status] = (acc[visit.status] || 0) + 1;
                                return acc;
                              }, {})
                            )
                            .sort((a, b) => b[1] - a[1])
                            .map(([status, count], index) => (
                              <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                                <span className="font-medium text-gray-900 capitalize">{status.replace('_', ' ')}</span>
                                <span className="text-sm text-gray-600">{count} visits</span>
                              </div>
                            ))}
                            
                            {todaysVisits.length === 0 && (
                              <div className="text-center py-4">
                                <p className="text-gray-500">No visitor data available</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'security' && user?.role && ['admin', 'security', 'super_admin'].includes(user.role) && (
                <div className="space-y-8">
                  <SecurityAlertsChart data={securityAlerts} />
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white rounded-xl border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Security Metrics</h3>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Watchlist Screenings</span>
                          <span className="font-semibold text-gray-900">{auditStats?.actions?.find(a => a.action === 'security_screening')?.count || 0}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Security Alerts</span>
                          <span className="font-semibold text-gray-900">{securityAlerts.length}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Access Denials</span>
                          <span className="font-semibold text-gray-900">{reportData?.denied || 0}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Compliance Events</span>
                          <span className="font-semibold text-gray-900">
                            {auditStats?.compliance?.reduce((sum, item) => sum + parseInt(item.count), 0) || 0}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-white rounded-xl border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Security Reports</h3>
                      <div className="space-y-3">
                        <LoadingButton
                          loading={isGeneratingReport}
                          variant="secondary"
                          size="md"
                          onClick={() => generateReport('security_incidents')}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Security Incidents
                        </LoadingButton>
                        
                        <LoadingButton
                          loading={isGeneratingReport}
                          variant="secondary"
                          size="md"
                          onClick={() => generateReport('watchlist_activity')}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Watchlist Activity
                        </LoadingButton>
                        
                        <LoadingButton
                          loading={isGeneratingReport}
                          variant="secondary"
                          size="md"
                          onClick={() => generateReport('access_log')}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Access Log Report
                        </LoadingButton>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'compliance' && user?.role && ['admin', 'security', 'super_admin'].includes(user.role) && (
                <div className="space-y-8">
                  <ComplianceMetrics auditStats={auditStats} />
                  
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-6">Compliance Reports</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <LoadingButton
                          loading={isGeneratingReport}
                          variant="secondary"
                          size="md"
                          onClick={() => generateReport('ficam_compliance')}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          FICAM Compliance Report
                        </LoadingButton>
                        
                        <LoadingButton
                          loading={isGeneratingReport}
                          variant="secondary"
                          size="md"
                          onClick={() => generateReport('fips_compliance')}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          FIPS 140 Compliance Report
                        </LoadingButton>
                      </div>
                      
                      <div className="space-y-3">
                        <LoadingButton
                          loading={isGeneratingReport}
                          variant="secondary"
                          size="md"
                          onClick={() => generateReport('hipaa_compliance')}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          HIPAA Compliance Report
                        </LoadingButton>
                        
                        <LoadingButton
                          loading={isGeneratingReport}
                          variant="secondary"
                          size="md"
                          onClick={() => generateReport('ferpa_compliance')}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          FERPA Compliance Report
                        </LoadingButton>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'custom' && (
                <div className="space-y-6">
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-6">Custom Report Builder</h3>
                    <div className="text-center py-12">
                      <Settings className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <h4 className="text-lg font-medium text-gray-900 mb-2">Custom Report Builder</h4>
                      <p className="text-gray-600 mb-6">
                        Advanced report builder with custom filters, data sources, and export options will be available here.
                      </p>
                      <button className="inline-flex items-center px-6 py-3 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700">
                        <Target className="w-4 h-4 mr-2" />
                        Coming Soon
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};