import React, { useState, useEffect } from 'react';
import { Calendar, momentLocalizer, Views } from 'react-big-calendar';
import moment from 'moment';
import { format, parseISO, startOfMonth, endOfMonth, addMonths, subMonths, isSameDay } from 'date-fns';
import { addDays, addWeeks, addMonths as addMonthsToDate, getDay, isBefore, isAfter } from 'date-fns';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Download, 
  Filter, 
  RefreshCw, 
  Eye, 
  UserCheck, 
  UserX,
  Clock,
  Building,
  User,
  AlertTriangle,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { useVisitors } from '../../hooks/useVisitors';
import { useAuth } from '../../hooks/useAuth';
import { LoadingButton, Loading } from '../common/Loading';
import 'react-big-calendar/lib/css/react-big-calendar.css';

// Import the CSS file for calendar styling
import './calendar.css';

interface VisitCalendarProps {
  onVisitSelected?: (visit: any) => void;
}

export const VisitCalendar: React.FC<VisitCalendarProps> = ({ onVisitSelected }) => {
  const { user, hasAnyRole } = useAuth();
  const { getVisits, getFacilities, getHosts, checkInVisitor, checkOutVisitor, exportCalendar, loading, error, clearError } = useVisitors();
  
  const [visits, setVisits] = useState<any[]>([]);
  const [filteredVisits, setFilteredVisits] = useState<any[]>([]);
  const [facilities, setFacilities] = useState<any[]>([]);
  const [hosts, setHosts] = useState<any[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState('month');
  const [selectedVisit, setSelectedVisit] = useState<any>(null);
  const [showVisitDetails, setShowVisitDetails] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Initialize the localizer with moment
  const localizer = momentLocalizer(moment);
  
  // Filters
  const [filters, setFilters] = useState({
    status: '',
    facility_id: '',
    host_id: ''
  });

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

  // Load facilities and hosts on component mount
  useEffect(() => {
    loadFacilitiesAndHosts();
  }, []);

  // Load visits when date changes
  useEffect(() => {
    loadVisitsForDateRange(startOfMonth(currentDate), endOfMonth(currentDate));
  }, [currentDate]);

  // Filter visits when filters or visits change
  useEffect(() => {
    filterVisits();
  }, [visits, filters]);

  const loadFacilitiesAndHosts = async () => {
    try {
      const [facilitiesData, hostsData] = await Promise.all([
        getFacilities(),
        getHosts()
      ]);
      
      setFacilities(facilitiesData);
      setHosts(hostsData);
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to load facilities and hosts');
      console.error('Failed to load facilities and hosts:', error);
    }
  };

  const loadVisitsForDateRange = async (start: Date, end: Date) => {
    setCalendarLoading(true);
    setErrorMessage(null);
    
    try {
      // Format dates for API
      const startDate = format(start, 'yyyy-MM-dd');
      const endDate = format(end, 'yyyy-MM-dd');
      
      // Get visits for the date range
      const visitsData = await getVisits(
        filters.facility_id || undefined, 
        undefined, 
        1, 
        1000, 
        startDate, 
        endDate
      );
      
      // Debug: Log the visits data received from the hook
      console.log('VisitCalendar visitsData from hook:', visitsData);
      
      // Process recurring visits
      const processedVisits = processRecurringVisits(visitsData, start, end);
      
      // Debug: Log the processed visits
      console.log('VisitCalendar processedVisits:', processedVisits);
      
      // If user is a host, filter to only show their visits
      if (user?.role === 'host') {
        const filteredVisits = processedVisits.filter(visit => visit.host_profile_id === user.id);
        setVisits(filteredVisits);
      } else {
        setVisits(processedVisits);
      }
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to load visits');
      console.error('Failed to load visits:', error);
    } finally {
      setCalendarLoading(false);
    }
  };

  // Process recurring visits to generate instances for the calendar
  const processRecurringVisits = (visits: any[], start: Date, end: Date): any[] => {
    const processedVisits: any[] = [];
    
    visits.forEach(visit => {
      // Debug: Log each visit being processed
      console.log('Processing visit:', visit);
      
      // Add the original visit
      processedVisits.push(visit);
      
      // If this is a recurring visit, generate instances
      if (visit.recurrence_type && visit.recurrence_type !== 'none' && visit.recurrence_end_date) {
        const recurrenceEndDate = new Date(visit.recurrence_end_date);
        const originalDate = new Date(visit.scheduled_date);
        
        // Only process if the recurrence end date is after or equal to our start date
        if (isAfter(recurrenceEndDate, start)) {
          let currentDate = originalDate;
          
          // Generate recurring instances until we reach the end date or the calendar range end
          while ((isBefore(currentDate, recurrenceEndDate) || isSameDay(currentDate, recurrenceEndDate)) && (isBefore(currentDate, end) || isSameDay(currentDate, end))) {
            // Skip the original date
            if (format(currentDate, 'yyyy-MM-dd') === format(originalDate, 'yyyy-MM-dd')) {
              // Skip the original date and move to next occurrence
              currentDate = getNextOccurrence(currentDate, visit);
              continue;
            }
            
            // For weekly recurrence with specific days, check if this day is included
            if (visit.recurrence_type === 'weekly' && 
                visit.recurrence_days_of_week && 
                visit.recurrence_days_of_week.length > 0) {
              const dayOfWeek = getDay(currentDate);
              if (!visit.recurrence_days_of_week.includes(dayOfWeek)) {
                // Skip this day and move to next day
                currentDate = addDays(currentDate, 1);
                continue;
              }
            }
            
            // Create a new instance of the visit for this date
            const recurringVisit = {
              ...visit,
              id: `${visit.id}-${format(currentDate, 'yyyy-MM-dd')}`, // Create a unique ID
              scheduled_date: format(currentDate, 'yyyy-MM-dd'),
              is_recurring_instance: true, // Flag to identify recurring instances
              original_visit_id: visit.id // Reference to the original visit
            };
            
            // Debug: Log each generated recurring instance
            console.log('Generated recurring instance:', recurringVisit);
            
            // Add the recurring instance to the processed visits
            processedVisits.push(recurringVisit);
            
            currentDate = getNextOccurrence(currentDate, visit);
          }
        }
      }
    });
    
    return processedVisits;
  };
  
  // Helper function to get the next occurrence based on recurrence type
  const getNextOccurrence = (currentDate: Date, visit: any): Date => {
    const { recurrence_type, recurrence_interval } = visit;
    
    switch (recurrence_type) {
      case 'daily':
        return addDays(currentDate, recurrence_interval);
      case 'weekly':
        return addWeeks(currentDate, recurrence_interval);
      case 'monthly':
        return addMonthsToDate(currentDate, recurrence_interval);
      default:
        return addDays(currentDate, 1); // Default to daily if type is unknown
    }
  };

  const filterVisits = () => {
    let filtered = [...visits];

    // Status filter
    if (filters.status) {
      filtered = filtered.filter(visit => visit.status === filters.status);
    }

    // Facility filter
    if (filters.facility_id) {
      filtered = filtered.filter(visit => visit.facility_id === filters.facility_id);
    }

    // Host filter
    if (filters.host_id) {
      filtered = filtered.filter(visit => visit.host_id === filters.host_id);
    }

    setFilteredVisits(filtered);
  };

  const handleNavigate = (action: 'PREV' | 'NEXT' | 'TODAY') => {
    if (action === 'PREV') {
      setCurrentDate(subMonths(currentDate, 1));
    } else if (action === 'NEXT') {
      setCurrentDate(addMonths(currentDate, 1));
    } else if (action === 'TODAY') {
      setCurrentDate(new Date());
    }
  };

  const handleViewChange = (newView: string) => {
    setView(newView);
  };

  const handleSelectEvent = (event: any) => {
    setSelectedVisit(event.visit);
    setShowVisitDetails(true);
    if (onVisitSelected) {
      onVisitSelected(event.visit);
    }
  };

  const handleExportCalendar = async () => {
    try {
      // Get the current date range
      const startDate = format(startOfMonth(currentDate), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(currentDate), 'yyyy-MM-dd');
      
      // Export calendar
      const blob = await exportCalendar('ics', {
        start_date: startDate,
        end_date: endDate,
        facility_id: filters.facility_id || undefined,
        host_id: filters.host_id || undefined,
        status: filters.status || undefined
      });
      
      // Download the file
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `visits-calendar-${format(new Date(), 'yyyy-MM-dd')}.ics`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      setSuccessMessage('Calendar exported successfully');
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to export calendar');
      console.error('Failed to export calendar:', error);
    }
  };

  const handleCheckIn = async (visit: any) => {
    if (!hasAnyRole(['admin', 'security', 'reception'])) {
      setErrorMessage('You do not have permission to check in visitors');
      return;
    }
    
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const updatedVisit = await checkInVisitor(visit.id, 'Calendar Check-in');
      
      // Update the visit in our local state
      setVisits(prev => prev.map(v => v.id === visit.id ? { ...v, ...updatedVisit } : v));
      setSelectedVisit(updatedVisit);
      setSuccessMessage(`${visit.first_name} ${visit.last_name} checked in successfully`);
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to check in visitor');
      console.error('Failed to check in visitor:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCheckOut = async (visit: any) => {
    if (!hasAnyRole(['admin', 'security', 'reception'])) {
      setErrorMessage('You do not have permission to check out visitors');
      return;
    }
    
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const updatedVisit = await checkOutVisitor(visit.id, 'Calendar Check-out');
      
      // Update the visit in our local state
      setVisits(prev => prev.map(v => v.id === visit.id ? { ...v, ...updatedVisit } : v));
      setSelectedVisit(updatedVisit);
      setSuccessMessage(`${visit.first_name} ${visit.last_name} checked out successfully`);
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to check out visitor');
      console.error('Failed to check out visitor:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'checked_in':
        return '#10b981'; // green-500
      case 'checked_out':
        return '#6b7280'; // gray-500
      case 'pre_registered':
        return '#3b82f6'; // blue-500
      case 'cancelled':
        return '#ef4444'; // red-500
      case 'denied':
        return '#b91c1c'; // red-700
      default:
        return '#6b7280'; // gray-500
    }
  };

  // Format visits for the calendar
  const calendarEvents = filteredVisits.map(visit => {
    // Debug: Log each visit being converted to a calendar event
    console.log('Converting visit to calendar event:', visit);
    
    // Extract the date part from the scheduled_date (YYYY-MM-DD)
    const datePart = visit.scheduled_date.split('T')[0];
    
    // Create start and end times using the extracted date part
    let startTime: Date;
    let endTime: Date;
    
    if (visit.scheduled_start_time) {
      // Combine date and time properly
      startTime = new Date(`${datePart}T${visit.scheduled_start_time}`);
    } else {
      // Default to 9:00 AM
      startTime = new Date(`${datePart}T09:00:00`);
    }
    
    if (visit.scheduled_end_time) {
      // Combine date and time properly
      endTime = new Date(`${datePart}T${visit.scheduled_end_time}`);
    } else {
      // Default to 5:00 PM
      endTime = new Date(`${datePart}T17:00:00`);
    }
    
    // Verify that the dates are valid
    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
      console.error('Invalid date created for visit:', {
        visit,
        datePart,
        startTime: startTime.toString(),
        endTime: endTime.toString()
      });
      
      // Fallback to current date with default times if invalid
      const today = format(new Date(), 'yyyy-MM-dd');
      startTime = new Date(`${today}T09:00:00`);
      endTime = new Date(`${today}T17:00:00`);
    }
    
    return {
      id: visit.id,
      title: `${visit.first_name} ${visit.last_name}`,
      start: startTime,
      end: endTime,
      allDay: !visit.scheduled_start_time || visit.scheduled_start_time === '',
      visit: visit,
      status: visit.status,
      resourceId: visit.facility_id,
      isRecurring: visit.recurrence_type && visit.recurrence_type !== 'none'
    };
  });
  
  // Debug: Log the final calendar events
  console.log('Final calendarEvents:', calendarEvents);

  // Custom event component
  const EventComponent = ({ event }: any) => (
    <div 
      className="rbc-event-content" 
      style={{ 
        backgroundColor: getStatusColor(event.status),
        borderColor: getStatusColor(event.status),
        borderLeft: event.isRecurring ? '3px solid #8b5cf6' : undefined
      }}
    >
      <div className="text-xs font-medium truncate">
        {event.title}
        {event.isRecurring && (
          <span className="ml-1">🔄</span>
        )}
      </div>
      <div className="text-xs truncate">{event.visit.purpose}</div>
    </div>
  );

  // Custom toolbar component
  const CustomToolbar = (toolbar: any) => {
    const goToBack = () => {
      toolbar.onNavigate('PREV');
    };
    
    const goToNext = () => {
      toolbar.onNavigate('NEXT');
    };
    
    const goToCurrent = () => {
      toolbar.onNavigate('TODAY');
    };
    
    const label = () => {
      const date = toolbar.date;
      return (
        <span className="text-lg font-semibold">
          {format(date, 'MMMM yyyy')}
        </span>
      );
    };
    
    return (
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={goToBack}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={goToCurrent}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Today
          </button>
          <button
            type="button"
            onClick={goToNext}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <div className="ml-4">{label()}</div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => toolbar.onView('month')}
            className={`px-3 py-1 text-sm font-medium rounded-md ${
              toolbar.view === 'month' 
                ? 'bg-blue-100 text-blue-700' 
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            Month
          </button>
          <button
            type="button"
            onClick={() => toolbar.onView('week')}
            className={`px-3 py-1 text-sm font-medium rounded-md ${
              toolbar.view === 'week' 
                ? 'bg-blue-100 text-blue-700' 
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            Week
          </button>
          <button
            type="button"
            onClick={() => toolbar.onView('day')}
            className={`px-3 py-1 text-sm font-medium rounded-md ${
              toolbar.view === 'day' 
                ? 'bg-blue-100 text-blue-700' 
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            Day
          </button>
          <button
            type="button"
            onClick={() => toolbar.onView('agenda')}
            className={`px-3 py-1 text-sm font-medium rounded-md ${
              toolbar.view === 'agenda' 
                ? 'bg-blue-100 text-blue-700' 
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            Agenda
          </button>
        </div>
      </div>
    );
  };

  const canCheckIn = (visit: any) => {
    return visit.status === 'pre_registered' && hasAnyRole(['admin', 'security', 'reception']);
  };

  const canCheckOut = (visit: any) => {
    return visit.status === 'checked_in' && hasAnyRole(['admin', 'security', 'reception']);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">Visit Calendar</h1>
            <p className="text-indigo-100">
              {user?.role === 'host' 
                ? 'View and manage your scheduled visits'
                : 'Comprehensive calendar view of all scheduled visits'}
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{filteredVisits.length}</div>
            <div className="text-indigo-200 text-sm">Total Visits</div>
          </div>
        </div>
      </div>

      {/* Success Message */}
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

      {/* Error Message */}
      {(errorMessage || error) && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between">
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 mr-2" />
            <p className="font-medium">{errorMessage || error}</p>
          </div>
          <button 
            onClick={() => {
              setErrorMessage(null);
              clearError();
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
          <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 flex-1">
            {/* Status Filter */}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 appearance-none bg-white"
              >
                <option value="">All Status</option>
                <option value="pre_registered">Pre-registered</option>
                <option value="checked_in">Checked In</option>
                <option value="checked_out">Checked Out</option>
                <option value="cancelled">Cancelled</option>
                <option value="denied">Denied</option>
              </select>
            </div>

            {/* Facility Filter */}
            <div className="relative">
              <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <select
                value={filters.facility_id}
                onChange={(e) => setFilters(prev => ({ ...prev, facility_id: e.target.value }))}
                className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 appearance-none bg-white"
              >
                <option value="">All Facilities</option>
                {facilities.map(facility => (
                  <option key={facility.id} value={facility.id}>
                    {facility.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Host Filter */}
            {user?.role !== 'host' && (
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <select
                  value={filters.host_id}
                  onChange={(e) => setFilters(prev => ({ ...prev, host_id: e.target.value }))}
                  className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 appearance-none bg-white"
                >
                  <option value="">All Hosts</option>
                  {hosts.map(host => (
                    <option key={host.id} value={host.id}>
                      {host.full_name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => loadVisitsForDateRange(startOfMonth(currentDate), endOfMonth(currentDate))}
              disabled={loading}
              className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            
            <button 
              onClick={handleExportCalendar}
              className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <Download className="w-4 h-4 mr-2" />
              Export Calendar
            </button>
          </div>
        </div>
      </div>

      {/* Calendar */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        {calendarLoading ? (
          <Loading message="Loading calendar data..." />
        ) : (
          <div className="h-[700px]">
            <Calendar
              localizer={localizer}
              events={calendarEvents}
              startAccessor="start"
              endAccessor="end"
              style={{ height: '100%' }}
              views={['month', 'week', 'day', 'agenda']}
              view={view as any}
              onView={handleViewChange as any}
              date={currentDate}
              onNavigate={handleNavigate as any}
              onSelectEvent={handleSelectEvent}
              components={{
                event: EventComponent,
                toolbar: CustomToolbar
              }}
              eventPropGetter={(event) => ({
                style: {
                  backgroundColor: getStatusColor(event.status),
                  borderColor: getStatusColor(event.status)
                }
              })}
            />
          </div>
        )}
      </div>

      {/* Visit Details Modal */}
      {showVisitDetails && selectedVisit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Visit Details</h2>
                <button
                  onClick={() => setShowVisitDetails(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-gray-900">
                    {selectedVisit.first_name} {selectedVisit.last_name}
                  </h3>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    selectedVisit.status === 'checked_in' ? 'bg-green-100 text-green-800' :
                    selectedVisit.status === 'checked_out' ? 'bg-gray-100 text-gray-800' :
                    selectedVisit.status === 'pre_registered' ? 'bg-blue-100 text-blue-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {selectedVisit.status.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Date</p>
                    <p className="text-gray-900">{format(new Date(selectedVisit.scheduled_date), 'EEEE, MMMM d, yyyy')}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Time</p>
                    <p className="text-gray-900">
                      {selectedVisit.scheduled_start_time 
                        ? `${selectedVisit.scheduled_start_time}${selectedVisit.scheduled_end_time ? ` - ${selectedVisit.scheduled_end_time}` : ''}`
                        : 'All day'
                      }
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Purpose</p>
                    <p className="text-gray-900">{selectedVisit.purpose}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Company</p>
                    <p className="text-gray-900">{selectedVisit.company || 'Not provided'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Host</p>
                    <p className="text-gray-900">{selectedVisit.host_name}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Facility</p>
                    <p className="text-gray-900">{selectedVisit.facility_name}</p>
                  </div>
                </div>
                
                {selectedVisit.actual_check_in && (
                  <div className="mt-2 p-3 bg-green-50 rounded-lg">
                    <p className="text-sm font-medium text-green-800">
                      Checked in: {format(new Date(selectedVisit.actual_check_in), 'MMM d, yyyy HH:mm')}
                      {selectedVisit.check_in_location && ` at ${selectedVisit.check_in_location}`}
                    </p>
                  </div>
                )}
                
                {selectedVisit.actual_check_out && (
                  <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm font-medium text-gray-800">
                      Checked out: {format(new Date(selectedVisit.actual_check_out), 'MMM d, yyyy HH:mm')}
                      {selectedVisit.check_out_location && ` at ${selectedVisit.check_out_location}`}
                    </p>
                  </div>
                )}
                
                {selectedVisit.special_instructions && (
                  <div>
                    <p className="text-sm font-medium text-gray-500">Special Instructions</p>
                    <p className="text-gray-900 bg-gray-50 p-3 rounded-lg">{selectedVisit.special_instructions}</p>
                  </div>
                )}
              </div>
              
              <div className="mt-6 flex justify-between">
                <div className="space-x-2">
                  {canCheckIn(selectedVisit) && (
                    <LoadingButton
                      loading={isProcessing}
                      variant="primary"
                      size="sm"
                      onClick={() => handleCheckIn(selectedVisit)}
                    >
                      <UserCheck className="w-4 h-4 mr-1" />
                      Check In
                    </LoadingButton>
                  )}
                  
                  {canCheckOut(selectedVisit) && (
                    <LoadingButton
                      loading={isProcessing}
                      variant="secondary"
                      size="sm"
                      onClick={() => handleCheckOut(selectedVisit)}
                    >
                      <UserX className="w-4 h-4 mr-1" />
                      Check Out
                    </LoadingButton>
                  )}
                </div>
                
                <button
                  onClick={() => setShowVisitDetails(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};