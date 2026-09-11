-- Create the candidate-photos bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'candidate-photos',
  'candidate-photos',
  false,
  2097152,  -- 2 MB
  array['image/jpeg', 'image/png', 'image/webp']
) on conflict (id) do nothing;

-- Upload: candidates upload their own photo during nomination_open
create policy storage_candidate_photo_insert
  on storage.objects for insert
  with check (
    bucket_id = 'candidate-photos'
    and (storage.foldername(name))[3] = auth.uid()::text
    and (storage.foldername(name))[1] = my_institution_id()::text
    and exists (
      select 1 from candidates c
      join elections e on e.id = c.election_id
      where c.user_id = auth.uid()
        and c.election_id = ((storage.foldername(name))[2])::uuid
        and e.institution_id = my_institution_id()
        and e.status = 'nomination_open'
    )
  );

-- Replace: candidates can replace their photo while nomination is open and status is pending
create policy storage_candidate_photo_update
  on storage.objects for update
  using (
    bucket_id = 'candidate-photos'
    and (storage.foldername(name))[3] = auth.uid()::text
    and (storage.foldername(name))[1] = my_institution_id()::text
    and exists (
      select 1 from candidates c
      join elections e on e.id = c.election_id
      where c.user_id = auth.uid()
        and c.election_id = ((storage.foldername(name))[2])::uuid
        and e.institution_id = my_institution_id()
        and e.status = 'nomination_open'
        and c.status = 'pending'
    )
  );

-- Read: approved photos visible to whole institution; pending/rejected only to candidate + admins
create policy storage_candidate_photo_select
  on storage.objects for select
  using (
    bucket_id = 'candidate-photos'
    and (storage.foldername(name))[1] = my_institution_id()::text
    and (
      exists (
        select 1 from candidates c
        join elections e on e.id = c.election_id
        where c.election_id = ((storage.foldername(name))[2])::uuid
          and c.user_id = ((storage.foldername(name))[3])::uuid
          and c.status = 'approved'
          and e.institution_id = my_institution_id()
      )
      or (storage.foldername(name))[3] = auth.uid()::text
      or my_role() in ('institution_admin', 'department_admin')
    )
  );

-- Delete: only institution_admin can delete photos
create policy storage_candidate_photo_delete
  on storage.objects for delete
  using (
    bucket_id = 'candidate-photos'
    and (storage.foldername(name))[1] = my_institution_id()::text
    and my_role() in ('institution_admin')
  );
