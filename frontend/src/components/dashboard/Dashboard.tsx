// src/components/dashboard/Dashboard.tsx
import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserCheck, 
  AlertTriangle, 
  TrendingUp,
  Calendar,
  Shield,
  Activity,
  Clock,
  Eye,
  FileText,
  Building,
  Zap,
  BarChart3,
  PieChart as PieChartIcon,
  Award
} from 'lucide-react';
import { useVisitors } from '../../hooks/useVisitors';
import { useAuth } from '../../hooks/useAuth';
import { securityService } from '../../services/security';
import { StatsCard } from './StatsCard';
import { ActivityFeed } from './ActivityFeed';
import { SecurityOverview } from './SecurityOverview';
import { AuditSummary } from './AuditSummary';
import { VisitorTrafficChart } from './charts/VisitorTrafficChart';
import { VisitorPurposeChart } from './charts/VisitorPurposeChart';
import { SecurityAlertsChart } from './charts/SecurityAlertsChart';
import { RealTimeMetrics } from './charts/RealTimeMetrics';
import { ComplianceMetrics } from './charts/ComplianceMetrics';
import { Loading } from '../common/Loading';
import { SuperAdminDashboard } from './SuperAdminDashboard';

interface DashboardProps {
  onSectionChange?: (section: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onSectionChange }) => {
  const { user, isSuperAdmin } = useAuth();
  const { getVisitStats, getTodaysVisits, loading } = useVisitors();
  const [stats, setStats] = useState<any>(null);
  const [todaysVisits, setTodaysVisits] = useState<any[]>([]);
  const [securityStats, setSecurityStats] = useState<any>(null);
  const [securityAlerts, setSecurityAlerts] = useState<any[]>([]);
  const [auditStats, setAuditStats] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [weeklyData, setWeeklyData] = useState<any[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [statsData, visitsResponse] = await Promise.all([
        getVisitStats(),
        getTodaysVisits()
      ]);
      
      setStats(statsData);
      
      // Extract visits array from the response object
      const visitsArray = visitsResponse?.visits || [];
      setTodaysVisits(visitsArray);

      // Generate mock weekly data for charts
      const mockWeeklyData = Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - i));
        return {
          date: date.toISOString(),
          visit_count: Math.floor(Math.random() * 50) + 20,
          checked_in_count: Math.floor(Math.random() * 30) + 10
        };
      });
      setWeeklyData(mockWeeklyData);

      // Load security data if user has access
      if (user?.role && ['admin', 'security', 'super_admin'].includes(user.role)) {
        try {
          const [secStats, alerts, auditData] = await Promise.all([
            securityService.getSecurityStats(),
            securityService.getActiveSecurityAlerts(),
            securityService.getAuditLogs(50, 0)
          ]);
          
          setSecurityStats(secStats);
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
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    }
  };

  const handleQuickAction = (section: string) => {
    if (onSectionChange) {
      onSectionChange(section);
    }
  };

  if (loading && !stats) {
    return <Loading message="Loading dashboard..." />;
  }

  // Ensure todaysVisits is always an array before using filter
  const safeVisits = Array.isArray(todaysVisits) ? todaysVisits : [];
  const currentlyCheckedIn = safeVisits.filter(v => v.status === 'checked_in').length;
  const pendingCheckIns = safeVisits.filter(v => v.status === 'pre_registered').length;
  const totalToday = safeVisits.length;
  const securityAlertsCount = securityAlerts.filter(a => !a.resolved).length;

  const tabs = [
    { id: 'overview', label: 'Overview', icon: TrendingUp },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'security', label: 'Security', icon: Shield, roles: ['admin', 'security', 'super_admin'] },
    { id: 'compliance', label: 'Compliance', icon: Award, roles: ['admin', 'security', 'super_admin'] },
    { id: 'audit', label: 'Audit Trail', icon: Activity, roles: ['admin', 'security', 'super_admin'] }
  ].filter(tab => !tab.roles || (user?.role && tab.roles.includes(user.role)));

  return (
    <div className="space-y-8">
      {/* Enhanced Header */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-2xl p-8 text-white shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Welcome back, {user?.full_name}</h1>
            <p className="text-blue-100 text-lg">
              Here's your security operations overview for today
            </p>
          </div>
          <div className="flex items-center space-x-6">
            <div className="text-right">
              <div className="text-2xl font-bold">{new Date().toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric' 
              })}</div>
              <div className="text-blue-200 text-sm">
                {new Date().toLocaleDateString('en-US', { 
                  weekday: 'long',
                  year: 'numeric'
                })}
              </div>
            </div>
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
              <Clock className="w-8 h-8 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Currently On-Site"
          value={currentlyCheckedIn}
          icon={UserCheck}
          trend={{ value: 12, isPositive: true }}
          color="blue"
        />
        <StatsCard
          title="Pending Check-ins"
          value={pendingCheckIns}
          icon={Calendar}
          trend={{ value: 5, isPositive: false }}
          color="orange"
        />
        <StatsCard
          title="Total Visits Today"
          value={totalToday}
          icon={Users}
          trend={{ value: 18, isPositive: true }}
          color="green"
        />
        <StatsCard
          title="Security Alerts"
          value={securityAlertsCount}
          icon={AlertTriangle}
          trend={{ value: 0, isPositive: true }}
          color="red"
        />
      </div>

      {/* Enhanced Stats for Admin/Security */}
      {user?.role && ['admin', 'security', 'super_admin'].includes(user.role) && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatsCard
            title="Watchlist Entries"
            value={securityStats?.active_watchlist_entries || 0}
            icon={Eye}
            color="purple"
          />
          <StatsCard
            title="Audit Entries Today"
            value={auditStats?.entries_today || 0}
            icon={FileText}
            color="indigo"
          />
          <StatsCard
            title="Active Facilities"
            value={1}
            icon={Building}
            color="teal"
          />
          <StatsCard
            title="System Health"
            value={99.9}
            icon={Zap}
            color="green"
            suffix="%"
          />
        </div>
      )}

      {/* Enhanced Tab Navigation */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
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
          {activeTab === 'overview' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Quick Actions */}
                <div className="lg:col-span-1">
                  <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-200 p-6 shadow-sm">
                    <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
                      <Zap className="w-5 h-5 mr-2 text-blue-600" />
                      Quick Actions
                    </h2>
                    <div className="space-y-3">
                      <button 
                        onClick={() => handleQuickAction('checkin')}
                        className="w-full flex items-center p-4 text-left bg-gradient-to-r from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 rounded-xl transition-all duration-200 group transform hover:scale-105"
                      >
                        <UserCheck className="w-5 h-5 text-blue-600 mr-3" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">Check In Visitor</p>
                          <p className="text-xs text-gray-500">Process visitor arrival</p>
                        </div>
                      </button>
                      
                      <button 
                        onClick={() => handleQuickAction('visitors')}
                        className="w-full flex items-center p-4 text-left bg-gradient-to-r from-green-50 to-green-100 hover:from-green-100 hover:to-green-200 rounded-xl transition-all duration-200 group transform hover:scale-105"
                      >
                        <Users className="w-5 h-5 text-green-600 mr-3" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">Register Visitor</p>
                          <p className="text-xs text-gray-500">Add new visitor</p>
                        </div>
                      </button>
                      
                      {user?.role && ['admin', 'security', 'super_admin'].includes(user.role) && (
                        <>
                          <button 
                            onClick={() => handleQuickAction('security')}
                            className="w-full flex items-center p-4 text-left bg-gradient-to-r from-purple-50 to-purple-100 hover:from-purple-100 hover:to-purple-200 rounded-xl transition-all duration-200 group transform hover:scale-105"
                          >
                            <Shield className="w-5 h-5 text-purple-600 mr-3" />
                            <div>
                              <p className="text-sm font-medium text-gray-900">Security Screen</p>
                              <p className="text-xs text-gray-500">Run watchlist check</p>
                            </div>
                          </button>
                          
                          <button 
                            onClick={() => handleQuickAction('reports')}
                            className="w-full flex items-center p-4 text-left bg-gradient-to-r from-orange-50 to-orange-100 hover:from-orange-100 hover:to-orange-200 rounded-xl transition-all duration-200 group transform hover:scale-105"
                          >
                            <Activity className="w-5 h-5 text-orange-600 mr-3" />
                            <div>
                              <p className="text-sm font-medium text-gray-900">View Reports</p>
                              <p className="text-xs text-gray-500">Access analytics</p>
                            </div>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Activity Feed */}
                <div className="lg:col-span-2">
                  <ActivityFeed visits={safeVisits} />
                </div>
              </div>

              {/* Today's Schedule */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                <div className="p-6 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                    <Calendar className="w-5 h-5 mr-2 text-indigo-600" />
                    Today's Visitor Schedule
                  </h2>
                </div>
                <div className="p-6">
                  {safeVisits.length === 0 ? (
                    <div className="text-center py-12">
                      <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500 text-lg">No visitors scheduled for today</p>
                      <p className="text-gray-400 text-sm">All clear for security operations</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {safeVisits.slice(0, 5).map((visit) => (
                        <div key={visit.id} className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-white rounded-xl border border-gray-100 hover:shadow-md transition-all duration-200">
                          <div className="flex items-center space-x-4">
                            <div className={`w-4 h-4 rounded-full ${
                              visit.status === 'checked_in' ? 'bg-green-500 shadow-lg shadow-green-500/50' :
                              visit.status === 'checked_out' ? 'bg-gray-400' :
                              visit.status === 'pre_registered' ? 'bg-blue-500 shadow-lg shadow-blue-500/50' :
                              'bg-red-500 shadow-lg shadow-red-500/50'
                            }`} />
                            <div>
                              <p className="font-medium text-gray-900">
                                {visit.first_name} {visit.last_name}
                              </p>
                              <p className="text-sm text-gray-500">
                                {visit.company || 'No company'} • {visit.purpose}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-gray-900">
                              {visit.scheduled_start_time || 'All day'}
                            </p>
                            <p className="text-xs text-gray-500 capitalize">
                              {visit.status.replace('_', ' ')}
                            </p>
                          </div>
                        </div>
                      ))}
                      {safeVisits.length > 5 && (
                        <div className="text-center pt-4">
                          <button 
                            onClick={() => handleQuickAction('visits')}
                            className="text-blue-600 hover:text-blue-700 text-sm font-medium bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-lg transition-colors"
                          >
                            View all {safeVisits.length} visits
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                <VisitorTrafficChart data={weeklyData} />
                <VisitorPurposeChart data={safeVisits} />
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                <SecurityAlertsChart data={securityAlerts} />
                <RealTimeMetrics data={[]} />
              </div>
            </div>
          )}

          {activeTab === 'security' && user?.role && ['admin', 'security', 'super_admin'].includes(user.role) && (
            <SecurityOverview securityStats={securityStats} alerts={securityAlerts} />
          )}

          {activeTab === 'compliance' && user?.role && ['admin', 'security', 'super_admin'].includes(user.role) && (
            <ComplianceMetrics auditStats={auditStats} />
          )}

          {activeTab === 'audit' && user?.role && ['admin', 'security', 'super_admin'].includes(user.role) && (
            <AuditSummary auditStats={auditStats} />
          )}
        </div>
      </div>
    </div>
  );
};
