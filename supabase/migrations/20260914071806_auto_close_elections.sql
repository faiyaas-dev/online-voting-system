-- Enable pg_cron extension (Supabase supports this natively)
create extension if not exists pg_cron;

-- 1. Add CHECK constraint enforcing closes_at > opens_at
-- Guarantees valid election timeline bounds at the schema level
alter table public.elections
  add constraint elections_timeline_check
  check (closes_at > opens_at);

-- 2. Add pg_cron job to auto-close expired elections every 5 minutes
-- Unschedule first to ensure idempotency if this migration is re-run
select cron.unschedule('auto_close_expired_elections');

select cron.schedule(
  'auto_close_expired_elections',
  '*/5 * * * *',
  $$
    update public.elections
    set status = 'closed'
    where status = 'voting_open'
      and closes_at < now();
  $$
);

-- 3. Eliminate TOCTOU window between cron sweeps
-- Enforce temporal boundary directly in votes_insert RLS check alongside e.status = 'voting_open'
drop policy if exists votes_insert on votes;

create policy votes_insert on votes
  for insert with check (
    voter_id = auth.uid()
    and exists (
      select 1 from elections e
      where e.id = election_id
        and e.institution_id = my_institution_id()
        and e.status = 'voting_open'
        and now() <= e.closes_at
        and (e.scope_department is null or e.scope_department = (select department from profiles where id = auth.uid()))
        and (e.scope_year is null or e.scope_year = (select year from profiles where id = auth.uid()))
    )
  );
