-- elections: scope_department / scope_year null = institution-wide
create table elections (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid references institutions(id) not null,
  title text not null,
  scope_department text,       -- null = all departments
  scope_year int,               -- null = all years
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  status text not null default 'draft'
    check (status in ('draft','nomination_open','voting_open','closed')),
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

alter table elections enable row level security;

-- elections: voters see matching dept/year in their institution; admins see all in institution
create policy elections_select on elections
  for select using (
    institution_id = my_institution_id()
    and (
      my_role() in ('institution_admin', 'platform_admin')
      or (
        (scope_department is null or scope_department = (select department from profiles where id = auth.uid()))
        and (scope_year is null or scope_year = (select year from profiles where id = auth.uid()))
      )
    )
  );

create policy elections_admin_insert on elections
  for insert with check (
    institution_id = my_institution_id()
    and (
      my_role() = 'institution_admin'
      or (my_role() = 'department_admin' and scope_department = (select department from profiles where id = auth.uid()))
    )
  );

create policy elections_admin_update on elections
  for update using (
    institution_id = my_institution_id()
    and (
      my_role() = 'institution_admin'
      or (my_role() = 'department_admin' and scope_department = (select department from profiles where id = auth.uid()))
    )
  );
