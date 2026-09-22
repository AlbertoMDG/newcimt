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
