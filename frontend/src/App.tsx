// src/App.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation
} from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { LoginForm } from './components/auth/LoginForm';  // <-- now a named import
import { LandingPage } from './components/landing/LandingPage';
import { PreRegistrationPage } from './components/preregistration/PreRegistrationPage';
import { Header } from './components/common/Header';
import { Sidebar } from './components/common/Sidebar';
import { Dashboard } from './components/dashboard/Dashboard';
import { SuperAdminDashboard } from './components/dashboard/SuperAdminDashboard';
import { ReceptionDashboard } from './components/reception/ReceptionDashboard';
import { VisitorsList } from './components/visitors/VisitorsList';
import { CheckInOut } from './components/visits/CheckInOut';
import VisitsList from './components/visits/VisitsList';
import { AuditLogsList } from './components/audit/AuditLogsList';
import { SecurityManagement } from './components/security/SecurityManagement';
import { FacilitiesManagement } from './components/facilities/FacilitiesManagement';
import { ReportsAndAnalytics } from './components/reports/ReportsAndAnalytics';
import { EmergencyManagement } from './components/emergency/EmergencyManagement';
import { SystemSettings } from './components/settings/SystemSettings';
import { InvitationsList } from './components/invitations/InvitationsList';
import { UserProfile } from './components/profile/UserProfile';
import { VisitCalendar } from './components/calendar/VisitCalendar';
import { TenantManagement } from './components/settings/TenantManagement';
import { Loading } from './components/common/Loading';

// --------------------------------------------------
// Layout wrapper for all authenticated routes
// --------------------------------------------------
const AuthenticatedLayout: React.FC = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeSection, setActiveSection] = useState('dashboard');
  const [activeSectionParams, setActiveSectionParams] = useState<any>(null);
  const { isSuperAdmin, error, clearError } = useAuth();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSectionChange = useCallback((section: string, params?: any) => {
    setActiveSection(section);
    setActiveSectionParams(params || null);
  }, []);

  const renderContent = () => {
    if (isSuperAdmin() && activeSection === 'dashboard') {
      return <SuperAdminDashboard onSectionChange={handleSectionChange} />;
    }
    switch (activeSection) {
      case 'dashboard':
        return <Dashboard onSectionChange={handleSectionChange} />;
      case 'reception':
        return <ReceptionDashboard onSectionChange={handleSectionChange} />;
      case 'visitors':
        return <VisitorsList />;
      case 'checkin':
        return <CheckInOut />;
      case 'visits':
        return <VisitsList />;
      case 'security':
        return <SecurityManagement onSectionChange={handleSectionChange} />;
      case 'reports':
        return (
          <ReportsAndAnalytics
            reportParams={activeSectionParams}
            onReportGenerated={() => {}}
          />
        );
      case 'emergency':
        return <EmergencyManagement />;
      case 'facilities':
        return <FacilitiesManagement />;
      case 'audit':
        return <AuditLogsList />;
      case 'settings':
        return (
          <SystemSettings
            viewParams={activeSectionParams}
            onSectionChange={handleSectionChange}
          />
        );
      case 'invitations':
        return <InvitationsList />;
      case 'profile':
        return <UserProfile />;
      case 'calendar':
        return <VisitCalendar />;
      case 'tenants':
        return (
          <TenantManagement
            viewParams={activeSectionParams}
            onSectionChange={handleSectionChange}
          />
        );
      default:
        return <Dashboard onSectionChange={handleSectionChange} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
        isCollapsed={sidebarCollapsed}
      />
      <div className="flex-1 flex flex-col">
        <Header onMenuClick={() => setSidebarCollapsed(!sidebarCollapsed)} />
        <main className="flex-1 p-6 overflow-auto">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

// --------------------------------------------------
// Route‐level component that redirects post‐login
// --------------------------------------------------
const AppRoutes: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Once authenticated, redirect from "/" or "/login" → "/dashboard"
  useEffect(() => {
    if (user && (location.pathname === '/' || location.pathname === '/login')) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, location.pathname, navigate]);

  return (
    <Routes>
      {/* Always‐public */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/pre-register/:token" element={<PreRegistrationPage />} />

      {/* Unauthenticated */}
      {!user && (
        <>
          <Route path="/login" element={<LoginForm />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </>
      )}

      {/* Authenticated */}
      {user && (
        <Route path="/*" element={<AuthenticatedLayout />} />
      )}
    </Routes>
  );
};

// --------------------------------------------------
// Top‐level App
// --------------------------------------------------
function App() {
  const {
    user,
    loading,
    sessionExpired,
    loadTenantAuthSettings
  } = useAuth();

  // Only ever full-screen‐loader on first "initializing" pass
  const [initialDone, setInitialDone] = useState(false);
  useEffect(() => {
    if (!loading) setInitialDone(true);
  }, [loading]);

  // Once logged in, fetch tenant settings
  useEffect(() => {
    if (user?.tenant_id) {
      loadTenantAuthSettings(user.tenant_id);
    }
  }, [user, loadTenantAuthSettings]);

  // Log session expiry
  useEffect(() => {
    if (sessionExpired) {
      console.log('Session expired, redirecting to login');
    }
  }, [sessionExpired]);

  console.log('App.tsx render: user =', user, 'loading =', loading);

  if (!initialDone) {
    return <Loading fullScreen message="Initializing SecureGov VMS…" />;
  }

  return (
    <Router>
      <AppRoutes />
    </Router>
  );
}

export default App;