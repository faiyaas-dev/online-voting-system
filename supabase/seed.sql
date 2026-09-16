-- Supabase seed.sql
-- Create some consistent UUIDs for our test users
DO $$
DECLARE
  admin_a_id uuid := 'a0000000-0000-0000-0000-000000000001';
  admin_b_id uuid := 'b0000000-0000-0000-0000-000000000001';
  dept_admin_id uuid := 'c0000000-0000-0000-0000-000000000001';
  voter1_id uuid := 'd0000000-0000-0000-0000-000000000001';
  voter2_id uuid := 'd0000000-0000-0000-0000-000000000002';
  voter3_id uuid := 'd0000000-0000-0000-0000-000000000003';
  inst_a_id uuid := '11111111-1111-1111-1111-111111111111';
  inst_b_id uuid := '22222222-2222-2222-2222-222222222222';
  elec_nom_id uuid := 'e1111111-1111-1111-1111-111111111111';
  elec_vote_id uuid := 'e2222222-2222-2222-2222-222222222222';
BEGIN
  -- Institutions
  INSERT INTO institutions (id, name, slug) VALUES 
    (inst_a_id, 'Institution A', 'inst-a'),
    (inst_b_id, 'Institution B', 'inst-b')
  ON CONFLICT DO NOTHING;

  -- Insert Auth Users
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
  )
  VALUES
    ('00000000-0000-0000-0000-000000000000', admin_a_id, 'authenticated', 'authenticated', 'adminA@test.com', crypt('password123', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', admin_b_id, 'authenticated', 'authenticated', 'adminB@test.com', crypt('password123', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', dept_admin_id, 'authenticated', 'authenticated', 'deptadmin@test.com', crypt('password123', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', voter1_id, 'authenticated', 'authenticated', 'voterA@test.com', crypt('password123', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', voter2_id, 'authenticated', 'authenticated', 'voterB@test.com', crypt('password123', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', voter3_id, 'authenticated', 'authenticated', 'voterC@test.com', crypt('password123', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '')
  ON CONFLICT (id) DO NOTHING;

  -- Insert Roster
  INSERT INTO roster (institution_id, roll_no, email, department, year, full_name) VALUES
    (inst_a_id, 'V001', 'voterA@test.com', 'CS', 2024, 'Voter A'),
    (inst_a_id, 'V002', 'voterB@test.com', 'CS', 2024, 'Voter B'),
    (inst_a_id, 'V003', 'voterC@test.com', 'Math', 2024, 'Voter C')
  ON CONFLICT (institution_id, email) DO NOTHING;

  -- Insert Profiles
  INSERT INTO profiles (id, institution_id, role, department, year, full_name, roll_no) VALUES
    (admin_a_id, inst_a_id, 'institution_admin', NULL, NULL, 'Admin A', NULL),
    (admin_b_id, inst_b_id, 'institution_admin', NULL, NULL, 'Admin B', NULL),
    (dept_admin_id, inst_a_id, 'department_admin', 'CS', NULL, 'Dept Admin', NULL),
    (voter1_id, inst_a_id, 'voter', 'CS', 2024, 'Voter A', 'V001'),
    (voter2_id, inst_a_id, 'voter', 'CS', 2024, 'Voter B', 'V002'),
    (voter3_id, inst_a_id, 'voter', 'Math', 2024, 'Voter C', 'V003')
  ON CONFLICT (id) DO NOTHING;

  -- Insert Elections
  INSERT INTO elections (id, institution_id, title, scope_department, scope_year, opens_at, closes_at, status, created_by) VALUES
    (elec_nom_id, inst_a_id, 'CS Rep 2024 (Nominations)', 'CS', 2024, now() - interval '1 day', now() + interval '5 days', 'nomination_open', admin_a_id),
    (elec_vote_id, inst_a_id, 'CS Rep 2024 (Voting)', 'CS', 2024, now() - interval '2 days', now() + interval '3 days', 'voting_open', admin_a_id)
  ON CONFLICT (id) DO NOTHING;

  -- Insert Candidates
  INSERT INTO candidates (election_id, user_id, manifesto, status, approved_by) VALUES
    (elec_nom_id, voter1_id, 'I will do great things', 'approved', admin_a_id),
    (elec_vote_id, voter2_id, 'Vote for me', 'approved', admin_a_id)
  ON CONFLICT (election_id, user_id) DO NOTHING;

END $$;
