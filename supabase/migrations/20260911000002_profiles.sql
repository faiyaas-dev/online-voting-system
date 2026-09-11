-- profiles: 1:1 with auth.users, adds role + tenant + department
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  institution_id uuid references institutions(id), -- null for platform_admin
  role text not null check (role in ('platform_admin','institution_admin','department_admin','voter')),
  department text,
  year int,
  full_name text,
  roll_no text,
  created_at timestamptz default now()
);

-- helper: current user's institution_id
create or replace function my_institution_id() returns uuid as $$
  select institution_id from profiles where id = auth.uid();
$$ language sql security definer stable;

create or replace function my_role() returns text as $$
  select role from profiles where id = auth.uid();
$$ language sql security definer stable;

-- Platform admin sees all institutions; everyone else sees only their own
create policy institutions_select on institutions
  for select using (
    my_role() = 'platform_admin'
    or id = my_institution_id()
  );

alter table profiles enable row level security;

-- profiles: read own or same-institution profiles
create policy profiles_select on profiles
  for select using (
    id = auth.uid() or institution_id = my_institution_id()
  );

-- profiles: update own info without escalating role or tenant
create policy profiles_update_own on profiles
  for update using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (select role from profiles where id = auth.uid())
    and institution_id = (select institution_id from profiles where id = auth.uid())
  );
