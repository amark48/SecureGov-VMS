import nodemailer from 'nodemailer';
import { query, transaction } from '../config/database';
import { createError } from '../middleware/errorHandler';
import sgMail from '@sendgrid/mail';
import mailgun from 'mailgun-js';
import twilio from 'twilio';
import * as admin from 'firebase-admin';

export class NotificationService {
  private transporter: nodemailer.Transporter | null = null;
  private sendgridClient: typeof sgMail | null = null;
  private mailgunClient: mailgun.Mailgun | null = null;
  private twilioClient: twilio.Twilio | null = null;
  private fcmInitialized: boolean = false;
  private onesignalAppId: string | null = null;
  private onesignalApiKey: string | null = null;

  constructor() {
    // Initialize Firebase Admin SDK for FCM if not already initialized
    if (!this.fcmInitialized && process.env.FIREBASE_ADMIN_SDK_CONFIG) {
      try {
        admin.initializeApp({
          credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_ADMIN_SDK_CONFIG))
        });
        this.fcmInitialized = true;
      } catch (error) {
        console.error('Failed to initialize Firebase Admin SDK:', error);
      }
    }
  }

  /**
   * Initialize email transporter based on tenant settings
   */
  private async initializeEmailTransporter(tenantId: string): Promise<void> {
    try {
      console.log(`[NotificationService] Initializing email transporter for tenant ${tenantId}`);
      const tenantResult = await query(
        `
        SELECT email_provider, email_config
        FROM tenants
        WHERE id = $1
        `,
        [tenantId]
      );

      if (tenantResult.rows.length === 0) {
        console.error(`[NotificationService] Tenant not found: ${tenantId}`);
        throw new Error('Tenant not found');
      }

      const { email_provider, email_config } = tenantResult.rows[0];
      console.log(`[NotificationService] Email provider: ${email_provider}, config:`, email_config);

      switch (email_provider) {
        case 'smtp': {
          console.log(
            `[NotificationService] Setting up SMTP transporter with host: ${email_config.host || process.env.SMTP_HOST}`
          );
          let secure = email_config.secure || process.env.SMTP_SECURE === 'true';
          const port = email_config.port || parseInt(process.env.SMTP_PORT || '587');

          if (port === 587) {
            secure = false;
          }

          this.transporter = nodemailer.createTransport({
            host: email_config.host || process.env.SMTP_HOST || 'smtp.example.com',
            port,
            secure,
            auth: {
              user: email_config.user || process.env.SMTP_USER || '',
              pass: email_config.pass || process.env.SMTP_PASS || '',
            },
            ...(port === 587 ? { requireTLS: true } : {}),
            tls: {
              rejectUnauthorized: process.env.NODE_ENV === 'production',
            },
          });
          break;
        }

        case 'sendgrid':
          if (email_config.api_key || process.env.SENDGRID_API_KEY) {
            console.log(`[NotificationService] Setting up SendGrid client`);
            sgMail.setApiKey(email_config.api_key || process.env.SENDGRID_API_KEY || '');
            this.sendgridClient = sgMail;
          } else {
            console.error(`[NotificationService] SendGrid API key not configured`);
            throw new Error('SendGrid API key not configured');
          }
          break;

        case 'mailgun':
          if (
            (email_config.api_key || process.env.MAILGUN_API_KEY) &&
            (email_config.domain || process.env.MAILGUN_DOMAIN)
          ) {
            console.log(
              `[NotificationService] Setting up Mailgun client with domain: ${
                email_config.domain || process.env.MAILGUN_DOMAIN
              }`
            );
            this.mailgunClient = mailgun({
              apiKey: email_config.api_key || process.env.MAILGUN_API_KEY || '',
              domain: email_config.domain || process.env.MAILGUN_DOMAIN || '',
            });
          } else {
            console.error(`[NotificationService] Mailgun API key or domain not configured`);
            throw new Error('Mailgun API key or domain not configured');
          }
          break;

        default:
          console.error(`[NotificationService] Unsupported email provider: ${email_provider}`);
          throw new Error(`Unsupported email provider: ${email_provider}`);
      }
    } catch (error) {
      console.error('Failed to initialize email transporter:', error);
      throw error;
    }
  }

  /**
   * Initialize SMS client based on tenant settings
   */
  private async initializeSmsClient(tenantId: string): Promise<void> {
    try {
      console.log(`[NotificationService] Initializing SMS client for tenant ${tenantId}`);
      const tenantResult = await query(
        `
        SELECT sms_provider, sms_config
        FROM tenants
        WHERE id = $1
        `,
        [tenantId]
      );

      if (tenantResult.rows.length === 0) {
        console.error(`[NotificationService] Tenant not found: ${tenantId}`);
        throw new Error('Tenant not found');
      }

      const { sms_provider, sms_config } = tenantResult.rows[0];
      console.log(`[NotificationService] SMS provider: ${sms_provider}, config:`, sms_config);

      switch (sms_provider) {
        case 'twilio':
          if (
            (sms_config.account_sid || process.env.TWILIO_ACCOUNT_SID) &&
            (sms_config.auth_token || process.env.TWILIO_AUTH_TOKEN)
          ) {
            console.log(`[NotificationService] Setting up Twilio client`);
            this.twilioClient = twilio(
              sms_config.account_sid || process.env.TWILIO_ACCOUNT_SID || '',
              sms_config.auth_token || process.env.TWILIO_AUTH_TOKEN || ''
            );
          } else {
            console.error(`[NotificationService] Twilio account SID or auth token not configured`);
            throw new Error('Twilio account SID or auth token not configured');
          }
          break;

        case 'none':
          console.log(`[NotificationService] No SMS provider configured`);
          break;

        default:
          console.error(`[NotificationService] Unsupported SMS provider: ${sms_provider}`);
          throw new Error(`Unsupported SMS provider: ${sms_provider}`);
      }
    } catch (error) {
      console.error('Failed to initialize SMS client:', error);
      throw error;
    }
  }

  /**
   * Initialize push notification client based on tenant settings
   */
  private async initializePushClient(tenantId: string): Promise<void> {
    try {
      console.log(`[NotificationService] Initializing push client for tenant ${tenantId}`);
      const tenantResult = await query(
        `
        SELECT push_provider, push_config
        FROM tenants
        WHERE id = $1
        `,
        [tenantId]
      );

      if (tenantResult.rows.length === 0) {
        console.error(`[NotificationService] Tenant not found: ${tenantId}`);
        throw new Error('Tenant not found');
      }

      const { push_provider, push_config } = tenantResult.rows[0];
      console.log(`[NotificationService] Push provider: ${push_provider}, config:`, push_config);

      switch (push_provider) {
        case 'fcm':
          if (!this.fcmInitialized) {
            console.error(`[NotificationService] Firebase Admin SDK not initialized`);
            throw new Error('Firebase Admin SDK not initialized');
          }
          break;

        case 'onesignal':
          if (
            (push_config.app_id || process.env.ONESIGNAL_APP_ID) &&
            (push_config.api_key || process.env.ONESIGNAL_API_KEY)
          ) {
            console.log(`[NotificationService] Setting up OneSignal client`);
            this.onesignalAppId = push_config.app_id || process.env.ONESIGNAL_APP_ID || '';
            this.onesignalApiKey = push_config.api_key || process.env.ONESIGNAL_API_KEY || '';
          } else {
            console.error(`[NotificationService] OneSignal App ID or API key not configured`);
            throw new Error('OneSignal App ID or API key not configured');
          }
          break;

        case 'none':
          console.log(`[NotificationService] No push provider configured`);
          break;

        default:
          console.error(`[NotificationService] Unsupported push provider: ${push_provider}`);
          throw new Error(`Unsupported push provider: ${push_provider}`);
      }
    } catch (error) {
      console.error('Failed to initialize push notification client:', error);
      throw error;
    }
  }

  /**
   * Send a notification based on an event
   */
  async sendNotification(params: {
    tenantId: string;
    event: string;
    type?: 'email' | 'sms' | 'push';
    recipientEmail?: string;
    recipientPhone?: string;
    recipientUserId?: string;
    variables: Record<string, string>;
    attachments?: Array<{ filename: string; content: string; contentType: string; }>; // MODIFIED
  }): Promise<void> {
    const {
      tenantId,
      event,
      type = 'email',
      recipientEmail,
      recipientPhone,
      recipientUserId,
      variables,
      attachments, // MODIFIED
    } = params;
    console.log(
      `[NotificationService] sendNotification called for event: ${event}, type: ${type}, tenant: ${tenantId}`
    );

    try {
      const templateResult = await query(
        `
          SELECT * FROM notification_templates
          WHERE tenant_id = $1
            AND event = $2
            AND type = $3
            AND is_active = true
            AND is_default = true
          `,
        [tenantId, event, type]
      );

      if (templateResult.rows.length === 0) {
        console.warn(
          `[NotificationService] No default template found for event ${event} and type ${type}`
        );
        return;
      }

      const template = templateResult.rows[0];
      console.log(
        `[NotificationService] Found template: ${template.name}, id: ${template.id}`
      );

      const renderedSubject = template.subject
        ? await this.renderTemplate(template.subject, variables)
        : null;
      const renderedBody = await this.renderTemplate(template.body, variables);
      console.log(
        `[NotificationService] Rendered template - Subject: ${renderedSubject?.substring(
          0,
          30
        )}..., Body length: ${renderedBody.length}`
      );

      let status = 'pending';
      let errorMessage: string | null = null;

      try {
        if (type === 'email' && recipientEmail) {
          console.log(`[NotificationService] Sending email to: ${recipientEmail}`);
          await this.initializeEmailTransporter(tenantId);
          console.log(`[NotificationService] Email transporter initialized successfully`);
          await this.sendEmail(
            tenantId,
            recipientEmail,
            renderedSubject || '',
            renderedBody,
            attachments // MODIFIED
          );
          status = 'sent';
        } else if (type === 'sms' && recipientPhone) {
          console.log(`[NotificationService] Sending SMS to: ${recipientPhone}`);
          await this.initializeSmsClient(tenantId);
          await this.sendSMS(tenantId, recipientPhone, renderedBody);
          status = 'sent';
        } else if (type === 'push' && recipientUserId) {
          console.log(
            `[NotificationService] Sending push notification to user: ${recipientUserId}`
          );
          await this.initializePushClient(tenantId);
          await this.sendPushNotification(
            tenantId,
            recipientUserId,
            renderedSubject || '',
            renderedBody
          );
          status = 'sent';
        } else {
          console.error(
            `[NotificationService] Invalid notification type or missing recipient information`
          );
          throw new Error(
            `Invalid notification type or missing recipient information`
          );
        }
      } catch (error: any) {
        status = 'failed';
        errorMessage = error.message;
        console.error(
          `[NotificationService] Failed to send ${type} notification:`,
          error
        );

        // Log more detailed error information for SMTP errors
        if (error.code && error.command) {
          console.error(
            `[NotificationService] SMTP Error Details – code=${error.code}, command=${error.command}`
          );
        }
        // Log SSL/TLS library errors
        if (error.library && error.reason) {
          console.error(
            `[NotificationService] SSL Error Details – library=${error.library}, reason=${error.reason}`
          );
        }
      }

      console.log(
        `[NotificationService] Logging notification with status: ${status}`
      );
      await query(
        `
          INSERT INTO notification_logs (
            tenant_id, template_id,
            recipient_email, recipient_phone, recipient_user_id,
            subject, body, type, event, status, error_message, sent_at
          ) VALUES (
            $1, $2,
            $3, $4, $5,
            $6, $7, $8, $9, $10, $11, $12
          )
          `,
        [
          tenantId,
          template.id,
          recipientEmail || null,
          recipientPhone || null,
          recipientUserId || null,
          renderedSubject,
          renderedBody,
          type,
          event,
          status,
          errorMessage,
          status === 'sent' ? new Date() : null,
        ]
      );
    } catch (error) {
      console.error('[NotificationService] Error in sendNotification:', error);
      throw error;
    }
  }

  /**
   * Send an email notification
   */
  private async sendEmail(
    tenantId: string,
    to: string,
    subject: string,
    body: string,
    attachments?: Array<{ filename: string; content: string; contentType: string; }> // MODIFIED
  ): Promise<void> {
    console.log(
      `[NotificationService] sendEmail called for tenant ${tenantId} to ${to}`
    );
    const tenantResult = await query(
      `
        SELECT email_provider, email_config
        FROM tenants
        WHERE id = $1
        `,
      [tenantId]
    );

    if (tenantResult.rows.length === 0) {
      console.error(`[NotificationService] Tenant not found: ${tenantId}`);
      throw new Error('Tenant not found');
    }

    const { email_provider, email_config } = tenantResult.rows[0];
    const from = email_config.from || process.env.FROM_EMAIL || 'noreply@securegov-vms.com';
    console.log(
      `[NotificationService] Using email provider: ${email_provider}, from: ${from}`
    );

    switch (email_provider) {
      case 'smtp':
        if (!this.transporter) {
          console.log(`[NotificationService] Initializing SMTP transporter`);
          await this.initializeEmailTransporter(tenantId);
        }
        if (!this.transporter) {
          console.error(
            `[NotificationService] Email transporter not initialized`
          );
          throw new Error('Email transporter not initialized');
        }

        console.log(`[NotificationService] Sending email via SMTP`);
        try {
          // MODIFIED: Added attachments to mailOptions
          const mailOptions: nodemailer.SendMailOptions = { from, to, subject, text: body };
          if (attachments && attachments.length > 0) {
            mailOptions.attachments = attachments.map(att => ({
              filename: att.filename,
              content: Buffer.from(att.content, 'base64'),
              contentType: att.contentType
            }));
          }
          await (this.transporter as nodemailer.Transporter).sendMail(mailOptions);
          console.log(`[NotificationService] Email sent successfully via SMTP`);
        } catch (error: any) {
          console.error(`[NotificationService] SMTP send error:`, error);
          if (['ECONNECTION', 'ETIMEDOUT', 'ESOCKET'].includes(error.code)) {
            console.log(
              `[NotificationService] Connection error, reinitializing transporter...`
            );
            this.transporter = null;
            await this.initializeEmailTransporter(tenantId);
            if (!this.transporter) {
              throw new Error('Failed to reinitialize email transporter');
            }
            console.log(
              `[NotificationService] Retrying email send after reinitialization...`
            );
            // MODIFIED: Added attachments to retryMailOptions
            const retryMailOptions: nodemailer.SendMailOptions = { from, to, subject, text: body };
            if (attachments && attachments.length > 0) {
              retryMailOptions.attachments = attachments.map(att => ({
                filename: att.filename,
                content: Buffer.from(att.content, 'base64'),
                contentType: att.contentType
              }));
            }
            await (this.transporter as nodemailer.Transporter).sendMail(retryMailOptions);
            console.log(`[NotificationService] Retry successful`);
          } else {
            throw error;
          }
        }
        break;

      case 'sendgrid':
        if (!this.sendgridClient) {
          console.log(`[NotificationService] Initializing SendGrid client`);
          await this.initializeEmailTransporter(tenantId);
        }
        if (!this.sendgridClient) {
          console.error(`[NotificationService] SendGrid client not initialized`);
          throw new Error('SendGrid client not initialized');
        }
        console.log(`[NotificationService] Sending email via SendGrid`);
        // MODIFIED: Added attachments to sgMailOptions
        const sgMailOptions: sgMail.MailDataRequired = { from, to, subject, text: body };
        if (attachments && attachments.length > 0) {
          sgMailOptions.attachments = attachments.map(att => ({
            filename: att.filename,
            content: att.content, // SendGrid expects base64 string directly
            type: att.contentType,
            disposition: 'attachment'
          }));
        }
        await this.sendgridClient.send(sgMailOptions);
        break;

      case 'mailgun':
        if (!this.mailgunClient) {
          console.log(`[NotificationService] Initializing Mailgun client`);
          await this.initializeEmailTransporter(tenantId);
        }
        if (!this.mailgunClient) {
          console.error(`[NotificationService] Mailgun client not initialized`);
          throw new Error('Mailgun client not initialized');
        }
        console.log(`[NotificationService] Sending email via Mailgun`);
        // MODIFIED: Added attachments to mgMailOptions
        const mgMailOptions: mailgun.messages.SendData = { from, to, subject, text: body };
        if (attachments && attachments.length > 0) {
            (mgMailOptions as any).attachment = attachments.map(att => ({ // MODIFIED LINE
              data: Buffer.from(att.content, 'base64'), // Mailgun expects Buffer for 'attachment'
              filename: att.filename,
              contentType: att.contentType
            }));
        }
        await this.mailgunClient.messages().send(mgMailOptions);
        break;

      default:
        if (process.env.NODE_ENV !== 'production') {
          console.log('Email would be sent in production:');
          console.log(`From: ${from}`);
          console.log(`To: ${to}`);
          console.log(`Subject: ${subject}`);
          console.log(`Body: ${body}`);
          return;
        }
        console.error(
          `[NotificationService] Unsupported email provider: ${email_provider}`
        );
        throw new Error(`Unsupported email provider: ${email_provider}`);
    }
  }

  /**
   * Send an SMS notification
   */
  private async sendSMS(
    tenantId: string,
    to: string,
    body: string
  ): Promise<void> {
    console.log(
      `[NotificationService] sendSMS called for tenant ${tenantId} to ${to}`
    );
    const tenantResult = await query(
      `
        SELECT sms_provider, sms_config
        FROM tenants
        WHERE id = $1
        `,
      [tenantId]
    );

    if (tenantResult.rows.length === 0) {
      console.error(`[NotificationService] Tenant not found: ${tenantId}`);
      throw new Error('Tenant not found');
    }

    const { sms_provider, sms_config } = tenantResult.rows[0];
    console.log(`[NotificationService] Using SMS provider: ${sms_provider}`);

    switch (sms_provider) {
      case 'twilio':
        if (!this.twilioClient) {
          console.log(`[NotificationService] Initializing Twilio client`);
          await this.initializeSmsClient(tenantId);
        }
        if (!this.twilioClient) {
          console.error(`[NotificationService] Twilio client not initialized`);
          throw new Error('Twilio client not initialized');
        }
        console.log(
          `[NotificationService] Sending SMS via Twilio to ${to} from ${
            sms_config.from_number || process.env.TWILIO_FROM_NUMBER
          }`
        );
        await this.twilioClient.messages.create({
          body,
          from: sms_config.from_number || process.env.TWILIO_FROM_NUMBER,
          to,
        });
        break;

      case 'none':
        if (process.env.NODE_ENV !== 'production') {
          console.log('SMS would be sent in production:');
          console.log(`To: ${to}`);
          console.log(`Body: ${body}`);
          return;
        }
        console.error(`[NotificationService] No SMS provider configured`);
        throw new Error('No SMS provider configured');

      default:
        if (process.env.NODE_ENV !== 'production') {
          console.log('SMS would be sent in production:');
          console.log(`To: ${to}`);
          console.log(`Body: ${body}`);
          return;
        }
        console.error(
          `[NotificationService] Unsupported SMS provider: ${sms_provider}`
        );
        throw new Error(`Unsupported SMS provider: ${sms_provider}`);
    }
  }

  /**
   * Send a push notification
   */
  private async sendPushNotification(
    tenantId: string,
    userId: string,
    title: string,
    body: string
  ): Promise<void> {
    console.log(
      `[NotificationService] sendPushNotification called for tenant ${tenantId} to user ${userId}`
    );
    const tenantResult = await query(
      `
        SELECT push_provider, push_config
        FROM tenants
        WHERE id = $1
        `,
      [tenantId]
    );

    if (tenantResult.rows.length === 0) {
      console.error(`[NotificationService] Tenant not found: ${tenantId}`);
      throw new Error('Tenant not found');
    }

    const { push_provider, push_config } = tenantResult.rows[0];
    console.log(`[NotificationService] Using push provider: ${push_provider}`);

    const userResult = await query(
      `
        SELECT device_tokens
        FROM profiles
        WHERE id = $1
        `,
      [userId]
    );

    if (userResult.rows.length === 0) {
      console.error(`[NotificationService] User not found: ${userId}`);
      throw new Error('User not found');
    }

    const deviceTokens = userResult.rows[0].device_tokens || [];
    if (deviceTokens.length === 0) {
      console.error(
        `[NotificationService] No device tokens found for user: ${userId}`
      );
      throw new Error('No device tokens found for user');
    }

    console.log(
      `[NotificationService] Found ${deviceTokens.length} device tokens for user ${userId}`
    );

    switch (push_provider) {
      case 'fcm':
        if (!this.fcmInitialized) {
          console.log(`[NotificationService] Initializing FCM client`);
          await this.initializePushClient(tenantId);
        }
        if (!this.fcmInitialized) {
          console.error(`[NotificationService] Firebase Admin SDK not initialized`);
          throw new Error('Firebase Admin SDK not initialized');
        }
        console.log(
          `[NotificationService] Sending push notification via FCM to ${deviceTokens.length} devices`
        );
        await admin.messaging().sendMulticast({
          tokens: deviceTokens,
          notification: { title, body },
        });
        break;

      case 'onesignal':
        if (!this.onesignalAppId || !this.onesignalApiKey) {
          console.log(`[NotificationService] Initializing OneSignal client`);
          await this.initializePushClient(tenantId);
        }
        if (!this.onesignalAppId || !this.onesignalApiKey) {
          console.error(`[NotificationService] OneSignal App ID or API key not initialized`);
          throw new Error('OneSignal App ID or API key not initialized');
        }
        console.log(
          `[NotificationService] Sending push notification via OneSignal to ${deviceTokens.length} devices`
        );
        const response = await fetch('https://onesignal.com/api/v1/notifications', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${this.onesignalApiKey}`,
          },
          body: JSON.stringify({
            app_id: this.onesignalAppId,
            include_player_ids: deviceTokens,
            headings: { en: title },
            contents: { en: body },
          }),
        });
        if (!response.ok) {
          const errorData = await response.json();
          console.error(`[NotificationService] OneSignal API error:`, errorData);
          throw new Error(`OneSignal API error: ${JSON.stringify(errorData)}`);
        }
        break;

      case 'none':
        if (process.env.NODE_ENV !== 'production') {
          console.log('Push notification would be sent in production:');
          console.log(`To user: ${userId}`);
          console.log(`Title: ${title}`);
          console.log(`Body: ${body}`);
          return;
        }
        console.error(`[NotificationService] No push notification provider configured`);
        throw new Error('No push notification provider configured');

      default:
        if (process.env.NODE_ENV !== 'production') {
          console.log('Push notification would be sent in production:');
          console.log(`To user: ${userId}`);
          console.log(`Title: ${title}`);
          console.log(`Body: ${body}`);
          return;
        }
        console.error(`[NotificationService] Unsupported push provider: ${push_provider}`);
        throw new Error(`Unsupported push provider: ${push_provider}`);
    }
  }

  /**
   * Render a template with variables
   */
  private async renderTemplate(
    template: string,
    variables: Record<string, string>
  ): Promise<string> {
    let renderedTemplate = template;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      renderedTemplate = renderedTemplate.replace(regex, value);
    }
    return renderedTemplate;
  }

  /**
   * Send a notification when an invitation is approved
   */
  async sendInvitationApprovalNotifications(params: {
    tenantId: string;
    invitationId: string;
    hostName: string;
    hostEmail: string;
    visitorName?: string;
    visitorEmail?: string;
    facilityName: string;
    visitDate: string;
    visitTime?: string;
    purpose: string;
    preRegistrationLink?: string;
    qrCodeData?: string | null; // MODIFIED
    organizationName?: string;
  }): Promise<void> {
    const {
      tenantId,
      invitationId,
      hostName,
      hostEmail,
      visitorName,
      visitorEmail,
      facilityName,
      visitDate,
      visitTime,
      purpose,
      preRegistrationLink,
      qrCodeData, // MODIFIED
      organizationName = 'SecureGov VMS'
    } = params;

    try {
      // Send notification to host
      await this.sendNotification({
        tenantId,
        event: 'invitation_approved',
        type: 'email',
        recipientEmail: hostEmail,
        variables: {
          host_name: hostName,
          visitor_name: visitorName || 'Guest',
          facility_name: facilityName,
          visit_date: visitDate,
          visit_time: visitTime || 'Not specified',
          purpose,
          organization_name: organizationName
        }
      });

      // Send notification to visitor if email is available
      if (visitorEmail) {
        const variables: Record<string, string> = {
          visitor_name: visitorName || 'Guest',
          host_name: hostName,
          facility_name: facilityName,
          visit_date: visitDate,
          visit_time: visitTime || 'Not specified',
          purpose,
          organization_name: organizationName
        };

        // Add pre-registration link or QR code info
        if (preRegistrationLink) {
          variables.pre_registration_link = preRegistrationLink;
        } else if (qrCodeData) {
          variables.qr_code_instructions = 'Please use the attached QR code for quick check-in at the facility.';
        }

        // Prepare attachments if QR code data is available
        let attachments: Array<{
          filename: string;
          content: string;
          contentType: string;
        }> | undefined;

        if (qrCodeData && qrCodeData.startsWith('data:image/png;base64,')) {
          // Extract base64 content from data URL
          const base64Content = qrCodeData.split(',')[1];
          attachments = [{
            filename: 'qr-code.png',
            content: base64Content,
            contentType: 'image/png'
          }];
        }

        await this.sendNotification({
          tenantId,
          event: 'invitation_approved',
          type: 'email',
          recipientEmail: visitorEmail,
          variables,
          attachments // MODIFIED
        });
      }
    } catch (error) {
      console.error('Failed to send invitation approval notifications:', error);
      throw error;
    }
  }

  /**
   * Send a test notification
   */
  async sendTestNotification(params: {
    templateId: string;
    tenantId: string;
    recipientEmail?: string;
    recipientPhone?: string;
    recipientUserId?: string;
    variables?: Record<string, string>;
  }): Promise<{
    id: string;
    type: string;
    recipient: string;
    subject: string | null;
    body: string;
    sent_at: string;
  }> {

    console.log(`[NotificationService] sendTestNotification called with templateId: ${params.templateId}`);
    console.log(`[NotificationService] Tenant ID: ${params.tenantId}`);
    console.log(`[NotificationService] Recipient: email=${params.recipientEmail}, phone=${params.recipientPhone}, userId=${params.recipientUserId}`);
    
    const { templateId, tenantId, recipientEmail, recipientPhone, recipientUserId, variables = {} } = params;

    try {
      // Get template
      const templateResult = await query(`
        SELECT * FROM notification_templates
        WHERE id = $1 AND tenant_id = $2
      `, [templateId, tenantId]);

      if (templateResult.rows.length === 0) {
        console.error(`[NotificationService] Template not found: ${templateId}`);
        throw createError('Template not found', 404, 'TEMPLATE_NOT_FOUND');
      }

      const template = templateResult.rows[0];
      console.log(`[NotificationService] Template found: ${template.name}, type: ${template.type}, event: ${template.event}`);

      // If recipientUserId is provided, get their contact info
      let userEmail = recipientEmail;
      let userPhone = recipientPhone;

      if (recipientUserId) {
        console.log(`[NotificationService] Getting contact info for user: ${recipientUserId}`);
        const userResult = await query(`
          SELECT email, phone FROM profiles
          WHERE id = $1 AND tenant_id = $2
        `, [recipientUserId, tenantId]);

        if (userResult.rows.length === 0) {
          console.error(`[NotificationService] User not found: ${recipientUserId}`);
          throw createError('User not found', 404, 'USER_NOT_FOUND');
        }

        userEmail = userEmail || userResult.rows[0].email;
        userPhone = userPhone || userResult.rows[0].phone;
        console.log(`[NotificationService] User contact info: email=${userEmail}, phone=${userPhone}`);
      }

      // Validate that we have the right contact info for the notification type
      if (template.type === 'email' && !userEmail) {
        console.error(`[NotificationService] Email address required for email notifications`);
        throw createError('Email address required for email notifications', 400, 'EMAIL_REQUIRED');
      }

      if (template.type === 'sms' && !userPhone) {
        console.error(`[NotificationService] Phone number required for SMS notifications`);
        throw createError('Phone number required for SMS notifications', 400, 'PHONE_REQUIRED');
      }

      // Render template with variables
      const renderedSubject = template.subject 
        ? await this.renderTemplate(template.subject, variables)
        : null;
      
      const renderedBody = await this.renderTemplate(template.body, variables);
      console.log(`[NotificationService] Template rendered - Subject: ${renderedSubject?.substring(0, 30)}..., Body length: ${renderedBody.length}`);

      // Send the notification based on type
      let status = 'pending';
      let errorMessage = null;
      let recipient = '';

      try {
        if (template.type === 'email' && userEmail) {
          console.log(`[NotificationService] Sending test email to: ${userEmail}`);
          await this.initializeEmailTransporter(tenantId);
          await this.sendEmail(tenantId, userEmail, renderedSubject || '', renderedBody);
          status = 'sent';
          recipient = userEmail;
        } else if (template.type === 'sms' && userPhone) {
          console.log(`[NotificationService] Sending test SMS to: ${userPhone}`);
          await this.initializeSmsClient(tenantId);
          await this.sendSMS(tenantId, userPhone, renderedBody);
          status = 'sent';
          recipient = userPhone;
        } else if (template.type === 'push' && recipientUserId) {
          console.log(`[NotificationService] Sending test push notification to user: ${recipientUserId}`);
          await this.initializePushClient(tenantId);
          await this.sendPushNotification(tenantId, recipientUserId, renderedSubject || '', renderedBody);
          status = 'sent';
          recipient = recipientUserId;
        } else {
          console.error(`[NotificationService] Invalid notification type or missing recipient information`);
          throw new Error(`Invalid notification type or missing recipient information`);
        }
      } catch (error: any) {
        status = 'failed';
        errorMessage = error.message;
        console.error(`[NotificationService] Failed to send ${template.type} notification:`, error);
        
        // For development/testing, simulate success
        if (process.env.NODE_ENV !== 'production') {
          console.log(`[NotificationService] Simulating successful ${template.type} notification in development mode`);
          status = 'sent';
          if (template.type === 'email') recipient = userEmail || 'test@example.com';
          if (template.type === 'sms') recipient = userPhone || '+1234567890';
          if (template.type === 'push') recipient = recipientUserId || 'user-id';
        } else {
          throw error; // Re-throw in production
        }
      }

      // Log the notification
      console.log(`[NotificationService] Logging test notification with status: ${status}`);
      const logResult = await query(`
        INSERT INTO notification_logs (
          tenant_id, template_id, recipient_email, recipient_phone, recipient_user_id,
          subject, body, type, event, status, error_message, sent_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
        RETURNING id, sent_at
      `, [
        tenantId,
        templateId,
        userEmail,
        userPhone,
        recipientUserId,
        renderedSubject,
        renderedBody,
        template.type,
        template.event,
        status,
        errorMessage
      ]);

      console.log(`[NotificationService] Test notification logged with ID: ${logResult.rows[0].id}`);

      return {
        id: logResult.rows[0].id,
        type: template.type,
        recipient,
        subject: renderedSubject,
        body: renderedBody,
        sent_at: logResult.rows[0].sent_at
      };
    } catch (error: any) {
      console.error('[NotificationService] Failed to send test notification:', error);
      throw error;
    }
  }
}

export const notificationService = new NotificationService();
