import { useState, useCallback } from 'react';
import { visitorService } from '../services/visitors';
import type { Visitor, Visit, Host, Facility, Badge } from '../types/visitor';

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export const useVisitors = () => {
  const [visitsLoading, setVisitsLoading] = useState(false);
  const [visitsError, setVisitsError] = useState<string | null>(null);
  const [visits, setVisits] = useState<any[]>([]);
  const [paginationData, setPaginationData] = useState<PaginationData>({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  });

  const clearError = () => setVisitsError(null);

  // Visitor operations
  const createVisitor = useCallback(async (visitorData: Omit<Visitor, 'id' | 'created_at' | 'updated_at'>): Promise<Visitor> => {
    setVisitsLoading(true);
    setVisitsError(null);
    
    try {
      const visitor = await visitorService.createVisitor(visitorData);
      return visitor;
    } catch (err: any) {
      setVisitsError(err.message);
      throw err;
    } finally {
      setVisitsLoading(false);
    }
  }, []);

  const updateVisitor = useCallback(async (id: string, updates: Partial<Visitor>): Promise<Visitor> => {
    setVisitsLoading(true);
    setVisitsError(null);
    
    try {
      const visitor = await visitorService.updateVisitor(id, updates);
      return visitor;
    } catch (err: any) {
      setVisitsError(err.message);
      throw err;
    } finally {
      setVisitsLoading(false);
    }
  }, []);

  const getVisitors = useCallback(async (limit = 20, offset = 0): Promise<Visitor[]> => {
    setVisitsLoading(true);
    setVisitsError(null);
    
    try {
      const response = await visitorService.getVisitors(limit, offset);
      
      // Update pagination data
      if (response.pagination) {
        setPaginationData({
          page: response.pagination.page,
          limit: response.pagination.limit,
          total: response.pagination.total,
          pages: response.pagination.pages
        });
      }
      
      return response.visitors;
    } catch (err: any) {
      setVisitsError(err.message);
      throw err;
    } finally {
      setVisitsLoading(false);
    }
  }, []);

  const searchVisitors = useCallback(async (query: string): Promise<Visitor[]> => {
    setVisitsLoading(true);
    setVisitsError(null);
    
    try {
      const visitors = await visitorService.searchVisitors(query);
      return visitors;
    } catch (err: any) {
      setVisitsError(err.message);
      throw err;
    } finally {
      setVisitsLoading(false);
    }
  }, []);

  // Visit operations
  const createVisit = useCallback(async (visitData: Omit<Visit, 'id' | 'created_at' | 'updated_at'>): Promise<Visit> => {
    setVisitsLoading(true);
    setVisitsError(null);
    
    try {
      const visit = await visitorService.createVisit(visitData);
      return visit;
    } catch (err: any) {
      setVisitsError(err.message);
      throw err;
    } finally {
      setVisitsLoading(false);
    }
  }, []);

  const updateVisit = useCallback(async (id: string, updates: Partial<Visit>): Promise<Visit> => {
    setVisitsLoading(true);
    setVisitsError(null);
    
    try {
      const visit = await visitorService.updateVisit(id, updates);
      return visit;
    } catch (err: any) {
      setVisitsError(err.message);
      throw err;
    } finally {
      setVisitsLoading(false);
    }
  }, []);

  const getVisits = useCallback(async (facilityId?: string, date?: string, page = 1, limit = 20, startDate?: string, endDate?: string): Promise<Visit[]> => {
    setVisitsLoading(true);
    setVisitsError(null);
    
    try {
      const response = await visitorService.getVisits(facilityId, date, page, limit, startDate, endDate);
      
      // Debug: Log the response from the API
      console.log('useVisitors getVisits response:', response);
      
      // Update pagination data if available
      if (response && 'pagination' in response) {
        setPaginationData({
          page: response.pagination.page,
          limit: response.pagination.limit,
          total: response.pagination.total,
          pages: response.pagination.pages
        });
        // Update visits state
        const visitsArray = Array.isArray(response.visits) ? response.visits : [];
        setVisits(visitsArray);
        return response.visits;
      }
      
      return [];
    } catch (err: any) {
      setVisitsError(err.message);
      throw err;
    } finally {
      setVisitsLoading(false);
    }
  }, []);

  const getTodaysVisits = useCallback(async (facilityId?: string): Promise<{
    visits: Visit[];
  }> => {
    setVisitsLoading(true);
    setVisitsError(null);
    
    try {
      const response = await visitorService.getTodaysVisits(facilityId);
      // Ensure visits is always an array
      const visitsArray = Array.isArray(response.visits) ? response.visits : [];
      setVisits(visitsArray);
      return response;
    } catch (err: any) {
      setVisitsError(err.message);
      throw err;
    } finally {
      setVisitsLoading(false);
    }
  }, []);

  const checkInVisitor = useCallback(async (visitId: string, location?: string): Promise<Visit> => {
    setVisitsLoading(true);
    setVisitsError(null);
    
    try {
      const visit = await visitorService.checkInVisitor(visitId, location);
      // Update the visit in our local state
      setVisits(prev => {
        const safeVisits = Array.isArray(prev) ? prev : [];
        return safeVisits.map(v => v.id === visit.id ? { ...v, ...visit } : v);
      });
      return visit;
    } catch (err: any) {
      setVisitsError(err.message);
      throw err;
    } finally {
      setVisitsLoading(false);
    }
  }, []);

  // Renamed and re-implemented for GET /api/qr-check-in validation
  const getVisitDetailsByQrToken = useCallback(async (qrToken: string): Promise<Visit> => {
    setVisitsLoading(true);
    setVisitsError(null);
    try {
      const visit = await visitorService.getVisitDetailsByQrToken(qrToken);
      return visit;
    } catch (err: any) {
      setVisitsError(err.message);
      throw err;
    } finally {
      setVisitsLoading(false);
    }
  }, [visitorService]); // ADDED visitorService to dependencies

  const qrCheckInVisitor = useCallback(async (qrToken: string, location?: string, badgeType: 'printed' | 'civ_piv_i' = 'printed'): Promise<{
    visit: Visit;
    badge: Badge;
  }> => {
    setVisitsLoading(true);
    setVisitsError(null);
    
    try {
      const result = await visitorService.qrCheckInVisitor(qrToken, location, badgeType);
      // Update the visit in our local state
      setVisits(prev => {
        const safeVisits = Array.isArray(prev) ? prev : [];
        return safeVisits.map(v => v.id === result.visit.id ? { ...v, ...result.visit } : v);
      });
      return result;
    } catch (err: any) {
      setVisitsError(err.message);
      throw err;
    } finally {
      setVisitsLoading(false);
    }
  }, []);

  const checkOutVisitor = useCallback(async (visitId: string, location?: string): Promise<Visit> => {
    setVisitsLoading(true);
    setVisitsError(null);
    
    try {
      const visit = await visitorService.checkOutVisitor(visitId, location);
      // Update the visit in our local state
      setVisits(prev => {
        const safeVisits = Array.isArray(prev) ? prev : [];
        return safeVisits.map(v => v.id === visit.id ? { ...v, ...visit } : v);
      });
      return visit;
    } catch (err: any) {
      setVisitsError(err.message);
      throw err;
    } finally {
      setVisitsLoading(false);
    }
  }, []);

  // Host operations
  const getHosts = useCallback(async (facilityId?: string): Promise<Host[]> => {
    setVisitsLoading(true);
    setVisitsError(null);
    
    try {
      const hosts = await visitorService.getHosts(facilityId);
      return hosts;
    } catch (err: any) {
      setVisitsError(err.message);
      throw err;
    } finally {
      setVisitsLoading(false);
    }
  }, []);

  const getHostsByProfile = useCallback(async (profileId: string): Promise<Host[]> => {
    setVisitsLoading(true);
    setVisitsError(null);
    
    try {
      const hosts = await visitorService.getHostsByProfile(profileId);
      return hosts;
    } catch (err: any) {
      setVisitsError(err.message);
      throw err;
    } finally {
      setVisitsLoading(false);
    }
  }, []);

  const createHost = useCallback(async (hostData: {
    profile_id: string;
    facility_id: string;
    notification_preferences?: any;
    max_concurrent_visitors?: number;
    is_available?: boolean;
  }): Promise<Host> => {
    setVisitsLoading(true);
    setVisitsError(null);
    
    try {
      const host = await visitorService.createHost(hostData);
      return host;
    } catch (err: any) {
      setVisitsError(err.message);
      throw err;
    } finally {
      setVisitsLoading(false);
    }
  }, []);

  const updateHost = useCallback(async (id: string, updates: {
    notification_preferences?: any;
    max_concurrent_visitors?: number;
    is_available?: boolean;
  }): Promise<Host> => {
    setVisitsLoading(true);
    setVisitsError(null);
    
    try {
      const host = await visitorService.updateHost(id, updates);
      return host;
    } catch (err: any) {
      setVisitsError(err.message);
      throw err;
    } finally {
      setVisitsLoading(false);
    }
  }, []);

  const deactivateHost = useCallback(async (id: string): Promise<void> => {
    setVisitsLoading(true);
    setVisitsError(null);
    
    try {
      await visitorService.deactivateHost(id);
    } catch (err: any) {
      setVisitsError(err.message);
      throw err;
    } finally {
      setVisitsLoading(false);
    }
  }, []);

  // Facility operations
  const getFacilities = useCallback(async (): Promise<Facility[]> => {
    setVisitsLoading(true);
    setVisitsError(null);
    
    try {
      const facilities = await visitorService.getFacilities();
      return facilities;
    } catch (err: any) {
      setVisitsError(err.message);
      throw err;
    } finally {
      setVisitsLoading(false);
    }
  }, []);

  const createFacility = useCallback(async (facilityData: Omit<Facility, 'id' | 'created_at' | 'updated_at'>): Promise<Facility> => {
    setVisitsLoading(true);
    setVisitsError(null);
    
    try {
      const facility = await visitorService.createFacility(facilityData);
      return facility;
    } catch (err: any) {
      setVisitsError(err.message);
      throw err;
    } finally {
      setVisitsLoading(false);
    }
  }, []);

  const updateFacility = useCallback(async (id: string, updates: Partial<Facility>): Promise<Facility> => {
    try {
      const response = await visitorService.updateFacility(id, updates);

      return response;
    } catch (err: any) {
      setVisitsError(err.message);
      throw err;
    } finally {
      setVisitsLoading(false);
    }
  }, []);

  // Badge management
  const createBadge = useCallback(async (visitId: string, accessZones: string[] = [], badgeType: 'printed' | 'civ_piv_i' = 'printed'): Promise<Badge> => {
    setVisitsLoading(true);
    setVisitsError(null);
    
    try {
      const badge = await visitorService.createBadge(visitId, accessZones, badgeType);
      return badge;
    } catch (err: any) {
      setVisitsError(err.message);
      throw err;
    } finally {
      setVisitsLoading(false);
    }
  }, []);

  const deactivateBadge = useCallback(async (badgeId: string): Promise<void> => {
    setVisitsLoading(true);
    setVisitsError(null);
    
    try {
      await visitorService.deactivateBadge(badgeId);
    } catch (err: any) {
      setVisitsError(err.message);
      throw err;
    } finally {
      setVisitsLoading(false);
    }
  }, []);

  const reportBadgeLost = useCallback(async (badgeId: string): Promise<void> => {
    setVisitsLoading(true);
    setVisitsError(null);
    
    try {
      await visitorService.reportBadgeLost(badgeId);
    } catch (err: any) {
      setVisitsError(err.message);
      throw err;
    } finally {
      setVisitsLoading(false);
    }
  }, []);

  const getVisitStats = useCallback(async (facilityId?: string, days = 30): Promise<any> => {
    setVisitsLoading(true);
    setVisitsError(null);
    
    try {
      const stats = await visitorService.getVisitStats(facilityId, days);
      return stats;
    } catch (err: any) {
      setVisitsError(err.message);
      throw err;
    } finally {
      setVisitsLoading(false);
    }
  }, []);

  // Calendar export
  const exportCalendar = useCallback(async (format: string = 'ics', filters?: any): Promise<Blob> => {
    setVisitsLoading(true);
    setVisitsError(null);
    
    try {
      const blob = await visitorService.exportCalendar(format, filters);
      return blob;
    } catch (err: any) {
      setVisitsError(err.message);
      throw err;
    } finally {
      setVisitsLoading(false);
    }
  }, []);

  // Security operations
  // Assuming securityService is imported and available
  // const getSecurityStats = useCallback(async (): Promise<any> => {
  //   setVisitsLoading(true);
  //   setVisitsError(null);
    
  //   try {
  //     const stats = await securityService.getSecurityStats();
  //     return stats;
  //   } catch (err: any) {
  //     setVisitsError(err.message);
  //     throw err;
  //   } finally {
  //     setVisitsLoading(false);
  //   }
  // }, []);

  return {
    visits,
    visitsLoading,
    visitsError,
    paginationData,
    clearError,
    // Visitor operations
    createVisitor,
    updateVisitor,
    getVisitors,
    searchVisitors,
    // Visit operations
    createVisit,
    updateVisit,
    getVisits,
    getTodaysVisits,
    checkInVisitor,
    checkOutVisitor,
    getVisitDetailsByQrToken, // Ensure this is returned
    qrCheckInVisitor,
    // Host operations
    getHosts,
    getHostsByProfile,
    createHost,
    updateHost,
    deactivateHost,
    // Facility operations
    getFacilities,
    createFacility,
    updateFacility,
    // Badge operations
    createBadge,
    deactivateBadge,
    reportBadgeLost,
    // Statistics operations
    getVisitStats,
    // Calendar operations
    exportCalendar,
    // Security operations (if needed)
    // getSecurityStats
  };
};
