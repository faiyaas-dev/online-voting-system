# Production Runbook

This runbook covers the operational procedures for the Online Voting System platform, including deployment secrets setup, rollbacks, and incident response.

## 1. Deployment Architecture

- **Frontend & APIs**: Hosted on **Netlify**, utilizing native GitHub integration for automatic deployments on push to `main`.
- **Database & Auth**: Hosted on **Supabase**. Migrations and Edge Functions are deployed via **GitHub Actions**.

---

## 2. Setting Up CD Pipeline Secrets (Supabase GitHub Actions)

To enable automatic database migration deployment via GitHub Actions (`deploy.yml`), you must configure the following secrets in your GitHub repository (**Settings > Secrets and variables > Actions > Repository secrets**):

1. **`SUPABASE_PROJECT_ID`**:
   - Go to your Supabase Project Dashboard.
   - Navigate to **Project Settings** > **General**.
   - Copy the **Reference ID**.
2. **`SUPABASE_ACCESS_TOKEN`**:
   - Go to your personal account settings in Supabase (bottom left corner).
   - Navigate to **Access Tokens**.
   - Generate a new token and copy it.
3. **`SUPABASE_DB_PASSWORD`**:
   - This is the database password you provided when initially creating the Supabase project.

---

## 3. Netlify Deployment & Secrets Management

The Next.js frontend is deployed via Netlify's GitHub App.

### Configuring Secrets in Netlify

You must add the following environment variables to your Netlify site. You can do this via the Netlify Dashboard (**Site Settings > Environment Variables**) or using the Netlify CLI:

```bash
netlify link # Link your local repo to the Netlify site

netlify env:set NEXT_PUBLIC_SUPABASE_URL "your-project-url"
netlify env:set NEXT_PUBLIC_SUPABASE_ANON_KEY "your-anon-key"
netlify env:set SUPABASE_SERVICE_ROLE_KEY "your-service-role-key"
netlify env:set WEBHOOK_SECRET "your-generated-webhook-secret"
```

> [!CAUTION]
> Never commit `.env.local` or any file containing the `SUPABASE_SERVICE_ROLE_KEY` to the Git repository. The service role key bypasses all Row Level Security (RLS) policies and must remain strictly server-side.

---

## 4. Operational Procedures & Incident Response

### 4.1. Rolling Back a Bad Migration

If a bad migration is deployed to production, **do not manually alter the database schema**. Instead:
1. Revert the PR that introduced the bad migration in GitHub.
2. The `deploy.yml` pipeline will trigger, but `supabase db push` will not automatically downgrade. You must apply a rollback script or use `supabase db reset` locally to rewrite the migration history, then force push.
3. If data corruption occurred, restore from the latest automated Supabase Point-in-Time Recovery (PITR) backup via the Supabase Dashboard.

### 4.2. Checking Current Election Statuses in Prod

To audit election statuses without using the application UI, run this query in the Supabase SQL Editor:

```sql
SELECT 
  id, 
  title, 
  status, 
  opens_at, 
  closes_at, 
  (SELECT count(*) FROM votes WHERE votes.election_id = elections.id) as total_votes
FROM elections
ORDER BY created_at DESC;
```

### 4.3. Troubleshooting Missing Votes

If users report that their votes are not being recorded, investigate the following sequence:

1. **Election Status**: Is `elections.status` set to exactly `'voting_open'`? The RLS policy explicitly rejects inserts if the status is anything else.
2. **Eligibility Scope**: Does the voter's `department` and `year` match the election's `scope_department` and `scope_year`? 
3. **Double-Vote Constraint**: Has the user already voted? Check if they are hitting the `UNIQUE(voter_id, election_id)` constraint on the `votes` table.
4. **Logs Check**: Go to the Supabase Dashboard > **Logs** > **Postgres** and search for `policy violations` or `permission denied` to confirm if RLS is dropping the insert.
