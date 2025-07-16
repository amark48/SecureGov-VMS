import { useState, useCallback } from 'react';
import { notificationService, NotificationTemplate, NotificationLog, TemplateVariable } from '../services/notification';

export interface PaginationData {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export const useNotification = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paginationData, setPaginationData] = useState<PaginationData>({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  });

  const clearError = () => setError(null);

  const getTemplates = useCallback(async (type?: string, event?: string) => {

    setLoading(true);
    setError(null);
    
    try {
      // Build query parameters if type or event is provided
      const params = new URLSearchParams();
      if (type) params.append('type', type);
      if (event) params.append('event', event);
      
      const queryString = params.toString();
      const endpoint = queryString ? `/api/notifications/templates?${queryString}` : '/api/notifications/templates';
      
      const templates = await notificationService.getTemplates(endpoint);

      return templates;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getTemplate = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const template = await notificationService.getTemplate(id);
      return template;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const createTemplate = useCallback(async (templateData: Omit<NotificationTemplate, 'id' | 'tenant_id' | 'created_by' | 'created_at' | 'updated_at'>) => {
    setLoading(true);
    setError(null);
    
    try {
      const template = await notificationService.createTemplate(templateData);
      return template;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateTemplate = useCallback(async (id: string, updates: Partial<NotificationTemplate>) => {
    setLoading(true);
    setError(null);
    
    try {
      const template = await notificationService.updateTemplate(id, updates);
      return template;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteTemplate = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    
    try {
      await notificationService.deleteTemplate(id);
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getNotificationLogs = useCallback(async (page = 1, limit = 20, filters?: {
    type?: string;
    event?: string;
    status?: string;
    recipient_id?: string;
    start_date?: string;
    end_date?: string;
  }) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await notificationService.getNotificationLogs(page, limit, filters);
      
      // Update pagination data
      setPaginationData({
        page: response.pagination.page,
        limit: response.pagination.limit,
        total: response.pagination.total,
        pages: response.pagination.pages
      });
      
      return response.logs;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const sendTestNotification = useCallback(async (data: {
    template_id: string;
    recipient_email?: string;
    recipient_phone?: string;
    recipient_user_id?: string;
    variables?: Record<string, string>;
  }) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await notificationService.sendTestNotification(data);
      return result;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getTemplateVariables = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const variables = await notificationService.getTemplateVariables();
      return variables;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    paginationData,
    clearError,
    getTemplates,
    getTemplate,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    getNotificationLogs,
    sendTestNotification,
    getTemplateVariables
  };
};