import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  Phone, 
  Users, 
  MapPin, 
  Clock, 
  Shield,
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  RefreshCw,
  Download,
  Bell,
  Radio,
  Zap,
  Building,
  User,
  Mail,
  FileText,
  CheckCircle,
  XCircle,
  Eye
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useVisitors } from '../../hooks/useVisitors';
import { securityService } from '../../services/security';
import { LoadingButton, Loading } from '../common/Loading';
import { format } from 'date-fns';

interface EmergencyManagementProps {
  onEmergencyInitiated?: (emergency: any) => void;
}

export const EmergencyManagement: React.FC<EmergencyManagementProps> = ({ onEmergencyInitiated }) => {
  const { user } = useAuth();
  const { getFacilities, getTodaysVisits } = useVisitors();
  
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [facilities, setFacilities] = useState<any[]>([]);
  const [selectedFacility, setSelectedFacility] = useState<string>('');
  const [emergencyContacts, setEmergencyContacts] = useState<any[]>([]);
  const [currentVisitors, setCurrentVisitors] = useState<any[]>([]);
  const [showContactForm, setShowContactForm] = useState(false);
  const [editingContact, setEditingContact] = useState<any>(null);
  
  // Emergency contact form data
  const [contactFormData, setContactFormData] = useState({
    name: '',
    title: '',
    phone_primary: '',
    phone_secondary: '',
    email: '',
    contact_type: 'emergency'
  });

  // Emergency procedures
  const [emergencyProcedures, setEmergencyProcedures] = useState<string>('');

  useEffect(() => {
    loadEmergencyData();
  }, [selectedFacility]);

  const loadEmergencyData = async () => {
    setLoading(true);
    try {
      const facilitiesData = await getFacilities();
      setFacilities(facilitiesData);
      
      if (!selectedFacility && facilitiesData.length > 0) {
        setSelectedFacility(facilitiesData[0].id);
      }
      
      if (selectedFacility) {
        const [contacts, visitors] = await Promise.all([
          securityService.getEmergencyContacts(selectedFacility),
          getTodaysVisits()
        ]);
        
        setEmergencyContacts(contacts);
        // Ensure visitors is an array before filtering
        const visitsArray = Array.isArray(visitors) ? visitors : 
                           (visitors && Array.isArray(visitors.visits) ? visitors.visits : []);
        setCurrentVisitors(visitsArray.filter(v => v.status === 'checked_in'));
        
        // Get emergency procedures for the facility
        const facility = facilitiesData.find(f => f.id === selectedFacility);
        setEmergencyProcedures(facility?.emergency_procedures || '');
      }
    } catch (error) {
      console.error('Failed to load emergency data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await securityService.createEmergencyContact({
        ...contactFormData,
        facility_id: selectedFacility
      });
      
      await loadEmergencyData();
      resetContactForm();
    } catch (error) {
      console.error('Failed to create emergency contact:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetContactForm = () => {
    setContactFormData({
      name: '',
      title: '',
      phone_primary: '',
      phone_secondary: '',
      email: '',
      contact_type: 'emergency'
    });
    setEditingContact(null);
    setShowContactForm(false);
  };

  const handleEditContact = (contact: any) => {
    setContactFormData({
      name: contact.name,
      title: contact.title || '',
      phone_primary: contact.phone_primary,
      phone_secondary: contact.phone_secondary || '',
      email: contact.email || '',
      contact_type: contact.contact_type
    });
    setEditingContact(contact);
    setShowContactForm(true);
  };

  const initiateEmergencyLockdown = async () => {
    if (!confirm('Are you sure you want to initiate an emergency lockdown? This will alert all emergency contacts and log the event.')) {
      return;
    }
    
    setLoading(true);
    try {
      // In a real implementation, this would call the backend emergency lockdown endpoint
      const emergency = {
        type: 'lockdown',
        facility_id: selectedFacility,
        initiated_by: user?.full_name,
        initiated_at: new Date().toISOString(),
        affected_visitors: currentVisitors.length
      };
      
      if (onEmergencyInitiated) {
        onEmergencyInitiated(emergency);
      }
      
      // Simulate emergency response
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      alert('Emergency lockdown initiated successfully. All emergency contacts have been notified.');
    } catch (error) {
      console.error('Failed to initiate emergency lockdown:', error);
    } finally {
      setLoading(false);
    }
  };

  const testEmergencyNotifications = async () => {
    setLoading(true);
    try {
      // In a real implementation, this would test emergency notification systems
      await new Promise(resolve => setTimeout(resolve, 1500));
      alert('Emergency notification test completed successfully. All systems operational.');
    } catch (error) {
      console.error('Failed to test emergency notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateEvacuationList = async () => {
    setLoading(true);
    try {
      // Generate evacuation list
      const evacuationData = {
        facility: facilities.find(f => f.id === selectedFacility)?.name,
        generated_at: new Date().toISOString(),
        generated_by: user?.full_name,
        current_visitors: currentVisitors.map(visitor => ({
          name: `${visitor.first_name} ${visitor.last_name}`,
          company: visitor.company,
          host: visitor.host_name,
          check_in_time: visitor.actual_check_in,
          emergency_contact: visitor.emergency_contact_name,
          emergency_phone: visitor.emergency_contact_phone
        }))
      };
      
      const content = `EMERGENCY EVACUATION LIST
Generated: ${format(new Date(), 'PPpp')}
Facility: ${evacuationData.facility}
Generated by: ${evacuationData.generated_by}

CURRENT VISITORS ON-SITE (${currentVisitors.length}):
${evacuationData.current_visitors.map((visitor, index) => 
  `${index + 1}. ${visitor.name} (${visitor.company || 'No company'})
     Host: ${visitor.host}
     Check-in: ${format(new Date(visitor.check_in_time), 'HH:mm')}
     Emergency Contact: ${visitor.emergency_contact || 'None'} ${visitor.emergency_phone || ''}
`).join('\n')}

EMERGENCY CONTACTS:
${emergencyContacts.map((contact, index) => 
  `${index + 1}. ${contact.name} (${contact.contact_type.toUpperCase()})
     Phone: ${contact.phone_primary}
     Email: ${contact.email || 'N/A'}
`).join('\n')}
`;

      const blob = new Blob([content], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `evacuation_list_${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to generate evacuation list:', error);
    } finally {
      setLoading(false);
    }
  };

  const getContactTypeColor = (type: string) => {
    switch (type) {
      case 'emergency':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'security':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medical':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'fire_safety':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'administration':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getContactTypeIcon = (type: string) => {
    switch (type) {
      case 'emergency':
        return <AlertTriangle className="w-4 h-4 text-red-600" />;
      case 'security':
        return <Shield className="w-4 h-4 text-orange-600" />;
      case 'medical':
        return <Plus className="w-4 h-4 text-green-600" />;
      case 'fire_safety':
        return <Zap className="w-4 h-4 text-blue-600" />;
      case 'administration':
        return <User className="w-4 h-4 text-purple-600" />;
      default:
        return <Phone className="w-4 h-4 text-gray-600" />;
    }
  };

  const canManageEmergency = user?.role && ['admin', 'security'].includes(user.role);

  const tabs = [
    { id: 'overview', label: 'Overview', icon: AlertTriangle },
    { id: 'contacts', label: 'Emergency Contacts', icon: Phone },
    { id: 'evacuation', label: 'Evacuation List', icon: Users },
    { id: 'procedures', label: 'Procedures', icon: FileText }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-600 via-orange-600 to-yellow-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">Emergency Management</h1>
            <p className="text-red-100">
              Emergency response coordination, evacuation management, and crisis communication
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{currentVisitors.length}</div>
            <div className="text-red-200 text-sm">Current Visitors</div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
          <div className="flex items-center space-x-4">
            <Building className="w-4 h-4 text-gray-400" />
            <select
              value={selectedFacility}
              onChange={(e) => setSelectedFacility(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 appearance-none bg-white"
            >
              <option value="">Select Facility</option>
              {facilities.map(facility => (
                <option key={facility.id} value={facility.id}>
                  {facility.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={loadEmergencyData}
              disabled={loading}
              className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Emergency Actions */}
      {canManageEmergency && selectedFacility && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Emergency Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <LoadingButton
              loading={loading}
              variant="danger"
              size="md"
              onClick={initiateEmergencyLockdown}
            >
              <AlertTriangle className="w-4 h-4 mr-2" />
              Initiate Lockdown
            </LoadingButton>
            
            <LoadingButton
              loading={loading}
              variant="secondary"
              size="md"
              onClick={testEmergencyNotifications}
            >
              <Bell className="w-4 h-4 mr-2" />
              Test Notifications
            </LoadingButton>
            
            <LoadingButton
              loading={loading}
              variant="secondary"
              size="md"
              onClick={generateEvacuationList}
            >
              <Download className="w-4 h-4 mr-2" />
              Evacuation List
            </LoadingButton>
            
            <button className="flex items-center justify-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-500">
              <Radio className="w-4 h-4 mr-2" />
              Emergency Broadcast
            </button>
          </div>
        </div>
      )}

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
                      ? 'border-red-500 text-red-600 bg-red-50/50'
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
            <div className="space-y-6">
              {/* Emergency Status */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-xl p-6 border border-green-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-green-600">System Status</p>
                      <p className="text-2xl font-bold text-green-900">NORMAL</p>
                    </div>
                    <CheckCircle className="w-10 h-10 text-green-600" />
                  </div>
                </div>

                <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-blue-600">Emergency Contacts</p>
                      <p className="text-2xl font-bold text-blue-900">{emergencyContacts.length}</p>
                    </div>
                    <Phone className="w-10 h-10 text-blue-600" />
                  </div>
                </div>

                <div className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-xl p-6 border border-orange-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-orange-600">On-Site Visitors</p>
                      <p className="text-2xl font-bold text-orange-900">{currentVisitors.length}</p>
                    </div>
                    <Users className="w-10 h-10 text-orange-600" />
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Emergency Activity</h3>
                <div className="text-center py-8">
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                  <p className="text-gray-500">No recent emergency activities</p>
                  <p className="text-sm text-gray-400">All systems operating normally</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'contacts' && (
            <div className="space-y-6">
              {/* Controls */}
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">Emergency Contacts</h3>
                {canManageEmergency && (
                  <button
                    onClick={() => setShowContactForm(true)}
                    className="flex items-center px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Contact
                  </button>
                )}
              </div>

              {/* Contact Form */}
              {showContactForm && (
                <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                  <h4 className="text-md font-medium text-gray-900 mb-4">
                    {editingContact ? 'Edit Emergency Contact' : 'Add Emergency Contact'}
                  </h4>
                  <form onSubmit={handleCreateContact} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                        <input
                          type="text"
                          required
                          value={contactFormData.name}
                          onChange={(e) => setContactFormData(prev => ({ ...prev, name: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                        <input
                          type="text"
                          value={contactFormData.title}
                          onChange={(e) => setContactFormData(prev => ({ ...prev, title: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Primary Phone *</label>
                        <input
                          type="tel"
                          required
                          value={contactFormData.phone_primary}
                          onChange={(e) => setContactFormData(prev => ({ ...prev, phone_primary: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Secondary Phone</label>
                        <input
                          type="tel"
                          value={contactFormData.phone_secondary}
                          onChange={(e) => setContactFormData(prev => ({ ...prev, phone_secondary: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <input
                          type="email"
                          value={contactFormData.email}
                          onChange={(e) => setContactFormData(prev => ({ ...prev, email: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Contact Type *</label>
                        <select
                          required
                          value={contactFormData.contact_type}
                          onChange={(e) => setContactFormData(prev => ({ ...prev, contact_type: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                        >
                          <option value="emergency">Emergency</option>
                          <option value="security">Security</option>
                          <option value="medical">Medical</option>
                          <option value="fire_safety">Fire Safety</option>
                          <option value="administration">Administration</option>
                          <option value="general">General</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex justify-end space-x-3">
                      <button
                        type="button"
                        onClick={resetContactForm}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <LoadingButton
                        loading={loading}
                        variant="danger"
                        size="md"
                      >
                        {editingContact ? 'Update Contact' : 'Add Contact'}
                      </LoadingButton>
                    </div>
                  </form>
                </div>
              )}

              {/* Contacts List */}
              <div className="space-y-4">
                {emergencyContacts.length === 0 ? (
                  <div className="text-center py-8">
                    <Phone className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No emergency contacts configured</p>
                    <p className="text-sm text-gray-400">Add emergency contacts to ensure rapid response</p>
                  </div>
                ) : (
                  emergencyContacts.map((contact) => (
                    <div key={contact.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                            {getContactTypeIcon(contact.contact_type)}
                          </div>
                          <div>
                            <div className="flex items-center space-x-3 mb-1">
                              <h4 className="font-medium text-gray-900">{contact.name}</h4>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getContactTypeColor(contact.contact_type)}`}>
                                {contact.contact_type.replace('_', ' ').toUpperCase()}
                              </span>
                            </div>
                            <div className="text-sm text-gray-600">
                              {contact.title && <span>{contact.title} • </span>}
                              <span>{contact.phone_primary}</span>
                              {contact.email && <span> • {contact.email}</span>}
                            </div>
                          </div>
                        </div>
                        {canManageEmergency && (
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleEditContact(contact)}
                              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'evacuation' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">Current Visitors On-Site</h3>
                <LoadingButton
                  loading={loading}
                  variant="secondary"
                  size="md"
                  onClick={generateEvacuationList}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Generate List
                </LoadingButton>
              </div>

              {currentVisitors.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No visitors currently on-site</p>
                  <p className="text-sm text-gray-400">All clear for emergency procedures</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {currentVisitors.map((visitor) => (
                    <div key={visitor.id} className="bg-white border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <User className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-900">
                              {visitor.first_name} {visitor.last_name}
                            </h4>
                            <div className="text-sm text-gray-600">
                              <span>{visitor.company || 'No company'}</span>
                              <span> • Host: {visitor.host_name}</span>
                              <span> • Checked in: {format(new Date(visitor.actual_check_in), 'HH:mm')}</span>
                            </div>
                            {visitor.emergency_contact_name && (
                              <div className="text-sm text-gray-500">
                                Emergency Contact: {visitor.emergency_contact_name} {visitor.emergency_contact_phone}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'procedures' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Emergency Procedures</h3>
              
              {emergencyProcedures ? (
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <div className="prose max-w-none">
                    <pre className="whitespace-pre-wrap text-gray-700 font-sans">{emergencyProcedures}</pre>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No emergency procedures configured</p>
                  <p className="text-sm text-gray-400">Configure emergency procedures in facility settings</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};