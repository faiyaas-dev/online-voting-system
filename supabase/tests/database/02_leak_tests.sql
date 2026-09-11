begin;
select plan(4);

-- Seed data for testing two institutions
insert into auth.users (id, email) values 
  ('00000000-0000-0000-0000-000000000010', 'voterA@test.com'),
  ('00000000-0000-0000-0000-000000000020', 'voterB@test.com');

insert into institutions (id, name, slug) values 
  ('11111111-1111-1111-1111-111111111111', 'Inst A', 'inst-a'),
  ('22222222-2222-2222-2222-222222222222', 'Inst B', 'inst-b');

insert into profiles (id, institution_id, role, department, year) values
  ('00000000-0000-0000-0000-000000000010', '11111111-1111-1111-1111-111111111111', 'voter', 'CS', 3),
  ('00000000-0000-0000-0000-000000000020', '22222222-2222-2222-2222-222222222222', 'voter', 'CS', 3);

insert into roster (institution_id, roll_no, email, department, year) values
  ('11111111-1111-1111-1111-111111111111', 'A1', 'voterA@test.com', 'CS', 3),
  ('22222222-2222-2222-2222-222222222222', 'B1', 'voterB@test.com', 'CS', 3);

insert into elections (id, institution_id, title, status, opens_at, closes_at) values
  ('33333333-3333-3333-3333-333333333331', '11111111-1111-1111-1111-111111111111', 'Election A', 'closed', now(), now() + interval '1 day'),
  ('33333333-3333-3333-3333-333333333332', '22222222-2222-2222-2222-222222222222', 'Election B', 'closed', now(), now() + interval '1 day');

insert into candidates (id, election_id, user_id, status) values
  ('44444444-4444-4444-4444-444444444441', '33333333-3333-3333-3333-333333333331', '00000000-0000-0000-0000-000000000010', 'approved'),
  ('44444444-4444-4444-4444-444444444442', '33333333-3333-3333-3333-333333333332', '00000000-0000-0000-0000-000000000020', 'approved');

-- Impersonate voter from Institution A
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000000010"}', true);

-- Test 1: Cannot read Institution B's roster
select is_empty(
  $$ select * from roster where institution_id = '22222222-2222-2222-2222-222222222222' $$,
  'Cross-tenant leak test: user A cannot read Institution B roster'
);

-- Test 2: Cannot read Institution B's elections
select is_empty(
  $$ select * from elections where institution_id = '22222222-2222-2222-2222-222222222222' $$,
  'Cross-tenant leak test: user A cannot read Institution B elections'
);

-- Test 3: Cannot read Institution B's candidates
select is_empty(
  $$ select * from candidates where election_id = '33333333-3333-3333-3333-333333333332' $$,
  'Cross-tenant leak test: user A cannot read Institution B candidates'
);

-- Test 4: Cannot call get_election_results for Institution B's election
select throws_ok(
  $$ select * from get_election_results('33333333-3333-3333-3333-333333333332') $$,
  'P0001',
  'Results locked until election is closed',
  'Cross-tenant leak test: user A cannot get results for Institution B election even if closed'
);

select * from finish();
rollback;
