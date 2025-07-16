export const APP_NAME = 'SecureGov VMS';
export const APP_VERSION = '1.0.0';

export const USER_ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  SECURITY: 'security',
  RECEPTION: 'reception',
  HOST: 'host',
  APPROVER: 'approver'
} as const;

export const VISIT_STATUSES = {
  PRE_REGISTERED: 'pre_registered',
  CHECKED_IN: 'checked_in',
  CHECKED_OUT: 'checked_out',
  CANCELLED: 'cancelled',
  DENIED: 'denied'
} as const;

export const INVITATION_STATUSES = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled'
} as const;

export const WATCHLIST_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
} as const;

export const AUDIT_ACTIONS = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LOGIN: 'login',
  LOGOUT: 'logout',
  CHECK_IN: 'check_in',
  CHECK_OUT: 'check_out'
} as const;

export const ID_TYPES = [
  'drivers_license',
  'passport',
  'state_id',
  'military_id',
  'government_id',
  'other'
];

export const SECURITY_CLEARANCES = [
  'unclassified',
  'confidential',
  'secret',
  'top_secret'
];

export const CONTACT_TYPES = [
  'emergency',
  'security',
  'administration',
  'medical',
  'fire_safety',
  'general'
];

export const ACCESS_ZONES = [
  'lobby',
  'conference_rooms',
  'office_areas',
  'secure_areas',
  'restricted_areas',
  'executive_floor'
];

export const COMPLIANCE_STANDARDS = [
  'FICAM',
  'FIPS_140',
  'HIPAA',
  'FERPA',
  'FedRAMP'
];

export const NOTIFICATION_TYPES = {
  VISITOR_ARRIVAL: 'visitor_arrival',
  SECURITY_ALERT: 'security_alert',
  BADGE_EXPIRY: 'badge_expiry',
  WATCHLIST_MATCH: 'watchlist_match',
  EMERGENCY: 'emergency'
} as const;

export const DEFAULT_OPERATING_HOURS = {
  monday: { open: '08:00', close: '17:00' },
  tuesday: { open: '08:00', close: '17:00' },
  wednesday: { open: '08:00', close: '17:00' },
  thursday: { open: '08:00', close: '17:00' },
  friday: { open: '08:00', close: '17:00' },
  saturday: { open: '09:00', close: '15:00' },
  sunday: { open: '10:00', close: '14:00' }
};

export const COLORS = {
  primary: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a'
  },
  secondary: {
    50: '#f0fdfa',
    100: '#ccfbf1',
    200: '#99f6e4',
    300: '#5eead4',
    400: '#2dd4bf',
    500: '#14b8a6',
    600: '#0d9488',
    700: '#0f766e',
    800: '#115e59',
    900: '#134e4a'
  },
  accent: {
    50: '#fff7ed',
    100: '#ffedd5',
    200: '#fed7aa',
    300: '#fdba74',
    400: '#fb923c',
    500: '#f97316',
    600: '#ea580c',
    700: '#c2410c',
    800: '#9a3412',
    900: '#7c2d12'
  },
  success: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    900: '#14532d'
  },
  warning: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309',
    800: '#92400e',
    900: '#78350f'
  },
  error: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d'
  }
};

export const ANIMATION_DURATIONS = {
  fast: 150,
  normal: 200,
  slow: 300
} as const;

export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536
} as const;