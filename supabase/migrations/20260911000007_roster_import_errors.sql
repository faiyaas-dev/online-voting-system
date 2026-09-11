-- roster_import_errors: row-level CSV validation failures
create table roster_import_errors (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid references institutions(id) not null,
  row_number int not null,
  raw_row jsonb not null,
  error_reason text not null,
  imported_at timestamptz default now()
);

-- RLS: same access pattern as roster (institution_admin of own institution only)
alter table roster_import_errors enable row level security;

create policy roster_import_errors_admin_access on roster_import_errors
  for all using (
    institution_id = my_institution_id()
    and my_role() in ('institution_admin')
  );

-- Performance index for admin queries
create index idx_roster_import_errors_institution_imported
  on roster_import_errors(institution_id, imported_at desc);
