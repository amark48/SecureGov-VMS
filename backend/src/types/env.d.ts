declare global {
  namespace NodeJS {
    interface ProcessEnv {
      DB_HOST?: string;
      DB_PORT?: string;
      DB_NAME?: string;
      DB_USER?: string;
      DB_PASSWORD?: string;
      PORT?: string;
      NODE_ENV?: 'development' | 'production' | 'test';
      JWT_SECRET: string; // Mark as required since your code checks for it
      JWT_EXPIRES_IN?: string;
      REFRESH_TOKEN_SECRET?: string;
      BCRYPT_ROUNDS?: string;
      SESSION_TIMEOUT?: string;
      MFA_ENABLED?: string;
      AUDIT_LOGGING?: string;
      FICAM_COMPLIANCE?: string;
      FIPS_140_COMPLIANCE?: string;
      HIPAA_COMPLIANCE?: string;
      FERPA_COMPLIANCE?: string;
      ENABLE_WATCHLIST_SCREENING?: string;
      ENABLE_BACKGROUND_CHECKS?: string;
      ENABLE_BADGE_PRINTING?: string;
      ENABLE_EMERGENCY_FEATURES?: string;
      MAX_FILE_SIZE?: string;
      UPLOAD_PATH?: string;
      ALLOWED_FILE_TYPES?: string;
      RATE_LIMIT_WINDOW_MS?: string;
      RATE_LIMIT_MAX_REQUESTS?: string;
      SMTP_HOST?: string;
      SMTP_PORT?: string;
      SMTP_USER?: string;
      SMTP_PASS?: string;
      FROM_EMAIL?: string;
      LOG_LEVEL?: string;
      LOG_FILE?: string;
    }
  }
}

export {}; // This is necessary to make this file a module