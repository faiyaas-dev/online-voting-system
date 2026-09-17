-- Closed-election aggregate reporting for institution administrators.
-- The report never exposes voter identities or raw ballots.
create or replace function get_election_audit_report(p_election_id uuid)
returns jsonb as $$
declare
  v_report jsonb;
  v_integrity_payload jsonb;
begin
  if my_role() <> 'institution_admin' then
    raise exception 'Access denied: institution admin role required';
  end if;

  select jsonb_build_object(
    'institution_name', i.name,
    'election_id', e.id,
    'election_title', e.title,
    'scope', coalesce(e.scope_department, 'Institution-wide') ||
      case when e.scope_year is null then '' else ' · Year ' || e.scope_year::text end,
    'opens_at', e.opens_at,
    'closes_at', e.closes_at,
    'status', e.status,
    'eligible_voter_count', (
      select count(*) from roster r
      where r.institution_id = e.institution_id
        and (e.scope_department is null or r.department = e.scope_department)
        and (e.scope_year is null or r.year = e.scope_year)
    ),
    'votes_cast', (select count(*) from votes v where v.election_id = e.id),
    'participation_pct', round(
      (select count(*)::numeric from votes v where v.election_id = e.id) /
      nullif((
        select count(*) from roster r
        where r.institution_id = e.institution_id
          and (e.scope_department is null or r.department = e.scope_department)
          and (e.scope_year is null or r.year = e.scope_year)
      ), 0) * 100, 2
    ),
    'results', coalesce((
      select jsonb_agg(jsonb_build_object(
        'candidate_id', c.id,
        'candidate_name', coalesce(p.full_name, 'Unknown'),
        'vote_count', (select count(*) from votes v where v.candidate_id = c.id and v.election_id = e.id)
      ) order by (select count(*) from votes v2 where v2.candidate_id = c.id and v2.election_id = e.id) desc, c.id),
      '[]'::jsonb
    )
  ) into v_report
  from elections e
  join institutions i on i.id = e.institution_id
  where e.id = p_election_id
    and e.institution_id = my_institution_id()
    and e.status = 'closed';

  if v_report is null then
    raise exception 'Closed election report unavailable';
  end if;

  v_integrity_payload := v_report;
  v_report := v_report || jsonb_build_object(
    'integrity_sha256',
    encode(digest(v_integrity_payload::text, 'sha256'), 'hex'),
    'generated_at', now()
  );
  return v_report;
end;
$$ language plpgsql security definer stable;
