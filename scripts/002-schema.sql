-- CIMT database schema. Idempotent: guarded by OBJECT_ID checks, safe to re-run.

IF OBJECT_ID('dbo.sites', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.sites (
    site_id INT IDENTITY(1,1) PRIMARY KEY,
    code NVARCHAR(64) NOT NULL UNIQUE,
    name NVARCHAR(200) NOT NULL,
    region NVARCHAR(32) NULL,
    country NVARCHAR(100) NULL,
    address NVARCHAR(500) NULL,
    city NVARCHAR(100) NULL,
    state NVARCHAR(100) NULL,
    postal NVARCHAR(30) NULL,
    is_active BIT NOT NULL DEFAULT 1,
    updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_by NVARCHAR(256) NULL
  );
END
GO

IF OBJECT_ID('dbo.cimt_roles', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.cimt_roles (
    role_id INT IDENTITY(1,1) PRIMARY KEY,
    name NVARCHAR(100) NOT NULL UNIQUE,
    sort_order INT NOT NULL DEFAULT 0
  );
END
GO

IF OBJECT_ID('dbo.contacts', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.contacts (
    contact_id INT IDENTITY(1,1) PRIMARY KEY,
    full_name NVARCHAR(200) NOT NULL,
    title NVARCHAR(200) NULL,
    desk_phone NVARCHAR(50) NULL,
    preferred_phone NVARCHAR(50) NULL,
    alternate_phone NVARCHAR(50) NULL,
    preferred_email NVARCHAR(256) NULL,
    alternate_email NVARCHAR(256) NULL,
    assistant_info NVARCHAR(500) NULL,
    language NVARCHAR(50) NULL,
    notes NVARCHAR(MAX) NULL,
    updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_by NVARCHAR(256) NULL
  );
END
GO

IF OBJECT_ID('dbo.contact_assignments', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.contact_assignments (
    assignment_id INT IDENTITY(1,1) PRIMARY KEY,
    contact_id INT NOT NULL REFERENCES dbo.contacts(contact_id) ON DELETE CASCADE,
    site_id INT NULL REFERENCES dbo.sites(site_id),
    role_id INT NOT NULL REFERENCES dbo.cimt_roles(role_id),
    tier NVARCHAR(16) NOT NULL DEFAULT 'primary' CHECK (tier IN ('primary','alternate')),
    scope NVARCHAR(16) NOT NULL DEFAULT 'site' CHECK (scope IN ('site','corporate')),
    sort_order INT NOT NULL DEFAULT 0
  );
  CREATE INDEX IX_contact_assignments_site ON dbo.contact_assignments(site_id);
  CREATE INDEX IX_contact_assignments_contact ON dbo.contact_assignments(contact_id);
END
GO

IF OBJECT_ID('dbo.external_agency_contacts', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.external_agency_contacts (
    id INT IDENTITY(1,1) PRIMARY KEY,
    site_id INT NULL REFERENCES dbo.sites(site_id),  -- NULL = national hotline / global
    agency_type NVARCHAR(16) NOT NULL
      CHECK (agency_type IN ('OSHA','SERC','LEPC','USDA','FDA','GFSI','HOTLINE','MEDIA','OTHER')),
    contact_name NVARCHAR(200) NULL,
    phone NVARCHAR(100) NULL,
    detail NVARCHAR(MAX) NULL,
    comment NVARCHAR(MAX) NULL,
    sort_order INT NOT NULL DEFAULT 0,
    updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_by NVARCHAR(256) NULL
  );
  CREATE INDEX IX_external_agency_contacts_site ON dbo.external_agency_contacts(site_id);
END
GO

IF OBJECT_ID('dbo.customers', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.customers (
    customer_id INT IDENTITY(1,1) PRIMARY KEY,
    name NVARCHAR(200) NOT NULL,
    region NVARCHAR(32) NULL,
    notes NVARCHAR(MAX) NULL,
    updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_by NVARCHAR(256) NULL
  );
END
GO

IF OBJECT_ID('dbo.customer_contacts', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.customer_contacts (
    id INT IDENTITY(1,1) PRIMARY KEY,
    customer_id INT NOT NULL REFERENCES dbo.customers(customer_id) ON DELETE CASCADE,
    side NVARCHAR(16) NOT NULL CHECK (side IN ('osi_primary','osi_alternate','customer')),
    name NVARCHAR(200) NULL,
    title NVARCHAR(200) NULL,
    work_phone NVARCHAR(50) NULL,
    cell_phone NVARCHAR(50) NULL,
    email NVARCHAR(256) NULL,
    note NVARCHAR(500) NULL,
    sort_order INT NOT NULL DEFAULT 0
  );
END
GO

IF OBJECT_ID('dbo.constituents', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.constituents (
    constituent_id INT IDENTITY(1,1) PRIMARY KEY,
    site_id INT NOT NULL REFERENCES dbo.sites(site_id),
    section NVARCHAR(100) NOT NULL,
    section_sort INT NOT NULL DEFAULT 0,
    place_name NVARCHAR(200) NOT NULL,
    address NVARCHAR(500) NULL,
    notes NVARCHAR(MAX) NULL,
    updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_by NVARCHAR(256) NULL
  );
  CREATE INDEX IX_constituents_site ON dbo.constituents(site_id);
END
GO

IF OBJECT_ID('dbo.constituent_contacts', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.constituent_contacts (
    id INT IDENTITY(1,1) PRIMARY KEY,
    constituent_id INT NOT NULL REFERENCES dbo.constituents(constituent_id) ON DELETE CASCADE,
    name NVARCHAR(200) NULL,
    title NVARCHAR(200) NULL,
    phone NVARCHAR(50) NULL,
    cell NVARCHAR(50) NULL,
    email NVARCHAR(256) NULL,
    sort_order INT NOT NULL DEFAULT 0
  );
END
GO

IF OBJECT_ID('dbo.war_rooms', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.war_rooms (
    war_room_id INT IDENTITY(1,1) PRIMARY KEY,
    site_id INT NOT NULL UNIQUE REFERENCES dbo.sites(site_id),
    war_room_location NVARCHAR(300) NULL,
    war_room_phone NVARCHAR(50) NULL,
    direct_line NVARCHAR(50) NULL,
    direct_fax NVARCHAR(50) NULL,
    conference_phone NVARCHAR(50) NULL,
    conference_access_code NVARCHAR(50) NULL,
    revised_at DATE NULL,
    updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_by NVARCHAR(256) NULL
  );
END
GO

IF OBJECT_ID('dbo.content_pages', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.content_pages (
    page_id INT IDENTITY(1,1) PRIMARY KEY,
    slug NVARCHAR(100) NOT NULL UNIQUE,
    kind NVARCHAR(16) NOT NULL DEFAULT 'guide' CHECK (kind IN ('guide','checklist','static')),
    book NVARCHAR(32) NULL,
    locale NVARCHAR(8) NOT NULL DEFAULT 'en',
    title NVARCHAR(200) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_by NVARCHAR(256) NULL
  );
END
GO

IF OBJECT_ID('dbo.content_sections', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.content_sections (
    section_id INT IDENTITY(1,1) PRIMARY KEY,
    page_id INT NOT NULL REFERENCES dbo.content_pages(page_id) ON DELETE CASCADE,
    heading NVARCHAR(300) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0
  );
  CREATE INDEX IX_content_sections_page ON dbo.content_sections(page_id);
END
GO

IF OBJECT_ID('dbo.content_blocks', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.content_blocks (
    block_id INT IDENTITY(1,1) PRIMARY KEY,
    section_id INT NOT NULL REFERENCES dbo.content_sections(section_id) ON DELETE CASCADE,
    kind NVARCHAR(16) NOT NULL DEFAULT 'markdown' CHECK (kind IN ('markdown','checklist_item')),
    body NVARCHAR(MAX) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0
  );
  CREATE INDEX IX_content_blocks_section ON dbo.content_blocks(section_id);
END
GO

IF OBJECT_ID('dbo.resources', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.resources (
    resource_id INT IDENTITY(1,1) PRIMARY KEY,
    title NVARCHAR(200) NOT NULL,
    category NVARCHAR(100) NULL,
    file_name NVARCHAR(300) NULL,
    url NVARCHAR(500) NULL,
    sort_order INT NOT NULL DEFAULT 0,
    updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_by NVARCHAR(256) NULL
  );
END
GO

IF OBJECT_ID('dbo.users', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.users (
    user_id INT IDENTITY(1,1) PRIMARY KEY,
    email NVARCHAR(256) NOT NULL UNIQUE,
    display_name NVARCHAR(200) NOT NULL,
    password_hash NVARCHAR(300) NULL,  -- scrypt; NULL once the account is SSO-only
    entra_oid NVARCHAR(64) NULL,       -- filled on first Entra ID login
    is_admin BIT NOT NULL DEFAULT 0,
    is_active BIT NOT NULL DEFAULT 1,
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    last_login_at DATETIME2 NULL,
    updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_by NVARCHAR(256) NULL
  );
  CREATE UNIQUE INDEX UX_users_entra_oid ON dbo.users(entra_oid) WHERE entra_oid IS NOT NULL;
END
GO

IF OBJECT_ID('dbo.sessions', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.sessions (
    session_id INT IDENTITY(1,1) PRIMARY KEY,
    token_hash BINARY(32) NOT NULL UNIQUE,  -- SHA-256; the raw token only lives in the cookie
    user_id INT NOT NULL REFERENCES dbo.users(user_id) ON DELETE CASCADE,
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    expires_at DATETIME2 NOT NULL,
    revoked_at DATETIME2 NULL,
    ip NVARCHAR(45) NULL,
    user_agent NVARCHAR(300) NULL
  );
  CREATE INDEX IX_sessions_user ON dbo.sessions(user_id);
END
GO

-- Incident workspaces. One row per formal incident; "workspace" is only the UI label
-- (dbo.war_rooms above is the physical-rooms directory — legacy table name — a different thing).
IF OBJECT_ID('dbo.incidents', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.incidents (
    incident_id INT IDENTITY(1,1) PRIMARY KEY,
    title NVARCHAR(200) NOT NULL,
    incident_type NVARCHAR(32) NOT NULL
      CHECK (incident_type IN ('food_safety','workplace','environmental','security','cyber','product_recall','other')),
    site_id INT NULL REFERENCES dbo.sites(site_id),
    severity NVARCHAR(16) NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
    status NVARCHAR(16) NOT NULL DEFAULT 'active' CHECK (status IN ('active','closed','archived')),
    summary NVARCHAR(MAX) NULL,
    data_key VARBINARY(256) NOT NULL,  -- per-incident AES-256 key, wrapped by the master key
    key_version INT NOT NULL DEFAULT 1,
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    created_by INT NOT NULL REFERENCES dbo.users(user_id),
    closed_at DATETIME2 NULL,
    closed_by INT NULL REFERENCES dbo.users(user_id),
    updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_by NVARCHAR(256) NULL
  );
END
GO

IF OBJECT_ID('dbo.incident_members', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.incident_members (
    member_id INT IDENTITY(1,1) PRIMARY KEY,
    incident_id INT NOT NULL REFERENCES dbo.incidents(incident_id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES dbo.users(user_id),
    role NVARCHAR(16) NOT NULL DEFAULT 'member' CHECK (role IN ('commander','member','observer')),
    added_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    added_by INT NULL REFERENCES dbo.users(user_id),
    CONSTRAINT UQ_incident_members UNIQUE (incident_id, user_id)
  );
  CREATE INDEX IX_incident_members_user ON dbo.incident_members(user_id);
END
GO

-- Workspace chat. Immutable by design (no edited_at/deleted_at — legal record).
-- Message bodies are encrypted at rest with the incident's data key (AES-256-GCM).
-- kind: 'chat' = conversation; 'event'/'decision' = formal coordinator entries
-- (feed the timeline); 'system' = server-generated ("X was added").
IF OBJECT_ID('dbo.incident_messages', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.incident_messages (
    message_id BIGINT IDENTITY(1,1) PRIMARY KEY,
    incident_id INT NOT NULL REFERENCES dbo.incidents(incident_id),
    user_id INT NOT NULL REFERENCES dbo.users(user_id),
    kind NVARCHAR(16) NOT NULL DEFAULT 'chat' CHECK (kind IN ('chat','event','decision','system')),
    ciphertext VARBINARY(MAX) NOT NULL,
    iv BINARY(12) NOT NULL,
    auth_tag BINARY(16) NOT NULL,
    key_version INT NOT NULL DEFAULT 1,
    created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME()
  );
  CREATE INDEX IX_incident_messages ON dbo.incident_messages(incident_id, message_id);
END
GO

-- Workspace folder tree. parent_folder_id is a self-reference (no cascade —
-- SQL Server doesn't allow it); folders with content are never deleted.
IF OBJECT_ID('dbo.incident_folders', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.incident_folders (
    folder_id INT IDENTITY(1,1) PRIMARY KEY,
    incident_id INT NOT NULL REFERENCES dbo.incidents(incident_id),
    parent_folder_id INT NULL REFERENCES dbo.incident_folders(folder_id),
    name NVARCHAR(255) NOT NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    created_by INT NOT NULL REFERENCES dbo.users(user_id)
  );
  CREATE INDEX IX_incident_folders ON dbo.incident_folders(incident_id, parent_folder_id);
END
GO

-- Workspace documents. The blob lives on disk (CIMT_FILES_DIR), encrypted with
-- the incident's data key; this row is the metadata + chain-of-custody hash.
-- Soft delete only: the blob and the row are never physically removed.
IF OBJECT_ID('dbo.incident_files', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.incident_files (
    file_id INT IDENTITY(1,1) PRIMARY KEY,
    incident_id INT NOT NULL REFERENCES dbo.incidents(incident_id),
    folder_id INT NULL REFERENCES dbo.incident_folders(folder_id),
    original_name NVARCHAR(255) NOT NULL,
    content_type NVARCHAR(127) NULL,
    size_bytes BIGINT NOT NULL,
    storage_name NVARCHAR(64) NOT NULL UNIQUE,  -- server-generated uuid.bin; original name never touches disk
    iv BINARY(12) NOT NULL,
    auth_tag BINARY(16) NOT NULL,
    key_version INT NOT NULL DEFAULT 1,
    sha256 BINARY(32) NOT NULL,                 -- hash of the plaintext (integrity / chain of custody)
    uploaded_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    uploaded_by INT NOT NULL REFERENCES dbo.users(user_id),
    deleted_at DATETIME2 NULL,
    deleted_by INT NULL REFERENCES dbo.users(user_id)
  );
  CREATE INDEX IX_incident_files ON dbo.incident_files(incident_id, folder_id);
END
GO

-- Immutable per-incident audit trail, populated from day one (append-only;
-- the UPDATE/DELETE-blocking trigger lands with the audit phase).
IF OBJECT_ID('dbo.incident_audit', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.incident_audit (
    audit_id BIGINT IDENTITY(1,1) PRIMARY KEY,
    incident_id INT NOT NULL REFERENCES dbo.incidents(incident_id),
    user_id INT NULL REFERENCES dbo.users(user_id),
    action NVARCHAR(40) NOT NULL,
    detail NVARCHAR(MAX) NULL,  -- JSON payload: ids, names, old/new values
    created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME()
  );
  CREATE INDEX IX_incident_audit ON dbo.incident_audit(incident_id, audit_id);
END
GO

-- Enforce append-only at the database level: not even direct SQL can rewrite
-- the audit trail or the chat record (the app never issues UPDATE/DELETE here).
IF OBJECT_ID('dbo.TR_incident_audit_immutable', 'TR') IS NULL
  EXEC('CREATE TRIGGER dbo.TR_incident_audit_immutable ON dbo.incident_audit
        INSTEAD OF UPDATE, DELETE AS
        BEGIN
          RAISERROR(''incident_audit is append-only (legal record)'', 16, 1);
          ROLLBACK TRANSACTION;
        END');
GO

IF OBJECT_ID('dbo.TR_incident_messages_immutable', 'TR') IS NULL
  EXEC('CREATE TRIGGER dbo.TR_incident_messages_immutable ON dbo.incident_messages
        INSTEAD OF UPDATE, DELETE AS
        BEGIN
          RAISERROR(''incident_messages is append-only (legal record)'', 16, 1);
          ROLLBACK TRANSACTION;
        END');
GO

-- Seed the 9 CIMT functions (idempotent)
MERGE dbo.cimt_roles AS t
USING (VALUES
  ('Site Coordinator', 1),
  ('Ops/Manufacturing', 2),
  ('EHS / Risk Management', 3),
  ('FSQA', 4),
  ('HR', 5),
  ('Finance', 6),
  ('IT', 7),
  ('Spokesperson', 8),
  ('Customer Relations', 9)
) AS s(name, sort_order)
ON t.name = s.name
WHEN NOT MATCHED THEN INSERT (name, sort_order) VALUES (s.name, s.sort_order);
GO
