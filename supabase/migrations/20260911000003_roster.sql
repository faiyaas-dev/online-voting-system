-- roster: admin-uploaded eligibility source of truth
create table roster (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid references institutions(id) not null,
  roll_no text not null,
  email text not null,
  department text not null,
  year int not null,
  full_name text,
  imported_at timestamptz default now(),
  unique(institution_id, email)
);

alter table roster enable row level security;

-- roster: only institution_admin of that institution can read/write
create policy roster_admin_access on roster
  for all using (
    institution_id = my_institution_id()
    and my_role() in ('institution_admin')
  );

-- claim_voter_profile: securely matches roster on first login, avoids
-- exposing the roster table directly to the client
create or replace function claim_voter_profile(p_institution_id uuid)
returns profiles as $$
declare
  r roster%rowtype;
  p profiles%rowtype;
begin
  select * into r from roster
  where institution_id = p_institution_id and lower(email) = lower(auth.jwt()->>'email');
  if not found then
    raise exception 'Email not found in institution roster';
  end if;

  insert into profiles (id, institution_id, role, department, year, roll_no, full_name)
  values (auth.uid(), p_institution_id, 'voter', r.department, r.year, r.roll_no, r.full_name)
  on conflict (id) do update set
    institution_id = excluded.institution_id,
    department = excluded.department,
    year = excluded.year,
    roll_no = excluded.roll_no,
    full_name = excluded.full_name
  returning * into p;

  return p;
end;
$$ language plpgsql security definer;
