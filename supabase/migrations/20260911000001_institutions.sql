-- institutions: tenant root
create table institutions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  created_at timestamptz default now()
);

-- Enable RLS on institutions
alter table institutions enable row level security;
