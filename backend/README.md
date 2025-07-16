# SecureGov VMS Backend API

Enterprise-grade visitor management system backend built with Node.js, Express, and PostgreSQL.

## Features

- **Authentication & Authorization**: JWT-based auth with role-based access control
- **Azure AD Integration**: Support for Azure AD SSO with automatic user provisioning
- **AWS Federation**: Federated access to AWS resources using Azure AD tokens
- **Visitor Management**: Complete visitor registration, check-in/out workflows
- **Security Features**: Watchlist screening, security alerts, audit logging
- **Compliance**: FICAM, FIPS 140, HIPAA, FERPA compliance features
- **Emergency Management**: Emergency contacts, evacuation lists, lockdown procedures
- **Audit Trail**: Comprehensive logging of all system activities

## Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Setup Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

3. **Setup Database**
   - Create PostgreSQL database named `securegov_vms`
   - Run the migration script from the main project's `supabase/migrations/` folder

4. **Start Development Server**
   ```bash
   npm run dev
   ```

The API will be available at `http://localhost:3001`

## Azure AD Configuration

To enable Azure AD authentication, configure the following environment variables:

```bash
AZURE_AD_TENANT_ID=your_azure_ad_tenant_id
AZURE_AD_CLIENT_ID=your_azure_ad_client_id
AZURE_AD_JWKS_URI=https://login.microsoftonline.com/{tenant_id}/discovery/v2.0/keys
AZURE_AD_ISSUER=https://login.microsoftonline.com/{tenant_id}/v2.0
AZURE_AD_AUDIENCE=your_azure_ad_client_id
```

### Azure AD Role Mapping

The system maps Azure AD roles to internal application roles:

- `VMS.SuperAdmin` → `super_admin`
- `VMS.Admin` → `admin`
- `VMS.Security` → `security`
- `VMS.Reception` → `reception`
- `VMS.Host` → `host`
- `VMS.Approver` → `approver`

## AWS Federation Configuration

To enable AWS IAM federation with Azure AD tokens:

```bash
AWS_REGION=us-east-1
AWS_FEDERATED_ROLE_ARN_PREFIX=arn:aws:iam::123456789012:role/
AWS_FEDERATION_ENABLED=true
```

### AWS Role Mapping

Azure AD roles are mapped to AWS IAM roles:

- `VMS.SuperAdmin` → `VMS-SuperAdmin-Role`
- `VMS.Admin` → `VMS-Admin-Role`
- `VMS.Security` → `VMS-Security-Role`
- `VMS.Reception` → `VMS-Reception-Role`
- `VMS.Host` → `VMS-Host-Role`
- `VMS.Approver` → `VMS-Approver-Role`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/azure-ad/login` - Azure AD SSO login
- `POST /api/auth/aws/credentials` - Get AWS credentials (Azure AD users)
- `POST /api/auth/aws/assume-role` - Assume specific AWS role
- `GET /api/auth/profile` - Get current user profile
- `PUT /api/auth/profile` - Update user profile
- `PUT /api/auth/change-password` - Change password
- `POST /api/auth/logout` - Logout

### Visitors
- `GET /api/visitors` - List visitors with pagination/search
- `POST /api/visitors` - Create new visitor
- `GET /api/visitors/:id` - Get visitor details
- `PUT /api/visitors/:id` - Update visitor
- `DELETE /api/visitors/:id` - Deactivate visitor
- `GET /api/visitors/search/quick` - Quick search visitors
- `GET /api/visitors/stats/overview` - Visitor statistics

### Visits
- `GET /api/visits` - List visits with filtering
- `POST /api/visits` - Create new visit
- `GET /api/visits/today` - Today's visits
- `GET /api/visits/:id` - Get visit details
- `PUT /api/visits/:id` - Update visit
- `POST /api/visits/:id/check-in` - Check in visitor
- `POST /api/visits/:id/check-out` - Check out visitor
- `GET /api/visits/stats/overview` - Visit statistics

### Facilities
- `GET /api/facilities` - List facilities
- `POST /api/facilities` - Create facility (admin only)
- `GET /api/facilities/:id` - Get facility details
- `PUT /api/facilities/:id` - Update facility (admin only)
- `GET /api/facilities/:id/hosts` - Get facility hosts
- `GET /api/facilities/:id/stats` - Facility statistics

### Security
- `GET /api/security/watchlist` - List watchlist entries
- `POST /api/security/watchlist` - Add watchlist entry
- `PUT /api/security/watchlist/:id` - Update watchlist entry
- `POST /api/security/screen` - Screen visitor against watchlist
- `GET /api/security/alerts` - List security alerts
- `POST /api/security/alerts` - Create security alert
- `PUT /api/security/alerts/:id/resolve` - Resolve security alert
- `GET /api/security/stats` - Security statistics

### Audit
- `GET /api/audit/logs` - List audit logs with filtering
- `GET /api/audit/logs/:id` - Get audit log details
- `GET /api/audit/stats` - Audit statistics
- `GET /api/audit/export` - Export audit logs (CSV/JSON)
- `POST /api/audit/compliance-report` - Generate compliance report

### Emergency
- `GET /api/emergency/contacts` - List emergency contacts
- `POST /api/emergency/contacts` - Create emergency contact
- `PUT /api/emergency/contacts/:id` - Update emergency contact
- `DELETE /api/emergency/contacts/:id` - Delete emergency contact
- `GET /api/emergency/evacuation-list` - Get current visitors for evacuation
- `POST /api/emergency/lockdown` - Initiate emergency lockdown
- `GET /api/emergency/procedures` - Get emergency procedures
- `POST /api/emergency/test-notification` - Test emergency notifications

## Security Features

- **Rate Limiting**: Prevents abuse with configurable limits
- **Helmet**: Security headers for protection against common attacks
- **CORS**: Configurable cross-origin resource sharing
- **Input Validation**: Comprehensive validation using express-validator
- **SQL Injection Protection**: Parameterized queries
- **Authentication**: JWT tokens with configurable expiration
- **Azure AD SSO**: Enterprise single sign-on with automatic user provisioning
- **AWS Federation**: Secure access to AWS resources using federated identities
- **Authorization**: Role-based access control (admin, security, reception, host)
- **Audit Logging**: All actions logged with compliance flags

## Database Schema

The backend uses the PostgreSQL schema defined in the main project's migration file. Key tables include:

- `profiles` - User accounts and profiles
- `visitors` - Visitor information
- `visits` - Visit records with check-in/out
- `facilities` - Physical locations
- `hosts` - Host user associations
- `watchlist` - Security watchlist entries
- `audit_logs` - Comprehensive audit trail
- `emergency_contacts` - Emergency contact information
- `badges` - Digital badge records

### Azure AD Integration

The `profiles` table includes additional fields for Azure AD integration:

- `auth_provider` - Authentication method ('local' or 'azure_ad')
- `azure_ad_object_id` - Azure AD Object ID for SSO users
- `azure_ad_roles` - Azure AD roles/groups assigned to the user

## Environment Variables

See `.env.example` for all available configuration options.

### Required for Azure AD
- `AZURE_AD_TENANT_ID` - Your Azure AD tenant ID
- `AZURE_AD_CLIENT_ID` - Azure AD application client ID
- `AZURE_AD_JWKS_URI` - JWKS endpoint for token validation
- `AZURE_AD_ISSUER` - Token issuer URL
- `AZURE_AD_AUDIENCE` - Expected audience for tokens

### Required for AWS Federation
- `AWS_REGION` - AWS region for STS operations
- `AWS_FEDERATED_ROLE_ARN_PREFIX` - Prefix for federated role ARNs
- `AWS_FEDERATION_ENABLED` - Enable/disable AWS federation

## Development

```bash
# Install dependencies
npm install

# Start development server with auto-reload
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Production Deployment

1. Set `NODE_ENV=production`
2. Configure production database credentials
3. Set strong JWT secrets
4. Configure Azure AD application registration
5. Set up AWS IAM roles and trust relationships
4. Configure CORS for your frontend domain
5. Set up SSL/TLS termination
6. Configure logging and monitoring
7. Set up database backups
8. Configure rate limiting for production load

### Azure AD Production Setup

1. Register your application in Azure AD
2. Configure redirect URIs and API permissions
3. Set up application roles for VMS access
4. Configure Conditional Access policies
5. Set up proper JWKS endpoint access

### AWS Federation Production Setup

1. Create IAM roles for each VMS role level
2. Configure trust relationships with Azure AD
3. Set up proper IAM policies for least privilege
4. Configure STS assume role permissions
5. Set up CloudTrail for AWS access auditing

## Compliance

The system includes features for:

- **FICAM**: Federal Identity, Credential, and Access Management
- **FIPS 140**: Federal Information Processing Standards
- **HIPAA**: Health Insurance Portability and Accountability Act
- **FERPA**: Family Educational Rights and Privacy Act
- **Zero Trust**: Continuous verification with Azure AD Conditional Access
- **Cloud Security**: Federated AWS access with least privilege

All compliance-related activities are automatically flagged in audit logs.