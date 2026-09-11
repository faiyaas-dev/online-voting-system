-- candidates: self-nominated, admin-approved
create table candidates (
  id uuid primary key default gen_random_uuid(),
  election_id uuid references elections(id) not null,
  user_id uuid references profiles(id) not null,
  manifesto text,
  photo_path text, -- Supabase Storage path, Could-tier
  status text not null default 'pending'
    check (status in ('pending','approved','rejected')),
  approved_by uuid references profiles(id),
  created_at timestamptz default now(),
  unique(election_id, user_id)
);

alter table candidates enable row level security;

-- candidates: view approved candidates (or own nomination, or all for admin)
create policy candidates_select on candidates
  for select using (
    exists (
      select 1 from elections e
      where e.id = election_id
        and e.institution_id = my_institution_id()
    )
    and (
      status = 'approved'
      or user_id = auth.uid()
      or my_role() in ('institution_admin', 'department_admin')
    )
  );

-- candidates: self-nomination during nomination_open if eligible
create policy candidates_nominate on candidates
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from elections e
      where e.id = election_id
        and e.institution_id = my_institution_id()
        and e.status = 'nomination_open'
        and (e.scope_department is null or e.scope_department = (select department from profiles where id = auth.uid()))
        and (e.scope_year is null or e.scope_year = (select year from profiles where id = auth.uid()))
    )
  );

-- candidates: admin approval / rejection
create policy candidates_admin_update on candidates
  for update using (
    my_role() in ('institution_admin', 'department_admin')
    and exists (
      select 1 from elections e
      where e.id = election_id
        and e.institution_id = my_institution_id()
    )
  );
