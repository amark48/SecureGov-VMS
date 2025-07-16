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
      id: 'visitors',
      label: 'Visitors',
      icon: Users,
      permissions: ['visitors:read', 'visitors:create', 'visitors:edit'],
      description: 'Visitor Management'
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
      id: 'visits',
      label: 'All Visits',
      icon: Calendar,
      permissions: ['visits:view', 'visits:create', 'visits:edit'],
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
      permissions: ['invitations:view', 'invitations:create', 'invitations:approve'],
      description: 'Manage Invitations',
      roles: ['admin', 'host', 'approver', 'super_admin']
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
