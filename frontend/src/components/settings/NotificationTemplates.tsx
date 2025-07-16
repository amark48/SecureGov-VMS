import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Plus, 
  Search, 
  Filter, 
  Edit, 
  Trash2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Mail,
  MessageSquare,
  Send,
  Copy,
  Eye,
  EyeOff,
  Save,
  ChevronDown,
  ChevronUp,
  Info,
  HelpCircle,
  FileText,
  Tag
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { LoadingButton, Loading } from '../common/Loading';
import { format } from 'date-fns';
import { NotificationTemplate, TemplateVariable } from '../../services/notification';

export const NotificationTemplates: React.FC = () => {
  const { user } = useAuth();
  const { 
    getTemplates, 
    getTemplate, 
    createTemplate, 
    updateTemplate, 
    deleteTemplate,
    sendTestNotification,
    getTemplateVariables,
    loading, 
    error, 
    clearError 
  } = useNotification();
  
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<NotificationTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<NotificationTemplate | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showVariables, setShowVariables] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<NotificationTemplate | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [templateVariables, setTemplateVariables] = useState<Record<string, TemplateVariable[]>>({});
  const [previewVariables, setPreviewVariables] = useState<Record<string, string>>({});
  
  // Form data
  const [formData, setFormData] = useState<{
    name: string;
    subject: string;
    body: string;
    type: 'email' | 'sms' | 'push';
    event: string;
    is_active: boolean;
    is_default: boolean;
  }>({
    name: '',
    subject: '',
    body: '',
    type: 'email',
    event: 'invitation',
    is_active: true,
    is_default: false
  });
  
  // Test notification data
  const [testData, setTestData] = useState({
    recipient_email: '',
    recipient_phone: '',
    recipient_user_id: '',
    variables: {} as Record<string, string>
  });
  
  // Filters
  const [filters, setFilters] = useState({
    search: '',
    type: '',
    event: ''
  });

  // Clear success message after 5 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Clear error message after 5 seconds
  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  useEffect(() => {
    loadTemplates();
    loadTemplateVariables();
  }, []);

  useEffect(() => {
    filterTemplates();
  }, [templates, filters]);

  // Initialize preview variables when template event changes
  useEffect(() => {
    if (showPreview && selectedTemplate) {
      initializePreviewVariables(selectedTemplate.event);
    }
  }, [showPreview, selectedTemplate]);

  // Initialize test variables when editing template event changes
  useEffect(() => {
    if (showForm && formData.event) {
      initializeTestVariables(formData.event);
    }
  }, [showForm, formData.event]);

  const loadTemplates = async () => {
    try {
      setErrorMessage(null);
      const templatesData = await getTemplates();
      setTemplates(templatesData);
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to load templates');
      console.error('Failed to load templates:', error);
    }
  };

  const loadTemplateVariables = async () => {
    try {
      const variables = await getTemplateVariables();
      setTemplateVariables(variables);
    } catch (error: any) {
      console.error('Failed to load template variables:', error);
    }
  };

  const filterTemplates = () => {
    let filtered = [...templates];

    // Search filter
    if (filters.search) {
      filtered = filtered.filter(template => 
        template.name.toLowerCase().includes(filters.search.toLowerCase()) ||
        (template.subject && template.subject.toLowerCase().includes(filters.search.toLowerCase())) ||
        template.body.toLowerCase().includes(filters.search.toLowerCase())
      );
    }

    // Type filter
    if (filters.type) {
      filtered = filtered.filter(template => template.type === filters.type);
    }

    // Event filter
    if (filters.event) {
      filtered = filtered.filter(template => template.event === filters.event);
    }

    setFilteredTemplates(filtered);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    
    try {
      if (editingTemplate) {
        // Update existing template
        const updatedTemplate = await updateTemplate(editingTemplate.id, formData);
        setTemplates(prev => prev.map(t => t.id === updatedTemplate.id ? updatedTemplate : t));
        setSuccessMessage(`Template "${updatedTemplate.name}" updated successfully`);
      } else {
        // Create new template
        const newTemplate = await createTemplate(formData);
        setTemplates(prev => [newTemplate, ...prev]);
        setSuccessMessage(`Template "${newTemplate.name}" created successfully`);
      }
      
      resetForm();
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to save template');
      console.error('Failed to save template:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      subject: '',
      body: '',
      type: 'email',
      event: 'invitation',
      is_active: true,
      is_default: false
    });
    setEditingTemplate(null);
    setShowForm(false);
    setShowPreview(false);
    setTestData({
      recipient_email: '',
      recipient_phone: '',
      recipient_user_id: '',
      variables: {}
    });
  };

  const handleEdit = (template: NotificationTemplate) => {
    setFormData({
      name: template.name,
      subject: template.subject || '',
      body: template.body,
      type: template.type,
      event: template.event,
      is_active: template.is_active,
      is_default: template.is_default
    });
    setEditingTemplate(template);
    setShowForm(true);
  };

  const handleDelete = async (templateId: string, templateName: string) => {
    if (!confirm(`Are you sure you want to delete the template "${templateName}"?`)) {
      return;
    }
    
    setErrorMessage(null);
    setSuccessMessage(null);
    
    try {
      await deleteTemplate(templateId);
      setTemplates(prev => prev.filter(t => t.id !== templateId));
      setSuccessMessage(`Template "${templateName}" deleted successfully`);
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to delete template');
      console.error('Failed to delete template:', error);
    }
  };

  const handlePreview = (template: NotificationTemplate) => {
    setSelectedTemplate(template);
    setShowPreview(true);
    initializePreviewVariables(template.event);
  };

  const initializePreviewVariables = (event: string) => {
    const variables = templateVariables[event] || [];
    const initialValues: Record<string, string> = {};
    
    variables.forEach(variable => {
      initialValues[variable.name] = `[${variable.name}]`;
    });
    
    setPreviewVariables(initialValues);
  };

  const initializeTestVariables = (event: string) => {
    const variables = templateVariables[event] || [];
    const initialValues: Record<string, string> = {};
    
    variables.forEach(variable => {
      initialValues[variable.name] = `Test ${variable.name.replace(/_/g, ' ')}`;
    });
    
    setTestData(prev => ({
      ...prev,
      variables: initialValues
    }));
  };

  const handleSendTest = async () => {
    if (!editingTemplate) return;
    
    setErrorMessage(null);
    setSuccessMessage(null);
    
    try {
      // Validate recipient based on template type
      if (editingTemplate.type === 'email' && !testData.recipient_email) {
        setErrorMessage('Email address is required for email templates');
        return;
      }
      
      if (editingTemplate.type === 'sms' && !testData.recipient_phone) {
        setErrorMessage('Phone number is required for SMS templates');
        return;
      }
      
      const result = await sendTestNotification({
        template_id: editingTemplate.id,
        recipient_email: testData.recipient_email || undefined,
        recipient_phone: testData.recipient_phone || undefined,
        recipient_user_id: testData.recipient_user_id || undefined,
        variables: testData.variables
      });
      
      setSuccessMessage(`Test ${editingTemplate.type} sent successfully to ${result.recipient}`);
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to send test notification');
      console.error('Failed to send test notification:', error);
    }
  };

  const renderPreview = () => {
    if (!selectedTemplate) return null;
    
    // Replace variables in subject and body
    let previewSubject = selectedTemplate.subject || '';
    let previewBody = selectedTemplate.body;
    
    Object.entries(previewVariables).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      if (previewSubject) previewSubject = previewSubject.replace(regex, value);
      previewBody = previewBody.replace(regex, value);
    });
    
    return (
      <div className="space-y-4">
        {selectedTemplate.type === 'email' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
              {previewSubject || '(No subject)'}
            </div>
          </div>
        )}
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Body</label>
          <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 whitespace-pre-wrap">
            {previewBody}
          </div>
        </div>
      </div>
    );
  };

  const getEventName = (event: string): string => {
    const eventMap: Record<string, string> = {
      'invitation': 'Visitor Invitation',
      'approval': 'Visit Approval',
      'rejection': 'Visit Rejection',
      'check_in': 'Check-in Confirmation',
      'check_out': 'Check-out Confirmation',
      'host_notification': 'Host Notification',
      'visitor_arrived': 'Visitor Arrived',
      'security_alert': 'Security Alert'
    };
    
    return eventMap[event] || event.replace('_', ' ');
  };

  const getTypeName = (type: string): string => {
    const typeMap: Record<string, string> = {
      'email': 'Email',
      'sms': 'SMS',
      'push': 'Push Notification'
    };
    
    return typeMap[type] || type;
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'email':
        return <Mail className="w-4 h-4 text-blue-600" />;
      case 'sms':
        return <MessageSquare className="w-4 h-4 text-green-600" />;
      case 'push':
        return <Bell className="w-4 h-4 text-purple-600" />;
      default:
        return <Bell className="w-4 h-4 text-gray-600" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'email':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'sms':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'push':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const insertVariable = (variable: string) => {
    // Insert the variable at the current cursor position in the body field
    const textarea = document.getElementById('template-body') as HTMLTextAreaElement;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const before = text.substring(0, start);
    const after = text.substring(end, text.length);
    const newText = `${before}{{${variable}}}${after}`;
    
    setFormData(prev => ({ ...prev, body: newText }));
    
    // Set the cursor position after the inserted variable
    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = start + variable.length + 4; // +4 for the {{ and }}
      textarea.selectionEnd = start + variable.length + 4;
    }, 0);
  };

  const insertVariableInSubject = (variable: string) => {
    // Insert the variable at the current cursor position in the subject field
    const input = document.getElementById('template-subject') as HTMLInputElement;
    if (!input) return;
    
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const text = input.value;
    const before = text.substring(0, start);
    const after = text.substring(end, text.length);
    const newText = `${before}{{${variable}}}${after}`;
    
    setFormData(prev => ({ ...prev, subject: newText }));
    
    // Set the cursor position after the inserted variable
    setTimeout(() => {
      input.focus();
      input.selectionStart = start + variable.length + 4; // +4 for the {{ and }}
      input.selectionEnd = start + variable.length + 4;
    }, 0);
  };

  if (showPreview && selectedTemplate) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => {
                  setShowPreview(false);
                  setSelectedTemplate(null);
                }}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{selectedTemplate.name}</h1>
                <div className="flex items-center space-x-3 mt-1">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getTypeColor(selectedTemplate.type)}`}>
                    {getTypeIcon(selectedTemplate.type)}
                    <span className="ml-1">{getTypeName(selectedTemplate.type)}</span>
                  </span>
                  <span className="text-sm text-gray-500">
                    Event: {getEventName(selectedTemplate.event)}
                  </span>
                  {selectedTemplate.is_default && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">
                      Default
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleEdit(selectedTemplate)}
                className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </button>
            </div>
          </div>
        </div>

        {/* Preview Controls */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Template Preview</h2>
            <button
              onClick={() => setShowVariables(!showVariables)}
              className="flex items-center text-sm text-blue-600 hover:text-blue-700"
            >
              {showVariables ? (
                <>
                  <ChevronUp className="w-4 h-4 mr-1" />
                  Hide Variables
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4 mr-1" />
                  Show Variables
                </>
              )}
            </button>
          </div>

          {/* Variables Editor */}
          {showVariables && (
            <div className="mb-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
              <h3 className="text-md font-medium text-gray-900 mb-3">Customize Preview Variables</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templateVariables[selectedTemplate.event]?.map(variable => (
                  <div key={variable.name}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {variable.name.replace(/_/g, ' ')}
                    </label>
                    <input
                      type="text"
                      value={previewVariables[variable.name] || ''}
                      onChange={(e) => setPreviewVariables(prev => ({
                        ...prev,
                        [variable.name]: e.target.value
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder={variable.description}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Preview */}
          {renderPreview()}
        </div>
      </div>
    );
  }

  if (showForm) {
    return (
      <div className="space-y-6">
        {/* Form Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            {editingTemplate ? 'Edit Notification Template' : 'Create Notification Template'}
          </h2>
          <button
            onClick={resetForm}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
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

        {/* Form */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-md font-medium text-gray-900 flex items-center">
                <Bell className="w-4 h-4 mr-2" />
                Template Information
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Template Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., Visitor Invitation Email"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notification Type *
                  </label>
                  <select
                    required
                    value={formData.type}
                    onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as 'email' | 'sms' | 'push' }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="email">Email</option>
                    <option value="sms">SMS</option>
                    <option value="push">Push Notification</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Event Type *
                  </label>
                  <select
                    required
                    value={formData.event}
                    onChange={(e) => setFormData(prev => ({ ...prev, event: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="invitation">Visitor Invitation</option>
                    <option value="approval">Visit Approval</option>
                    <option value="rejection">Visit Rejection</option>
                    <option value="check_in">Check-in Confirmation</option>
                    <option value="check_out">Check-out Confirmation</option>
                    <option value="host_notification">Host Notification</option>
                    <option value="visitor_arrived">Visitor Arrived</option>
                    <option value="security_alert">Security Alert</option>
                  </select>
                </div>

                <div className="flex items-center space-y-0 space-x-6 pt-6">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="is_active"
                      checked={formData.is_active}
                      onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="is_active" className="ml-2 block text-sm text-gray-900">
                      Active
                    </label>
                  </div>
                  
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="is_default"
                      checked={formData.is_default}
                      onChange={(e) => setFormData(prev => ({ ...prev, is_default: e.target.checked }))}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="is_default" className="ml-2 block text-sm text-gray-900">
                      Default Template
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Template Content */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-md font-medium text-gray-900 flex items-center">
                  <FileText className="w-4 h-4 mr-2" />
                  Template Content
                </h3>
                
                <button
                  type="button"
                  onClick={() => setShowVariables(!showVariables)}
                  className="text-sm text-blue-600 hover:text-blue-700 flex items-center"
                >
                  {showVariables ? (
                    <>
                      <ChevronUp className="w-4 h-4 mr-1" />
                      Hide Variables
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4 mr-1" />
                      Show Variables
                    </>
                  )}
                </button>
              </div>
              
              {showVariables && (
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mb-4">
                  <div className="flex items-center mb-2">
                    <Tag className="w-4 h-4 mr-2 text-blue-600" />
                    <h4 className="text-sm font-medium text-blue-800">Available Variables</h4>
                  </div>
                  <p className="text-xs text-blue-700 mb-3">
                    Click on a variable to insert it at the cursor position. Variables will be replaced with actual values when the notification is sent.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {templateVariables[formData.event]?.map(variable => (
                      <button
                        key={variable.name}
                        type="button"
                        onClick={() => formData.type === 'email' && formData.subject ? insertVariableInSubject(variable.name) : insertVariable(variable.name)}
                        className="inline-flex items-center px-2 py-1 bg-white border border-blue-300 rounded-md text-xs text-blue-700 hover:bg-blue-50"
                        title={variable.description}
                      >
                        {variable.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {formData.type === 'email' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Subject
                  </label>
                  <input
                    id="template-subject"
                    type="text"
                    value={formData.subject}
                    onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., You have been invited to visit {{facility_name}}"
                  />
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Body *
                </label>
                <textarea
                  id="template-body"
                  required
                  rows={10}
                  value={formData.body}
                  onChange={(e) => setFormData(prev => ({ ...prev, body: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                  placeholder="Enter template content with variables like {{visitor_name}}"
                />
              </div>
            </div>

            {/* Test Notification */}
            {editingTemplate && (
              <div className="space-y-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                <h3 className="text-md font-medium text-gray-900 flex items-center">
                  <Send className="w-4 h-4 mr-2" />
                  Send Test Notification
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {formData.type === 'email' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Recipient Email
                      </label>
                      <input
                        type="email"
                        value={testData.recipient_email}
                        onChange={(e) => setTestData(prev => ({ ...prev, recipient_email: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="test@example.com"
                      />
                    </div>
                  )}
                  
                  {formData.type === 'sms' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Recipient Phone
                      </label>
                      <input
                        type="tel"
                        value={testData.recipient_phone}
                        onChange={(e) => setTestData(prev => ({ ...prev, recipient_phone: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="+1234567890"
                      />
                    </div>
                  )}
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Test Variables
                    </label>
                    <button
                      type="button"
                      onClick={() => initializeTestVariables(formData.event)}
                      className="w-full px-3 py-2 text-sm text-left text-blue-600 bg-blue-50 border border-blue-300 rounded-md hover:bg-blue-100"
                    >
                      <RefreshCw className="w-4 h-4 inline mr-2" />
                      Initialize with test data
                    </button>
                  </div>
                  
                  <div className="md:col-span-1">
                    <LoadingButton
                      loading={loading}
                      variant="secondary"
                      size="md"
                      onClick={handleSendTest}
                    >
                      <Send className="w-4 h-4 mr-2" />
                      Send Test
                    </LoadingButton>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancel
              </button>
              
              <LoadingButton
                loading={loading}
                variant="primary"
                size="md"
                type="submit"
              >
                <Save className="w-4 h-4 mr-2" />
                {editingTemplate ? 'Update Template' : 'Create Template'}
              </LoadingButton>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">Notification Templates</h1>
            <p className="text-blue-100">
              Manage email, SMS, and push notification templates for various system events
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{templates.length}</div>
            <div className="text-blue-200 text-sm">Total Templates</div>
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
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search templates..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Type Filter */}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <select
                value={filters.type}
                onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value }))}
                className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
              >
                <option value="">All Types</option>
                <option value="email">Email</option>
                <option value="sms">SMS</option>
                <option value="push">Push Notification</option>
              </select>
            </div>

            {/* Event Filter */}
            <div className="relative">
              <select
                value={filters.event}
                onChange={(e) => setFilters(prev => ({ ...prev, event: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
              >
                <option value="">All Events</option>
                <option value="invitation">Visitor Invitation</option>
                <option value="approval">Visit Approval</option>
                <option value="rejection">Visit Rejection</option>
                <option value="check_in">Check-in Confirmation</option>
                <option value="check_out">Check-out Confirmation</option>
                <option value="host_notification">Host Notification</option>
                <option value="visitor_arrived">Visitor Arrived</option>
                <option value="security_alert">Security Alert</option>
              </select>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={loadTemplates}
              disabled={loading}
              className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Template
            </button>
          </div>
        </div>
      </div>

      {/* Templates List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Templates ({filteredTemplates.length})
          </h2>
        </div>

        {loading && templates.length === 0 ? (
          <Loading message="Loading templates..." />
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredTemplates.length === 0 ? (
              <div className="p-12 text-center">
                <Bell className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">No templates found</p>
                <p className="text-gray-400 text-sm">
                  {filters.search || filters.type || filters.event
                    ? 'Try adjusting your search or filter criteria'
                    : 'Start by adding your first notification template'
                  }
                </p>
                {!filters.search && !filters.type && !filters.event && (
                  <button
                    onClick={() => setShowForm(true)}
                    className="mt-4 inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add First Template
                  </button>
                )}
              </div>
            ) : (
              filteredTemplates.map((template) => (
                <div key={template.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 flex-1">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        template.type === 'email' ? 'bg-blue-100' : 
                        template.type === 'sms' ? 'bg-green-100' : 'bg-purple-100'
                      }`}>
                        {getTypeIcon(template.type)}
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-lg font-medium text-gray-900">
                            {template.name}
                          </h3>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getTypeColor(template.type)}`}>
                            {getTypeName(template.type)}
                          </span>
                          {template.is_default && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">
                              Default
                            </span>
                          )}
                          {!template.is_active && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
                              Inactive
                            </span>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                          <div className="flex items-center">
                            <Tag className="w-4 h-4 mr-2 text-gray-400" />
                            <span>Event: {getEventName(template.event)}</span>
                          </div>
                          {template.subject && (
                            <div className="flex items-center">
                              <Mail className="w-4 h-4 mr-2 text-gray-400" />
                              <span className="truncate">Subject: {template.subject}</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="mt-2 text-sm text-gray-500">
                          <p className="line-clamp-1">
                            {template.body.substring(0, 100)}{template.body.length > 100 ? '...' : ''}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => handlePreview(template)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Preview Template"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEdit(template)}
                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Edit Template"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      {!template.is_default && (
                        <button
                          onClick={() => handleDelete(template.id, template.name)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete Template"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Information Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-blue-800">About Notification Templates</h3>
            <p className="text-sm text-blue-700 mt-1">
              Notification templates allow you to customize the messages sent to visitors and hosts for various events in the system.
            </p>
            <p className="text-sm text-blue-700 mt-1">
              Use variables like <code className="bg-blue-100 px-1 py-0.5 rounded">{'{{visitor_name}}'}</code> to include dynamic content in your templates.
              Each template type (Email, SMS, Push) has different formatting requirements.
            </p>
            <p className="text-sm text-blue-700 mt-1">
              Default templates are used when no other template is specified for a particular event and notification type.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};