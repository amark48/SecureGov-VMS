import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { 
  Calendar, 
  Clock, 
  User, 
  Building, 
  MapPin, 
  Shield, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info,
  MessageSquare,
  Car,
  Laptop,
  Repeat
} from 'lucide-react';
import { useVisitors } from '../../hooks/useVisitors';
import { useAuth } from '../../hooks/useAuth';
import { useInvitation } from '../../hooks/useInvitation';
import { LoadingButton, Loading } from '../common/Loading';
import {
  format,
  addDays,
  isBefore,
  isToday,
  parseISO,
  set
} from 'date-fns';
import type { Invitation } from '../../types/invitation';

interface CreateInvitationFormProps {
  onInvitationCreated?: (invitation: Invitation) => void;
  onCancel?: () => void;
}

interface InvitationFormData {
  visitor_id?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  host_id: string;
  facility_id: string;
  purpose: string;
  scheduled_date: string;
  scheduled_start_time?: string;
  scheduled_end_time?: string;
  visitor_count: number;
  escort_required: boolean;
  security_approval_required: boolean;
  areas_authorized?: string[];
  special_instructions?: string;
  vehicle_info?: {
    make?: string;
    model?: string;
    color?: string;
    license_plate?: string;
  };
  equipment_brought?: string[];
  pre_registration_required: boolean;
  nationality?: string;
  ssn?: string;
  recurrence_type?: string;
  recurrence_interval?: number;
  recurrence_days_of_week?: number[];
  recurrence_end_date?: string;
}

export const CreateInvitationForm: React.FC<CreateInvitationFormProps> = ({
  onInvitationCreated,
  onCancel
}) => {
  const { user } = useAuth();
  const { 
    getHosts, 
    getFacilities, 
    getVisitors, 
    loading: visitorLoading, 
    error: visitorError 
  } = useVisitors();
  const { 
    createInvitation, 
    loading: invitationLoading, 
    error: invitationError 
  } = useInvitation();

  const [hosts, setHosts] = useState<any[]>([]);
  const [facilities, setFacilities] = useState<any[]>([]);
  const [visitors, setVisitors] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedVisitor, setSelectedVisitor] = useState<any | null>(null);
  const [createNewVisitor, setCreateNewVisitor] = useState(false);
  const [availableAreas] = useState<string[]>([
    'lobby', 'conference_rooms', 'office_areas', 'secure_areas', 'restricted_areas'
  ]);
  const [showVehicleInfo, setShowVehicleInfo] = useState(false);
  const [showEquipmentInfo, setShowEquipmentInfo] = useState(false);
  const [showRecurrenceOptions, setShowRecurrenceOptions] = useState(false);
  const [equipmentList, setEquipmentList] = useState<string[]>([]);
  const [newEquipment, setNewEquipment] = useState('');
  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({});

  // Get tomorrow's date for default scheduled date
  const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors }
  } = useForm<InvitationFormData>({
    defaultValues: {
      visitor_count: 1,
      escort_required: false,
      security_approval_required: true,
      scheduled_date: tomorrow, // Set to tomorrow by default to avoid timezone issues
      pre_registration_required: true,
      vehicle_info: {
        make: '',
        model: '',
        color: '',
        license_plate: ''
      },
      recurrence_type: 'none',
      recurrence_interval: 1,
      recurrence_days_of_week: []
    }
  });

  const watchFacilityId = watch('facility_id');
  const watchAreasAuthorized = watch('areas_authorized');
  const watchPreRegistrationRequired = watch('pre_registration_required');
  const watchRecurrenceType = watch('recurrence_type');
  const watchRecurrenceInterval = watch('recurrence_interval');
  const watchRecurrenceDaysOfWeek = watch('recurrence_days_of_week');
  const watchScheduledDate = watch('scheduled_date');
  const watchScheduledStartTime = watch('scheduled_start_time');
  const watchScheduledEndTime = watch('scheduled_end_time');
  const watchRecurrenceEndDate = watch('recurrence_end_date');

  // --- Helper to strip timezone offset so "2025-07-08" stays "2025-07-08" in UTC ---
  const parseAndFixDate = (yyyyMMdd: string) => {
    const dt = parseISO(yyyyMMdd);
    // Add two days to ensure the date is in the future in UTC
    dt.setDate(dt.getDate() + 2);
    return format(dt, 'yyyy-MM-dd');
  };

  // Clear success/error messages after 5s
  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(null), 5000);
      return () => clearTimeout(t);
    }
  }, [success]);
  useEffect(() => {
    if (error) {
      const t = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(t);
    }
  }, [error]);

  // Load facilities & visitors once
  useEffect(() => {
    loadInitialData();
  }, []);

  // Load hosts when facility changes
  useEffect(() => {
    if (watchFacilityId) loadHostsForFacility(watchFacilityId);
  }, [watchFacilityId]);

  // Auto-select host for host‐role users
  useEffect(() => {
    if (
      user?.role === 'host' &&
      hosts.length > 0 &&
      watchFacilityId
    ) {
      const uh = hosts.find(
        (h) =>
          h.profile_id === user.id &&
          h.facility_id === watchFacilityId
      );
      setValue('host_id', uh?.id ?? '');
    }
  }, [hosts, user, watchFacilityId, setValue]);

  // Default end‐date 30 days out when recurrence toggled on
  useEffect(() => {
    if (
      watchRecurrenceType !== 'none' &&
      !watchRecurrenceEndDate
    ) {
      const base = watchScheduledDate
        ? parseISO(watchScheduledDate)
        : new Date();
      const plus30 = addDays(base, 30);
      setValue('recurrence_end_date', format(plus30, 'yyyy-MM-dd'));
    }
  }, [
    watchRecurrenceType,
    watchRecurrenceEndDate,
    watchScheduledDate,
    setValue
  ]);

  // Re-validate date/time and recurrence whenever inputs change
  useEffect(() => {
    validateDateAndTime();
  }, [watchScheduledDate, watchScheduledStartTime, watchScheduledEndTime]);
  useEffect(() => {
    if (watchRecurrenceType !== 'none') {
      validateRecurrenceSettings();
    }
  }, [
    watchRecurrenceType,
    watchRecurrenceInterval,
    watchRecurrenceDaysOfWeek,
    watchRecurrenceEndDate,
    watchScheduledDate
  ]);

  // --- Validation routines ---
  const validateDateAndTime = () => {
    const errs: any = {};

    // Date not in past
    if (watchScheduledDate) {
      const sd = parseISO(watchScheduledDate);
      const td = new Date();
      td.setHours(0, 0, 0, 0);
      if (isBefore(sd, td)) {
        errs.scheduled_date = 'Scheduled date cannot be in the past';
      }
    }

    // Start time future if today
    if (
      watchScheduledDate &&
      watchScheduledStartTime &&
      isToday(parseISO(watchScheduledDate))
    ) {
      const now = new Date();
      const [h, m] = watchScheduledStartTime.split(':').map(Number);
      const dt = set(new Date(), { hours: h, minutes: m });
      if (isBefore(dt, now)) {
        errs.scheduled_start_time =
          'Start time must be in the future for today';
      }
    }

    // End after start
    if (watchScheduledStartTime && watchScheduledEndTime) {
      const [sh, sm] = watchScheduledStartTime.split(':').map(Number);
      const [eh, em] = watchScheduledEndTime.split(':').map(Number);
      if (sh > eh || (sh === eh && sm >= em)) {
        errs.scheduled_end_time = 'End time must be after start time';
      }
    }

    setValidationErrors((p) => ({ ...p, ...errs }));
  };

  const validateRecurrenceSettings = () => {
    const errs: any = {};

    if (!watchRecurrenceInterval || watchRecurrenceInterval < 1) {
      errs.recurrence_interval = 'Interval must be at least 1';
    }
    if (
      watchRecurrenceType === 'weekly' &&
      (!watchRecurrenceDaysOfWeek ||
        watchRecurrenceDaysOfWeek.length === 0)
    ) {
      errs.recurrence_days_of_week =
        'Select at least one day of the week';
    }
    if (watchRecurrenceEndDate && watchScheduledDate) {
      const end = parseISO(watchRecurrenceEndDate);
      const start = parseISO(watchScheduledDate);
      if (isBefore(end, start)) {
        errs.recurrence_end_date = 'End date must be after start date';
      }
    } else {
      errs.recurrence_end_date =
        'End date is required for recurring invitations';
    }

    setValidationErrors((p) => ({ ...p, ...errs }));
  };

  // --- Data loaders ---
  const loadInitialData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [facData, visData] = await Promise.all([
        getFacilities(),
        getVisitors(100, 0)
      ]);
      setFacilities(facData);

      if (Array.isArray(visData)) {
        setVisitors(visData);
      } else if (visData?.visitors) {
        setVisitors(visData.visitors);
      } else {
        setVisitors([]);
        console.error('Expected visitors array, got:', visData);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load form data');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadHostsForFacility = async (facilityId: string) => {
    if (!facilityId) return;
    setLoading(true);
    setError(null);
    try {
      const h = await getHosts(facilityId);
      setHosts(h);
    } catch (e: any) {
      setError(e.message || 'Failed to load hosts');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // --- Submission ---
  const onSubmit = async (data: InvitationFormData) => {
    // final validation
    validateDateAndTime();
    if (data.recurrence_type !== 'none') {
      validateRecurrenceSettings();
    }
    if (Object.values(validationErrors).some((e) => e)) {
      setError('Please fix validation errors before submitting');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    // build payload
    const payload: any = {
      ...data,
      tenant_id: user?.tenant_id || '',
      security_approval_required: true,
      equipment_brought:
        equipmentList.length > 0 ? equipmentList : undefined
    };

    // include new visitor details if needed
    if (createNewVisitor) {
      if (!data.first_name || !data.last_name) {
        setError(
          'First and last name are required for new visitors'
        );
        setLoading(false);
        return;
      }
      payload.first_name = data.first_name;
      payload.last_name = data.last_name;
      payload.email = data.email;
      payload.nationality = data.nationality;
      payload.ssn = data.ssn;
      delete payload.visitor_id;
    }

    // strip recurrence fields if none
    if (payload.recurrence_type === 'none') {
      delete payload.recurrence_interval;
      delete payload.recurrence_days_of_week;
      delete payload.recurrence_end_date;
    }

    try {
      const inv = await createInvitation(payload);
      setSuccess(
        'Invitation created successfully and is pending approval'
      );
      onInvitationCreated?.(inv);
    } catch (e: any) {
      setError(e.message || 'Failed to create invitation');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // --- Select / change handlers ---
  const handleVisitorSelect = (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const vid = e.target.value;
    if (vid === 'new') {
      setCreateNewVisitor(true);
      setSelectedVisitor(null);
      setValue('visitor_id', undefined);
    } else if (vid) {
      const v = visitors.find((x) => x.id === vid);
      setSelectedVisitor(v);
      setValue('visitor_id', vid);
      setCreateNewVisitor(false);
    } else {
      setSelectedVisitor(null);
      setValue('visitor_id', undefined);
      setCreateNewVisitor(false);
    }
  };

  const handleAreaChange = (area: string) => {
    const cur = watchAreasAuthorized || [];
    if (cur.includes(area)) {
      setValue(
        'areas_authorized',
        cur.filter((a) => a !== area)
      );
    } else {
      setValue('areas_authorized', [...cur, area]);
    }
  };

  const handleAddEquipment = () => {
    if (newEquipment.trim()) {
      setEquipmentList([...equipmentList, newEquipment.trim()]);
      setNewEquipment('');
    }
  };

  const handleRemoveEquipment = (idx: number) => {
    setEquipmentList(equipmentList.filter((_, i) => i !== idx));
  };

  const handleDayOfWeekToggle = (day: number) => {
    const cur = watchRecurrenceDaysOfWeek || [];
    if (cur.includes(day)) {
      setValue(
        'recurrence_days_of_week',
        cur.filter((d) => d !== day)
      );
    } else {
      setValue('recurrence_days_of_week', [...cur, day]);
    }
  };

  const getDayName = (day: number) => {
    const days = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday'
    ];
    return days[day];
  };

  // show loading state
  if (loading && !facilities.length) {
    return <Loading message="Loading form data..." />;
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center">
            <MessageSquare className="w-5 h-5 mr-2 text-purple-600" />
            Create Invitation
          </h2>
          {onCancel && (
            <button
              onClick={onCancel}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Success/Error */}
      {success && (
        <div className="mx-6 mt-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center justify-between">
          <div className="flex items-center">
            <CheckCircle className="w-5 h-5 mr-2" />
            <p className="font-medium">{success}</p>
          </div>
          <button
            onClick={() => setSuccess(null)}
            className="text-green-700 hover:text-green-900"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>
      )}
      {(error || visitorError || invitationError) && (
        <div className="mx-6 mt-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between">
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 mr-2" />
            <p className="font-medium">
              {error || visitorError || invitationError}
            </p>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-700 hover:text-red-900"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Approval notice */}
      <div className="mx-6 mt-6 bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg flex items-center">
        <Info className="w-5 h-5 mr-2" />
        <p className="font-medium">
          This invitation will require approval before scheduling.
        </p>
      </div>

      {/* Form */}
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="p-6 space-y-6"
      >
        {/* Visitor Info */}
        <div className="space-y-4">
          <h3 className="text-md font-medium text-gray-900 flex items-center">
            <User className="w-4 h-4 mr-2" />
            Visitor Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select Visitor
              </label>
              <select
                onChange={handleVisitorSelect}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="">
                  Select a visitor or create new
                </option>
                <option value="new">
                  + Create New Visitor
                </option>
                {visitors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.first_name} {v.last_name}{' '}
                    {v.company ? `(${v.company})` : ''}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {createNewVisitor
                  ? 'Visitor info will be collected at check-in'
                  : 'Select existing or create a new visitor'}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Visitor Count *
              </label>
              <input
                type="number"
                min="1"
                max="50"
                {...register('visitor_count', {
                  required: 'Visitor count is required',
                  min: 1,
                  max: 50
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
              {errors.visitor_count && (
                <p className="text-sm text-red-600 mt-1">
                  {errors.visitor_count.message}
                </p>
              )}
            </div>
          </div>

          {selectedVisitor && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                Selected Visitor Details
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Name:</span>{' '}
                  {selectedVisitor.first_name}{' '}
                  {selectedVisitor.last_name}
                </div>
                {selectedVisitor.company && (
                  <div>
                    <span className="font-medium">Company:</span>{' '}
                    {selectedVisitor.company}
                  </div>
                )}
                {selectedVisitor.email && (
                  <div>
                    <span className="font-medium">Email:</span>{' '}
                    {selectedVisitor.email}
                  </div>
                )}
                {selectedVisitor.phone && (
                  <div>
                    <span className="font-medium">Phone:</span>{' '}
                    {selectedVisitor.phone}
                  </div>
                )}
              </div>
            </div>
          )}

          {createNewVisitor && (
            <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                New Visitor Information
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First Name *
                  </label>
                  <input
                    type="text"
                    {...register('first_name', {
                      required: createNewVisitor
                    })}
                    className={`w-full px-3 py-2 border ${
                      validationErrors.first_name
                        ? 'border-red-300 ring-1 ring-red-500'
                        : 'border-gray-300'
                    } rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500`}
                    placeholder="Enter first name"
                  />
                  {errors.first_name && (
                    <p className="text-sm text-red-600 mt-1">
                      {errors.first_name.message}
                    </p>
                  )}
                  {validationErrors.first_name && (
                    <p className="text-sm text-red-600 mt-1">
                      {validationErrors.first_name}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    {...register('last_name', {
                      required: createNewVisitor
                    })}
                    className={`w-full px-3 py-2 border ${
                      validationErrors.last_name
                        ? 'border-red-300 ring-1 ring-red-500'
                        : 'border-gray-300'
                    } rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500`}
                    placeholder="Enter last name"
                  />
                  {errors.last_name && (
                    <p className="text-sm text-red-600 mt-1">
                      {errors.last_name.message}
                    </p>
                  )}
                  {validationErrors.last_name && (
                    <p className="text-sm text-red-600 mt-1">
                      {validationErrors.last_name}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    {...register('email', {
                      required: createNewVisitor
                    })}
                    className={`w-full px-3 py-2 border ${
                      validationErrors.email
                        ? 'border-red-300 ring-1 ring-red-500'
                        : 'border-gray-300'
                    } rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500`}
                    placeholder="visitor@example.com"
                  />
                  {errors.email && (
                    <p className="text-sm text-red-600 mt-1">
                      {errors.email.message}
                    </p>
                  )}
                  {validationErrors.email && (
                    <p className="text-sm text-red-600 mt-1">
                      {validationErrors.email}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    Required to send pre-registration link
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nationality
                  </label>
                  <input
                    type="text"
                    {...register('nationality')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    placeholder="e.g., US, Canada, etc."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    SSN (Last 4 digits)
                  </label>
                  <input
                    type="text"
                    {...register('ssn')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    placeholder="Last 4 digits only"
                    maxLength={4}
                    pattern="[0-9]{4}"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Required for government facility access
                  </p>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg flex items-center">
                <AlertTriangle className="w-5 h-5 mr-2 text-yellow-600" />
                <p className="text-sm">
                  The visitor will need to complete pre-registration with full
                  details before their visit.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Visit Details */}
        <div className="space-y-4">
          <h3 className="text-md font-medium text-gray-900 flex items-center">
            <Calendar className="w-4 h-4 mr-2" />
            Visit Details
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Purpose *
              </label>
              <input
                {...register('purpose', {
                  required: 'Purpose is required'
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                placeholder="Meeting, Interview, etc."
              />
              {errors.purpose && (
                <p className="text-sm text-red-600 mt-1">
                  {errors.purpose.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date *
              </label>
              <input
                type="date"
                min={format(new Date(), 'yyyy-MM-dd')} // Set min date to client's current date
                {...register('scheduled_date', {
                  required: 'Date is required'
                })}
                className={`w-full px-3 py-2 border ${
                  validationErrors.scheduled_date
                    ? 'border-red-300 ring-1 ring-red-500'
                    : 'border-gray-300'
                } rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500`}
              />
              {errors.scheduled_date && (
                <p className="text-sm text-red-600 mt-1">
                  {errors.scheduled_date.message}
                </p>
              )}
              {validationErrors.scheduled_date && (
                <p className="text-sm text-red-600 mt-1">
                  {validationErrors.scheduled_date}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Time
              </label>
              <input
                type="time"
                {...register('scheduled_start_time')}
                className={`w-full px-3 py-2 border ${
                  validationErrors.scheduled_start_time
                    ? 'border-red-300 ring-1 ring-red-500'
                    : 'border-gray-300'
                } rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500`}
              />
              {validationErrors.scheduled_start_time && (
                <p className="text-sm text-red-600 mt-1">
                  {validationErrors.scheduled_start_time}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Time
              </label>
              <input
                type="time"
                {...register('scheduled_end_time')}
                className={`w-full px-3 py-2 border ${
                  validationErrors.scheduled_end_time
                    ? 'border-red-300 ring-1 ring-red-500'
                    : 'border-gray-300'
                } rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500`}
              />
              {validationErrors.scheduled_end_time && (
                <p className="text-sm text-red-600 mt-1">
                  {validationErrors.scheduled_end_time}
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Special Instructions
            </label>
            <textarea
              {...register('special_instructions')}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              placeholder="Any special requirements or notes..."
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="pre_registration_required"
              {...register('pre_registration_required')}
              className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
            />
            <label
              htmlFor="pre_registration_required"
              className="ml-2 block text-sm text-gray-900"
            >
              Require Pre-Registration
            </label>
          </div>

          {watchPreRegistrationRequired && (
            <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg flex items-center">
              <Info className="w-5 h-5 mr-2" />
              <div>
                <p className="text-sm font-medium">
                  Pre-registration will be required
                </p>
                <p className="text-xs mt-1">
                  A unique link will be generated and can be sent to the
                  visitor to complete their information before arrival.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Recurrence Options */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-md font-medium text-gray-900 flex items-center">
              <Repeat className="w-4 h-4 mr-2" />
              Recurrence
            </h3>
            <button
              type="button"
              onClick={() =>
                setShowRecurrenceOptions(!showRecurrenceOptions)
              }
              className="text-sm text-purple-600 hover:text-purple-700"
            >
              {showRecurrenceOptions ? 'Hide Options' : 'Show Options'}
            </button>
          </div>

          {showRecurrenceOptions && (
            <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Recurrence Pattern
                </label>
                <select
                  {...register('recurrence_type')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                >
                  <option value="none">No Recurrence</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>

              {watchRecurrenceType !== 'none' && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Repeat Every
                      </label>
                      <div className="flex items-center">
                        <input
                          type="number"
                          min="1"
                          max="30"
                          {...register('recurrence_interval')}
                          className={`w-20 px-3 py-2 border ${
                            validationErrors.recurrence_interval
                              ? 'border-red-300 ring-1 ring-red-500'
                              : 'border-gray-300'
                          } rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500`}
                        />
                        <span className="ml-2">
                          {watchRecurrenceType === 'daily'
                            ? 'Day(s)'
                            : watchRecurrenceType === 'weekly'
                            ? 'Week(s)'
                            : 'Month(s)'}
                        </span>
                      </div>
                      {validationErrors.recurrence_interval && (
                        <p className="text-sm text-red-600 mt-1">
                          {validationErrors.recurrence_interval}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        End Date
                      </label>
                      <input
                        type="date"
                        min={watchScheduledDate}
                        {...register('recurrence_end_date')}
                        className={`w-full px-3 py-2 border ${
                          validationErrors.recurrence_end_date
                            ? 'border-red-300 ring-1 ring-red-500'
                            : 'border-gray-300'
                        } rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500`}
                      />
                      {validationErrors.recurrence_end_date && (
                        <p className="text-sm text-red-600 mt-1">
                          {validationErrors.recurrence_end_date}
                        </p>
                      )}
                    </div>
                  </div>

                  {watchRecurrenceType === 'weekly' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Repeat On
                      </label>
                      <div
                        className={`flex flex-wrap gap-2 ${
                          validationErrors.recurrence_days_of_week
                            ? 'border border-red-300 p-2 rounded-md'
                            : ''
                        }`}
                      >
                        {[0, 1, 2, 3, 4, 5, 6].map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => handleDayOfWeekToggle(d)}
                            className={`px-3 py-1 rounded-full text-sm ${
                              watchRecurrenceDaysOfWeek?.includes(d)
                                ? 'bg-purple-600 text-white'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                          >
                            {getDayName(d).substring(0, 3)}
                          </button>
                        ))}
                      </div>
                      {validationErrors.recurrence_days_of_week && (
                        <p className="text-sm text-red-600 mt-1">
                          {validationErrors.recurrence_days_of_week}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg flex items-center">
                    <Info className="w-5 h-5 mr-2" />
                    <div>
                      <p className="text-sm">
                        This will create a recurring invitation pattern.
                        Each occurrence will require separate approval.
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Host & Facility */}
        <div className="space-y-4">
          <h3 className="text-md font-medium text-gray-900 flex items-center">
            <Building className="w-4 h-4 mr-2" />
            Host and Facility
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Facility *
              </label>
              <select
                {...register('facility_id', {
                  required: 'Facility is required'
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="">Select a facility</option>
                {facilities.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
              {errors.facility_id && (
                <p className="text-sm text-red-600 mt-1">
                  {errors.facility_id.message}
                </p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Select a facility first to see available hosts
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Host *
              </label>
              <select
                {...register('host_id', {
                  required: 'Host is required'
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                disabled={
                  !watchFacilityId || hosts.length === 0 || 
                  (user?.role === 'host' &&
                   !hosts.some(
                     (h) =>
                       h.profile_id === user.id &&
                       h.facility_id === watchFacilityId
                   ))
                }
              >
                <option value="">
                  {!watchFacilityId
                    ? 'Select facility first'
                    : hosts.length === 0
                    ? 'No hosts available'
                    : 'Select a host'}
                </option>
                {hosts.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.full_name} ({h.department || 'No dept'})
                  </option>
                ))}
              </select>
              {errors.host_id && (
                <p className="text-sm text-red-600 mt-1">
                  {errors.host_id.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="escort_required"
                {...register('escort_required')}
                className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
              />
              <label
                htmlFor="escort_required"
                className="ml-2 block text-sm text-gray-900"
              >
                Escort Required
              </label>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="security_approval_required"
                {...register('security_approval_required')}
                className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                checked={true}
                disabled={true}
              />
              <label
                htmlFor="security_approval_required"
                className="ml-2 block text-sm text-gray-900"
              >
                Security Approval Required
              </label>
            </div>
          </div>
        </div>

        {/* Authorized Areas */}
        <div className="space-y-4">
          <h3 className="text-md font-medium text-gray-900 flex items-center">
            <MapPin className="w-4 h-4 mr-2" />
            Authorized Areas
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {availableAreas.map((area) => (
              <div key={area} className="flex items-center">
                <input
                  type="checkbox"
                  id={`area-${area}`}
                  checked={watchAreasAuthorized?.includes(area) || false}
                  onChange={() => handleAreaChange(area)}
                  className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                />
                <label
                  htmlFor={`area-${area}`}
                  className="ml-2 block text-sm text-gray-900 capitalize"
                >
                  {area.replace('_', ' ')}
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Vehicle Info */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-md font-medium text-gray-900 flex items-center">
              <Car className="w-4 h-4 mr-2" />
              Vehicle Information
            </h3>
            <button
              type="button"
              onClick={() => setShowVehicleInfo(!showVehicleInfo)}
              className="text-sm text-purple-600 hover:text-purple-700"
            >
              {showVehicleInfo ? 'Hide' : 'Show'}
            </button>
          </div>
          {showVehicleInfo && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Make
                </label>
                <input
                  type="text"
                  {...register('vehicle_info.make')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  placeholder="e.g., Toyota"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Model
                </label>
                <input
                  type="text"
                  {...register('vehicle_info.model')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  placeholder="e.g., Camry"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Color
                </label>
                <input
                  type="text"
                  {...register('vehicle_info.color')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  placeholder="e.g., Blue"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  License Plate
                </label>
                <input
                  type="text"
                  {...register('vehicle_info.license_plate')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  placeholder="ABC-1234"
                />
              </div>
            </div>
          )}
        </div>

        {/* Equipment */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-md font-medium text-gray-900 flex items-center">
              <Laptop className="w-4 h-4 mr-2" />
              Equipment Being Brought
            </h3>
            <button
              type="button"
              onClick={() => setShowEquipmentInfo(!showEquipmentInfo)}
              className="text-sm text-purple-600 hover:text-purple-700"
            >
              {showEquipmentInfo ? 'Hide' : 'Show'}
            </button>
          </div>
          {showEquipmentInfo && (
            <div className="space-y-4">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newEquipment}
                  onChange={(e) => setNewEquipment(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  placeholder="e.g., Laptop"
                />
                <button
                  type="button"
                  onClick={handleAddEquipment}
                  className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  Add
                </button>
              </div>
              {equipmentList.length > 0 ? (
                <div className="space-y-2">
                  {equipmentList.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between bg-gray-50 p-2 rounded-md"
                    >
                      <span className="text-sm text-gray-700">
                        {item}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveEquipment(idx)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">
                  No equipment added yet
                </p>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
            >
              Cancel
            </button>
          )}
          <LoadingButton
            loading={loading || visitorLoading || invitationLoading}
            variant="primary"
            size="md"
            type="submit"
          >
            <MessageSquare className="w-4 h-4 mr-2" />
            Submit Invitation
          </LoadingButton>
        </div>
      </form>
    </div>
  );
};
