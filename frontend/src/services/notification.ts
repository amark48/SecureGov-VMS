import { apiClient } from './api';

export interface NotificationTemplate {
  id: string;
  tenant_id: string;
  name: string;
  subject: string | null;
  body: string;
  type: 'email' | 'sms' | 'push';
  event: string;
  is_active: boolean;
  is_default: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface NotificationLog {
  id: string;
  tenant_id: string;
  template_id: string | null;
  recipient_email: string | null;
  recipient_phone: string | null;
  recipient_user_id: string | null;
  subject: string | null;
  body: string;
  type: 'email' | 'sms' | 'push';
  event: string;
  status: 'sent' | 'failed' | 'pending';
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
  template_name?: string;
  recipient_name?: string;
}

export interface TemplateVariable {
  name: string;
  description: string;
}

export class NotificationService {
  async getTemplates(): Promise<NotificationTemplate[]> {
    try {
      const response = await apiClient.get<{
        templates: NotificationTemplate[];
      }>('/api/notifications/templates');

      return response.templates;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to fetch notification templates');
    }
  }

  async getTemplate(id: string): Promise<NotificationTemplate> {
    try {
      const response = await apiClient.get<{
        template: NotificationTemplate;
      }>(`/api/notifications/templates/${id}`);

      return response.template;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to fetch notification template');
    }
  }

  async createTemplate(templateData: Omit<NotificationTemplate, 'id' | 'tenant_id' | 'created_by' | 'created_at' | 'updated_at'>): Promise<NotificationTemplate> {
    try {
      const response = await apiClient.post<{
        message: string;
        template: NotificationTemplate;
      }>('/api/notifications/templates', templateData);

      return response.template;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to create notification template');
    }
  }

  async updateTemplate(id: string, updates: Partial<NotificationTemplate>): Promise<NotificationTemplate> {
    try {
      const response = await apiClient.put<{
        message: string;
        template: NotificationTemplate;
      }>(`/api/notifications/templates/${id}`, updates);

      return response.template;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to update notification template');
    }
  }

  async deleteTemplate(id: string): Promise<void> {
    try {
      await apiClient.delete(`/api/notifications/templates/${id}`);
    } catch (error: any) {
      throw new Error(error.message || 'Failed to delete notification template');
    }
  }

  async getNotificationLogs(page = 1, limit = 20, filters?: {
    type?: string;
    event?: string;
    status?: string;
    recipient_id?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<{
    logs: NotificationLog[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }> {
    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', limit.toString());
      
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value) params.append(key, value);
        });
      }

      const response = await apiClient.get<{
        logs: NotificationLog[];
        pagination: {
          page: number;
          limit: number;
          total: number;
          pages: number;
        };
      }>(`/api/notifications/logs?${params.toString()}`);

      return response;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to fetch notification logs');
    }
  }

  async sendTestNotification(data: {
    template_id: string;
    recipient_email?: string;
    recipient_phone?: string;
    recipient_user_id?: string;
    variables?: Record<string, string>;
  }): Promise<{
    id: string;
    type: string;
    recipient: string;
    subject: string | null;
    body: string;
    sent_at: string;
  }> {
    try {
      const response = await apiClient.post<{
        message: string;
        notification: {
          id: string;
          type: string;
          recipient: string;
          subject: string | null;
          body: string;
          sent_at: string;
        };
      }>('/api/notifications/send-test', data);

      return response.notification;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to send test notification');
    }
  }

  async getTemplateVariables(): Promise<Record<string, TemplateVariable[]>> {
    try {
      const response = await apiClient.get<{
        variables: Record<string, TemplateVariable[]>;
      }>('/api/notifications/template-variables');

      return response.variables;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to fetch template variables');
    }
  }
}

export const notificationService = new NotificationService();