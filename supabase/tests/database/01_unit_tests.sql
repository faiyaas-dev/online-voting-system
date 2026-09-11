begin;
select plan(5); -- number of tests

-- Seed data for testing
insert into auth.users (id, email) values 
  ('00000000-0000-0000-0000-000000000001', 'voter@test.com'),
  ('00000000-0000-0000-0000-000000000002', 'candidate@test.com');

insert into institutions (id, name, slug) values 
  ('11111111-1111-1111-1111-111111111111', 'Test Inst', 'test-inst');

insert into profiles (id, institution_id, role, department, year) values
  ('00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'voter', 'CS', 3),
  ('00000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'voter', 'CS', 3);

insert into elections (id, institution_id, title, status, opens_at, closes_at) values
  ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Test Election', 'voting_open', now(), now() + interval '1 day');

insert into candidates (id, election_id, user_id, status) values
  ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000002', 'approved');

-- Impersonate voter 1
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000000001"}', true);

-- Test 1: Successful vote insert
select lives_ok(
  $$ insert into votes (voter_id, election_id, candidate_id) values ('00000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333') $$,
  'Can cast a vote in an open election'
);

-- Test 2: Double vote rejected by UNIQUE constraint
select throws_ok(
  $$ insert into votes (voter_id, election_id, candidate_id) values ('00000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333') $$,
  '23505',
  null,
  'Double vote is rejected by UNIQUE constraint'
);

-- Reset auth to service role to change election status
select set_config('request.jwt.claims', '{"sub": ""}', true);
update elections set status = 'closed' where id = '22222222-2222-2222-2222-222222222222';

-- Impersonate voter 2 (who hasn't voted yet)
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000000002"}', true);

-- Test 3: Vote insert rejected when election is closed (RLS check violation)
select throws_ok(
  $$ insert into votes (voter_id, election_id, candidate_id) values ('00000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333') $$,
  '42501',
  'new row violates row-level security policy for table "votes"',
  'Vote insert is rejected when election is not voting_open'
);

-- Test 4: Tally matches hand-computed expected count
select results_eq(
  $$ select vote_count from get_election_results('22222222-2222-2222-2222-222222222222') $$,
  ARRAY[1::bigint],
  'get_election_results returns correct tally'
);

-- Test 5: Only approved candidates are shown in get_election_results
select results_eq(
  $$ select candidate_id from get_election_results('22222222-2222-2222-2222-222222222222') $$,
  ARRAY['33333333-3333-3333-3333-333333333333'::uuid],
  'get_election_results returns correct candidate ID'
);

select * from finish();
rollback;
