import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  UserCheck, 
  Shield, 
  FileText, 
  AlertTriangle,
  Settings,
  Building,
  Activity,
  ChevronLeft,
  ChevronRight,
  Zap,
  Globe,
  Calendar,
  MessageSquare,
  UserCog,
  UserPlus
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

interface SidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  isCollapsed?: boolean;
}

interface MenuItem {
  id: string;
  label: string;
  icon: React.ElementType;
  permissions?: string[];
  badge?: number;
  description?: string;
  roles?: string[];
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  activeSection, 
  onSectionChange, 
  isCollapsed = false 
}) => {
  const { user, hasAnyRole, isSuperAdmin, hasAnyPermission } = useAuth();
  const [userRole, setUserRole] = useState<string | undefined>(user?.role);

  useEffect(() => {
    // Log permissions for debugging
    
    console.log('Current user permissions sidebar:', user?.permissions);
    

    // Ensure user role is properly set in the component state
    if (user && user.role) {
      setUserRole(user.role);
    }
  }, [user]);

  const menuItems: MenuItem[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      permissions: ['dashboard:view', 'dashboard:view_security', 'dashboard:view_analytics'],
      description: 'Overview & Analytics'
    },
    {
      id: 'reception',
      label: 'Reception',
      icon: UserCheck,
      permissions: ['visits:check_in', 'visits:check_out'],
      description: 'Reception Dashboard',
      roles: ['admin', 'security', 'reception', 'super_admin']
    },
   
    {
      id: 'checkin',
      label: 'Check In/Out',
      icon: UserPlus,
      permissions: ['visits:check_in', 'visits:check_out'],
      description: 'Visitor Processing',
      roles: ['admin', 'security', 'reception', 'super_admin']
    },
     {
      id: 'visitors',
      label: 'Visitors',
      icon: Users,
      permissions: ['visitors:read', 'visitors:create', 'visitors:edit'],
      description: 'Visitor Management'
    },
    {
      id: 'visits',
      label: 'All Visits',
      icon: Calendar,
      permissions: ['visits:read', 'visits:create', 'visits:edit'],
      description: 'Visit History & Management'
    },
    {
      id: 'calendar',
      label: 'Calendar',
      icon: Calendar,
       permissions: ['calendar:read', 'calendar:export'],
      description: 'Visit Calendar'
    },
    {
      id: 'invitations',
      label: 'Invitations',
      icon: MessageSquare,
      permissions: ['invitations:read', 'invitations:create', 'invitations:approve'],
      description: 'Manage Invitations',
      roles: ['admin', 'host', 'security', 'approver', 'super_admin']
    },
    {
      id: 'security',
      label: 'Security',
      icon: Shield,
      permissions: ['security:view', 'security:watchlist_view', 'security:alerts_view'],
      roles: ['admin', 'security', 'super_admin'],
      description: 'Security Operations'
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: FileText,
      permissions: ['dashboard:view_analytics', 'reports:read', 'reports:generate'],
      roles: ['admin', 'security', 'super_admin'],
      description: 'Analytics & Reports'
    },
    {
      id: 'emergency',
      label: 'Emergency',
      icon: AlertTriangle,
      permissions: ['emergency:view', 'emergency:contacts_manage'],
      roles: ['admin', 'security', 'reception', 'super_admin'],
      description: 'Emergency Management'
    },
    {
      id: 'facilities',
      label: 'Facilities',
      icon: Building,
      permissions: ['facilities:view', 'facilities:create', 'facilities:edit'],
      roles: ['admin', 'super_admin'],
      description: 'Facility Management'
    },
    {
      id: 'audit',
      label: 'Audit Logs',
      icon: Activity,
      permissions: ['audit:view', 'audit:export'],
      roles: ['admin', 'security', 'super_admin'],
      description: 'Compliance & Audit'
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      permissions: ['settings:read', 'settings:users_manage', 'settings:roles_manage'],
      roles: ['admin', 'super_admin'],
      description: 'System Configuration'
    },
    {
      id: 'profile',
      label: 'My Profile',
      icon: UserCog,
      description: 'Profile Settings'
    }
  ];

  const visibleMenuItems = menuItems.filter(item => {
    try {
      // Always show profile
      if (item.id === 'profile') return true;
      
      // Debug logging
      
      console.log(`--- Checking item: ${item.id} ---`);
      console.log(`User role: ${user?.role}`);
      console.log(`Is Super Admin: ${isSuperAdmin()}`);
      console.log(`User permissions array: ${user?.permissions}`);
      console.log(`Item permissions defined: ${Boolean(item.permissions && item.permissions.length > 0)}`);
      console.log(`Item roles defined: ${Boolean(item.roles)}`);
      
      // Check permissions first
      if (item.permissions && item.permissions.length > 0) {
        const hasPermission = hasAnyPermission(item.permissions);
        console.log(`  hasAnyPermission(${item.id}): ${hasPermission}`);
        
        if (!hasPermission && !isSuperAdmin()) {
          console.log(`  Hiding ${item.id} due to missing permissions.`);
          return false;
        }
      }
      
      // Fall back to role-based check if no permissions specified
      if (item.roles) {
        const hasRole = hasAnyRole(item.roles);
        console.log(`  hasAnyRole(${item.id}): ${hasRole}`);
        
        if (!hasRole && !isSuperAdmin()) {
          console.log(`  Hiding ${item.id} due to missing role.`);
          return false;
        }
      }
      
      // Special case for host users
      if (user?.role === 'host') {
        // Hosts should see dashboard, visits, calendar, and invitations
        if (['dashboard', 'visits', 'calendar', 'invitations', 'visitors', 'profile'].includes(item.id)) {
          console.log(`--- Showing item: ${item.id} ---`);
          return true;
        }
      }
      
      console.log(`--- Showing item: ${item.id} ---`);
      return true;
    } catch (error) {
      console.error(`Error filtering menu item ${item.id}:`, error);
      return item.id === 'profile'; // Only show profile on error
    }
  });

  return (
    <div className={`bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 text-white transition-all duration-300 ${
      isCollapsed ? 'w-20' : 'w-72'
    } relative border-r border-gray-700 shadow-2xl`}>
      
      {/* Sidebar Header */}
      <div className="p-6 border-b border-gray-700">
        {!isCollapsed && (
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl shadow-lg">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">SecureGov VMS</h1>
              <p className="text-xs text-gray-400">Enterprise Security</p>
            </div>
          </div>
        )}
        {isCollapsed && (
          <div className="flex justify-center">
            <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl shadow-lg">
              <Shield className="w-6 h-6 text-white" />
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="p-4 flex-1">
        <nav className="space-y-2">
          {visibleMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => onSectionChange(item.id)}
                className={`w-full group relative flex items-center px-3 py-3 text-sm font-medium rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg transform scale-105'
                    : 'text-gray-300 hover:bg-gray-700/50 hover:text-white hover:transform hover:scale-105'
                }`}
              >
                <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-white'}`} />
                
                {!isCollapsed && (
                  <>
                    <div className="ml-3 flex-1 text-left">
                      <div className="flex items-center justify-between">
                        <span className="block">{item.label}</span>
                        {item.badge && (
                          <span className="bg-red-500 text-white text-xs rounded-full px-2 py-1 ml-2">
                            {item.badge}
                          </span>
                        )}
                      </div>
                      {item.description && (
                        <span className="text-xs text-gray-400 group-hover:text-gray-300 block mt-0.5">
                          {item.description}
                        </span>
                      )}
                    </div>
                  </>
                )}

                {/* Tooltip for collapsed state */}
                {isCollapsed && (
                  <div className="absolute left-full ml-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 whitespace-nowrap">
                    <div className="font-medium">{item.label}</div>
                    {item.description && (
                      <div className="text-xs text-gray-400">{item.description}</div>
                    )}
                  </div>
                )}

                {/* Active indicator */}
                {isActive && (
                  <div className="absolute right-0 top-1/2 transform -translate-y-1/2 w-1 h-8 bg-white rounded-l-full"></div>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* System Status */}
      {!isCollapsed && (
        <div className="p-4 border-t border-gray-700">
          <div className="bg-gray-800/50 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-300">System Status</span>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-green-400">Online</span>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2">
                  <Zap className="w-3 h-3 text-blue-400" />
                  <span className="text-gray-400">Performance</span>
                </div>
                <span className="text-green-400 font-medium">99.9%</span>
              </div>
              
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2">
                  <Globe className="w-3 h-3 text-purple-400" />
                  <span className="text-gray-400">Compliance</span>
                </div>
                <span className="text-green-400 font-medium">Active</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User Profile */}
      {!isCollapsed && (
        <div className="p-4 border-t border-gray-700">
          <div className="bg-gradient-to-r from-gray-800 to-gray-700 rounded-xl p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-sm">
                  {user?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {user?.full_name}
                </p>
                <div className="flex items-center space-x-2">
                  <p className="text-xs text-gray-400 capitalize">
                    {user?.role?.replace('_', ' ')}
                  </p>
                  {user?.department && (
                    <>
                      <span className="text-gray-500">•</span>
                      <p className="text-xs text-gray-400">
                        {user.department}
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Collapsed user indicator */}
      {isCollapsed && (
        <div className="p-4 border-t border-gray-700">
          <div className="flex justify-center">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-sm">
                {user?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};