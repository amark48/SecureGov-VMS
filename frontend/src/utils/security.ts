import { WATCHLIST_LEVELS, COMPLIANCE_STANDARDS } from './constants';

export class SecurityUtils {
  // Data sanitization
  static sanitizeInput(input: string): string {
    return input
      .trim()
      .replace(/[<>\"'&]/g, '')
      .substring(0, 1000); // Limit length
  }

  static sanitizeEmail(email: string): string {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const sanitized = this.sanitizeInput(email.toLowerCase());
    return emailRegex.test(sanitized) ? sanitized : '';
  }

  static sanitizePhone(phone: string): string {
    return phone.replace(/[^\d\-\+\(\)\s]/g, '').substring(0, 20);
  }

  // Data validation
  static validateSecurityClearance(clearance: string): boolean {
    const validClearances = ['unclassified', 'confidential', 'secret', 'top_secret'];
    return validClearances.includes(clearance.toLowerCase());
  }

  static validateThreatLevel(level: string): boolean {
    return Object.values(WATCHLIST_LEVELS).includes(level as any);
  }

  // Watchlist screening utilities
  static calculateNameSimilarity(name1: string, name2: string): number {
    const normalize = (str: string) => str.toLowerCase().replace(/[^a-z]/g, '');
    const n1 = normalize(name1);
    const n2 = normalize(name2);

    if (n1 === n2) return 1;

    // Simple Levenshtein distance for fuzzy matching
    const matrix = Array(n2.length + 1).fill(null).map(() => Array(n1.length + 1).fill(null));

    for (let i = 0; i <= n1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= n2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= n2.length; j++) {
      for (let i = 1; i <= n1.length; i++) {
        const indicator = n1[i - 1] === n2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }

    const maxLength = Math.max(n1.length, n2.length);
    return maxLength === 0 ? 1 : 1 - matrix[n2.length][n1.length] / maxLength;
  }

  // Access control utilities
  static hasRequiredRole(userRole: string, requiredRoles: string[]): boolean {
    return requiredRoles.includes(userRole);
  }

  static canAccessSecurityFeatures(userRole: string): boolean {
    return ['admin', 'security'].includes(userRole);
  }

  static canManageVisitors(userRole: string): boolean {
    return ['admin', 'security', 'reception'].includes(userRole);
  }

  static canViewAuditLogs(userRole: string): boolean {
    return ['admin', 'security'].includes(userRole);
  }

  // Compliance utilities
  static generateComplianceMetadata(action: string, tableName: string): string[] {
    const flags: string[] = [];

    // FICAM compliance
    if (['login', 'logout', 'check_in', 'check_out'].includes(action)) {
      flags.push('FICAM');
    }

    // HIPAA compliance for visitor data
    if (tableName === 'visitors' || tableName === 'visits') {
      flags.push('HIPAA');
    }

    // FERPA compliance for educational institutions
    if (tableName === 'visits' && action === 'create') {
      flags.push('FERPA');
    }

    // FIPS 140 compliance for all authentication actions
    if (action === 'login' || action === 'logout') {
      flags.push('FIPS_140');
    }

    return flags;
  }

  // Encryption utilities (for sensitive data)
  static async hashSensitiveData(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Session security
  static generateSecureToken(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  static isSessionExpired(sessionStart: string, maxDurationHours = 8): boolean {
    const sessionTime = new Date(sessionStart).getTime();
    const now = Date.now();
    const maxDuration = maxDurationHours * 60 * 60 * 1000;
    return (now - sessionTime) > maxDuration;
  }

  // Badge security
  static generateBadgeQRCode(visitId: string, badgeNumber: string): string {
    const data = {
      visit_id: visitId,
      badge_number: badgeNumber,
      issued_at: new Date().toISOString(),
      security_hash: this.generateSecureToken()
    };
    return JSON.stringify(data);
  }

  static validateBadgeQRCode(qrData: string): boolean {
    try {
      const data = JSON.parse(qrData);
      return data.visit_id && data.badge_number && data.issued_at && data.security_hash;
    } catch {
      return false;
    }
  }

  // Emergency response utilities
  static prioritizeEmergencyContacts(contacts: any[], emergencyType: string): any[] {
    const priorityMap: Record<string, string[]> = {
      fire: ['fire_safety', 'emergency', 'security'],
      medical: ['medical', 'emergency', 'security'],
      security: ['security', 'emergency', 'administration'],
      evacuation: ['emergency', 'security', 'fire_safety', 'administration']
    };

    const priorities = priorityMap[emergencyType] || ['emergency', 'security'];
    
    return contacts.sort((a, b) => {
      const aPriority = priorities.indexOf(a.contact_type);
      const bPriority = priorities.indexOf(b.contact_type);
      
      if (aPriority === -1 && bPriority === -1) return 0;
      if (aPriority === -1) return 1;
      if (bPriority === -1) return -1;
      
      return aPriority - bPriority;
    });
  }

  // Risk assessment
  static assessVisitorRisk(visitor: any, watchlistMatches: any[]): {
    level: 'low' | 'medium' | 'high' | 'critical';
    factors: string[];
    recommendation: string;
  } {
    const factors: string[] = [];
    let riskScore = 0;

    // Watchlist matches
    if (watchlistMatches.length > 0) {
      const highestThreat = watchlistMatches.reduce((max, match) => {
        const levels = { low: 1, medium: 2, high: 3, critical: 4 };
        return levels[match.threat_level as keyof typeof levels] > levels[max.threat_level as keyof typeof levels] ? match : max;
      });

      factors.push(`Watchlist match: ${highestThreat.threat_level} threat`);
      riskScore += { low: 1, medium: 3, high: 7, critical: 10 }[highestThreat.threat_level as keyof typeof { low: 1, medium: 3, high: 7, critical: 10 }];
    }

    // Background check status
    if (visitor.background_check_status === 'failed') {
      factors.push('Failed background check');
      riskScore += 5;
    } else if (visitor.background_check_status === 'pending') {
      factors.push('Pending background check');
      riskScore += 2;
    }

    // Blacklist status
    if (visitor.is_blacklisted) {
      factors.push('Blacklisted individual');
      riskScore += 8;
    }

    // Missing identification
    if (!visitor.id_number) {
      factors.push('No identification provided');
      riskScore += 1;
    }

    // Determine risk level and recommendation
    let level: 'low' | 'medium' | 'high' | 'critical';
    let recommendation: string;

    if (riskScore >= 8) {
      level = 'critical';
      recommendation = 'DENY ACCESS - Contact security immediately';
    } else if (riskScore >= 5) {
      level = 'high';
      recommendation = 'Requires security approval and escort';
    } else if (riskScore >= 2) {
      level = 'medium';
      recommendation = 'Additional verification recommended';
    } else {
      level = 'low';
      recommendation = 'Standard access procedures';
    }

    return { level, factors, recommendation };
  }
}

export const securityUtils = SecurityUtils;