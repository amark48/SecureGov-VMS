import React from 'react';
import { 
  UserCheck, 
  UserX, 
  Users, 
  Shield, 
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { format } from 'date-fns';

interface ActivityFeedProps {
  visits: any[];
}

const getActivityIcon = (status: string, action?: string) => {
  switch (status) {
    case 'checked_in':
      return { icon: UserCheck, color: 'text-green-600', bg: 'bg-green-50' };
    case 'checked_out':
      return { icon: UserX, color: 'text-gray-600', bg: 'bg-gray-50' };
    case 'pre_registered':
      return { icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50' };
    case 'cancelled':
      return { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' };
    case 'denied':
      return { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' };
    default:
      return { icon: Users, color: 'text-gray-600', bg: 'bg-gray-50' };
  }
};

const getActivityMessage = (visit: any) => {
  const visitorName = `${visit.visitor?.first_name} ${visit.visitor?.last_name}`;
  const company = visit.visitor?.company ? ` from ${visit.visitor.company}` : '';
  
  switch (visit.status) {
    case 'checked_in':
      return `${visitorName}${company} checked in`;
    case 'checked_out':
      return `${visitorName}${company} checked out`;
    case 'pre_registered':
      return `${visitorName}${company} pre-registered for visit`;
    case 'cancelled':
      return `Visit for ${visitorName}${company} was cancelled`;
    case 'denied':
      return `Access denied for ${visitorName}${company}`;
    default:
      return `${visitorName}${company} - ${visit.status}`;
  }
};

export const ActivityFeed: React.FC<ActivityFeedProps> = ({ visits }) => {
  // Sort visits by most recent activity
  const sortedVisits = visits
    .sort((a, b) => {
      const aTime = a.actual_check_out || a.actual_check_in || a.created_at;
      const bTime = b.actual_check_out || b.actual_check_in || b.created_at;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    })
    .slice(0, 10); // Show only the latest 10 activities

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
      </div>
      
      <div className="p-6">
        {sortedVisits.length === 0 ? (
          <div className="text-center py-8">
            <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No recent activity</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedVisits.map((visit) => {
              const { icon: Icon, color, bg } = getActivityIcon(visit.status);
              const timestamp = visit.actual_check_out || visit.actual_check_in || visit.created_at;
              
              return (
                <div key={`${visit.id}-${visit.status}`} className="flex items-start space-x-4">
                  <div className={`p-2 rounded-full ${bg} flex-shrink-0`}>
                    <Icon className={`w-4 h-4 ${color}`} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-900">
                        {getActivityMessage(visit)}
                      </p>
                      <p className="text-xs text-gray-500 flex-shrink-0 ml-4">
                        {format(new Date(timestamp), 'HH:mm')}
                      </p>
                    </div>
                    
                    <div className="flex items-center mt-1 text-xs text-gray-500 space-x-4">
                      <span>Purpose: {visit.purpose}</span>
                      {visit.host?.profile?.full_name && (
                        <span>Host: {visit.host.profile.full_name}</span>
                      )}
                      {visit.badge_id && (
                        <span className="flex items-center">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Badge Issued
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};