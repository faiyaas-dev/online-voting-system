-- votes: one per voter per election, DB-enforced
create table votes (
  id uuid primary key default gen_random_uuid(),
  voter_id uuid references profiles(id) not null,
  election_id uuid references elections(id) not null,
  candidate_id uuid references candidates(id) not null,
  cast_at timestamptz default now(),
  unique(voter_id, election_id)
);

alter table votes enable row level security;

-- votes: insert only if voter belongs to institution, election is
-- voting_open, and eligibility matches
create policy votes_insert on votes
  for insert with check (
    voter_id = auth.uid()
    and exists (
      select 1 from elections e
      where e.id = election_id
        and e.institution_id = my_institution_id()
        and e.status = 'voting_open'
        and (e.scope_department is null or e.scope_department = (select department from profiles where id = auth.uid()))
        and (e.scope_year is null or e.scope_year = (select year from profiles where id = auth.uid()))
    )
  );

-- votes: voters can't read others' ballots; results come from a separate
-- RPC function, never raw votes table
create policy votes_own_read on votes
  for select using (voter_id = auth.uid());

-- get_election_results: aggregated tally only, never raw vote rows.
-- Locked until election is closed (or caller is an institution/platform admin).
create or replace function get_election_results(p_election_id uuid)
returns table (candidate_id uuid, vote_count bigint) as $$
begin
  if not exists (
    select 1 from elections e
    where e.id = p_election_id
      and e.institution_id = my_institution_id()
      and (e.status = 'closed' or my_role() in ('institution_admin', 'platform_admin'))
  ) then
    raise exception 'Results locked until election is closed';
  end if;

  return query
  select v.candidate_id, count(v.id)
  from votes v
  where v.election_id = p_election_id
  group by v.candidate_id;
end;
$$ language plpgsql security definer;

-- get_platform_metrics: cross-institution aggregate stats
create or replace function get_platform_metrics()
returns table (
  institution_id   uuid,
  institution_name text,
  total_elections  bigint,
  active_elections bigint,
  closed_elections bigint,
  total_voters     bigint,
  total_votes_cast bigint,
  participation_pct numeric
) as $$
begin
  -- Gate: only platform_admin may call this
  if my_role() != 'platform_admin' then
    raise exception 'Access denied: platform_admin role required';
  end if;

  return query
  select
    i.id                                         as institution_id,
    i.name                                       as institution_name,
    count(distinct e.id)                         as total_elections,
    count(distinct e.id) filter (
      where e.status = 'voting_open')            as active_elections,
    count(distinct e.id) filter (
      where e.status = 'closed')                 as closed_elections,
    (select count(*) from roster r
     where r.institution_id = i.id)              as total_voters,
    count(distinct v.id)                         as total_votes_cast,
    round(
      count(distinct v.id)::numeric /
      nullif(
        (select count(*) from roster r2
         where r2.institution_id = i.id) *
        nullif(count(distinct e.id) filter (
          where e.status in ('voting_open','closed')), 0),
        0
      ) * 100,
      2
    )                                            as participation_pct
  from institutions i
  left join elections e on e.institution_id = i.id
  left join votes v     on v.election_id = e.id
  group by i.id, i.name
  order by i.name;
end;
$$ language plpgsql security definer stable;
