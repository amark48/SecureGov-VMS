CREATE TYPE IF NOT EXISTS user_role AS ENUM (
  'admin',
  'security',
  'reception',
  'host',
  'approver',
  'super_admin'
);

CREATE TYPE IF NOT EXISTS user_security_clearance AS ENUM (
  'unclassified',
  'confidential',
  'secret',
  'top_secret'
);
