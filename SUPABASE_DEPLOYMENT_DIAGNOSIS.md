# Supabase Deployment Diagnosis

**Project:** `faiyaas-dev/online-voting-system`
**Target Supabase project:** `online-voting-system`
**Project reference:** `ogfbnxqlzetdjxijufpw`
**Organization reference:** `okvwbyzdevidovjnwlth`
**Region:** `ap-south-1`
**Report date:** 2026-09-17
**Status:** Resolved. GitHub Actions migration deployment succeeds through an explicit IPv4 Supavisor session-pooler URL.

## Executive summary

The deployment problem originally appeared to be a general Supabase authentication failure. Investigation separated it into two independent authentication paths:

1. **Supabase Management API access**, used by `supabase link`.
2. **Direct PostgreSQL access**, used by `supabase migration list` and `supabase db push`.

The project reference is valid, the Supabase account token can list the project, the CLI link step succeeds, and migrations now deploy successfully. The decisive infrastructure issue was that GitHub-hosted runners cannot use the project's direct IPv6 database hostname. The final workflow avoids that path by constructing and passing an explicit IPv4 Supavisor session-pooler URL.

## Project and deployment context

This repository is a Next.js 14 voting platform using:

- Supabase PostgreSQL, Auth, Storage, Row Level Security, and migrations.
- Netlify for the frontend deployment.
- GitHub Actions for production migration deployment.
- Supabase CLI `2.117.0`, invoked through pinned `npx` in CI.

The deployment workflow is [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml). It:

1. Checks out `main`.
2. Runs the pinned Supabase CLI.
3. Validates that `SUPABASE_PROJECT_ID` is exactly 20 lowercase letters/digits.
4. Runs `supabase link --password "$SUPABASE_DB_PASSWORD"` to configure the IPv4 pooler connection.
5. Resolves the project region through the Supabase Management API and builds the documented IPv4 Supavisor session-pooler URL from that region, the project reference, and the encoded database password.
6. Runs `supabase migration list --db-url "$SUPABASE_DB_URL"`.
7. Runs `supabase db push --db-url "$SUPABASE_DB_URL"`.

The job uses the GitHub `production` environment and expects these secrets:

| Secret | Purpose |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | Supabase Management API authentication |
| `SUPABASE_PROJECT_ID` | Target project's 20-character reference |
| `SUPABASE_DB_PASSWORD` | Direct PostgreSQL authentication |

No secret values are recorded in this report.

## Complete incident timeline

### Phase 1: application and pipeline preparation

Before the credential investigation, the repository had frontend, database, and CI changes from the voting-platform implementation. The deployment pipeline then exposed several independent issues:

- Playwright voter assertion type mismatch.
- Admin E2E selector mismatch after the CSV upload button changed.
- Non-idempotent `pg_cron` unscheduling migration.
- Invalid audit-report migration SQL.
- Missing project-reference validation.

These were fixed separately. CI later passed in [run 35182689326](https://github.com/faiyaas-dev/online-voting-system/actions/runs/35182689326), proving that the general repository test pipeline was healthy.

### Phase 2: malformed project reference

The first Supabase deployment failure involved a malformed GitHub `SUPABASE_PROJECT_ID`. The value was 16 characters, while a Supabase project reference must be exactly 20 lowercase letters/digits.

The valid reference was recovered from the project's Supabase URL and local metadata:

```text
ogfbnxqlzetdjxijufpw
```

The workflow gained a preflight check so this class of error now fails immediately with a clear message.

### Phase 3: CLI execution was made reproducible

The workflow was changed from the setup action to a pinned CLI invocation:

```bash
npx --yes supabase@2.117.0
```

This removed ambiguity about which CLI version was running and made the malformed-reference error visible.

### Phase 4: Management API authorization

The first valid-reference attempt failed while `supabase link` requested project API keys:

```text
GET /v1/projects/ogfbnxqlzetdjxijufpw/api-keys
Authorization failed for the access token and project ref pair
```

The important distinction was established by testing:

```powershell
npx.cmd --yes supabase@2.117.0 projects list
```

At first this also returned `Unauthorized`. A replacement token from an account with project access then made `projects list` succeed and returned the target project. Linking subsequently succeeded, proving that the Management API credential problem had been resolved.

### Phase 5: direct database connection and IPv6 failure

After linking succeeded, migration verification failed:

```text
IPv6 is not supported on your current network
Run supabase link --project-ref *** to setup IPv4 connection.
```

This was not another token problem. GitHub Actions could reach the Supabase Management API but could not reach the project's direct IPv6 database hostname.

Passing `--password` to `link`, then to `migration list` and `db push`, did not solve the issue because the CLI still selected the direct IPv6 path on the ephemeral runner.

### Phase 6: unreliable pooler metadata assumption

The next attempt tried to read:

```text
supabase/.temp/pooler-url
```

The GitHub runner showed:

```text
cat: supabase/.temp/pooler-url: No such file or directory
```

This demonstrated that local CLI metadata cannot be assumed to exist in a fresh CI workspace, even after `supabase link` reports success.

### Phase 7: final working solution

The final workflow now:

1. Links the project using the Management API token and database password.
2. Calls `GET https://api.supabase.com/v1/projects/{project-ref}`.
3. Reads the authoritative project region from the API response.
4. Builds the documented Supavisor session-mode URL on port `5432`:

   ```text
   postgresql://postgres.<project-ref>:<encoded-password>@aws-0-<region>.pooler.supabase.com:5432/postgres
   ```

5. Masks the complete URL in GitHub Actions.
6. Runs both migration commands with `--db-url`.

The successful deployment confirmed the solution:

- Checkout used commit `3338da5`.
- `supabase link` completed.
- Pooler URL configuration completed.
- Migration state verification completed.
- Migrations were pushed successfully.

## What was investigated

### 1. Project-reference formatting

An earlier workflow run showed that the GitHub project ID was malformed: it was 16 characters. Supabase project references must be 20 lowercase letters/digits.

The reference was corrected to:

```text
ogfbnxqlzetdjxijufpw
```

The local Supabase metadata confirms the same value in:

```text
supabase/.temp/project-ref
```

The current workflow preflight accepts this format, so project-reference formatting is no longer a blocker.

### 2. CLI execution method

The workflow originally used the Supabase setup action. It was changed to a pinned CLI invocation:

```bash
npx --yes supabase@2.117.0
```

This made the project-reference error visible and reproducible. The pinned CLI is now used consistently in [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml).

### 3. CI and migration code

The following repository issues were fixed during the investigation:

- Playwright assertion type error in the voter E2E test.
- Admin E2E selector mismatch after the CSV-upload button changed.
- Non-idempotent `pg_cron` unscheduling migration.
- Invalid audit-report migration SQL.
- Missing project-reference preflight validation.

The GitHub CI run passed:

- [GitHub Actions run 35182689326](https://github.com/faiyaas-dev/online-voting-system/actions/runs/35182689326)

The Netlify production deployment also succeeded:

- [Netlify site](https://agy-voting-sys-2026.netlify.app)
- [Netlify deploy](https://app.netlify.com/projects/agy-voting-sys-2026/deploys/6aab709b18ae8613b75b4576)

The public Netlify URL returns HTTP 401 because site access/SSO protection is enabled. That is separate from the Supabase migration issue.

## Evidence and interpretation

### Evidence A: project listing succeeds

Command:

```powershell
npx.cmd --yes supabase@2.117.0 projects list
```

Result included:

```json
{
  "id": "ogfbnxqlzetdjxijufpw",
  "ref": "ogfbnxqlzetdjxijufpw",
  "organization_id": "okvwbyzdevidovjnwlth",
  "name": "online-voting-system",
  "region": "ap-south-1",
  "status": "ACTIVE_HEALTHY",
  "linked": true
}
```

Interpretation:

- The access token is accepted by at least one Supabase Management API endpoint.
- The token's account can discover this project.
- The project reference and target project are correct.
- The project is active and healthy.

### Evidence B: linking succeeds

The deployment log shows:

```text
Finished supabase link.
```

Interpretation:

- The Management API token and project reference are accepted.
- The link step is not the current failure.

### Evidence C: migration verification fails because no IPv4 pooler was configured

The deployment log shows:

```text
IPv6 is not supported on your current network
Run supabase link --project-ref *** to setup IPv4 connection.
```

The GitHub-hosted runner cannot reach the project's direct IPv6 database hostname. Supabase documents the Supavisor session pooler on port `5432` as an IPv4-compatible alternative. Because CLI 2.117.0 does not reliably persist `supabase/.temp/pooler-url` on the ephemeral runner, the workflow resolves the region from the Management API and constructs the documented pooler hostname directly. It percent-encodes the password and passes the complete connection URL with `--db-url` to both migration commands.

### Evidence D: direct migration access succeeds locally

Command:

```powershell
npx.cmd --yes supabase@2.117.0 migration list
```

Result: local and remote migrations were listed through migration `20260917000001`, including:

```text
20260911000001
20260911000002
20260911000003
20260911000004
20260911000005
20260911000006
20260911000007
20260911000008
20260912000001
20260914071806
20260916125733
20260917000001
```

Interpretation:

- The local CLI has usable linked-project metadata.
- Direct connection to the remote PostgreSQL database succeeds.
- The database password currently available locally is valid enough for migration-state access.
- This does not prove that the Management API token can perform `supabase link`.

## Why the commands disagree

The commands use different services:

```text
supabase link
  └─ Supabase Management API
     └─ reads project metadata and API keys
        └─ requires Management API authorization

supabase migration list
  └─ direct PostgreSQL connection
     └─ reads migration history from the database
        └─ requires database credentials and linked local metadata
```

Therefore, a successful migration listing can coexist with a failed link operation. The apparent contradiction is expected once the two paths are separated.

## Root-cause statement

The remaining deployment blocker is an **IPv6-to-IPv4 database connection setup issue in CI**:

> `supabase link` succeeds, but `supabase migration list` cannot use an IPv4 pooler connection and falls back to the project's IPv6-only direct database host.

The evidence does not currently indicate a wrong project ID, wrong database password, broken migration SQL, invalid CLI version, or GitHub Actions syntax failure.

## Recovery procedure

### Step 1: verify the token-owning account

Sign in to the Supabase account that generated the token and open:

```text
https://supabase.com/dashboard/project/ogfbnxqlzetdjxijufpw
```

The account must be able to access this exact project and its project settings. If the account cannot open the project, ask the organization owner to invite it and assign sufficient access. Accept the invitation before generating a new token.

Supabase documents the organization/project roles in its [Access Control documentation](https://supabase.com/docs/guides/platform/access-control). Use the least-privileged role that can read project API keys; if a Developer role cannot do so, use a project Administrator or Owner account for the deployment token.

### Step 2: verify the database password

Use the database password for this same Supabase project. Do not substitute the access token, anon key, service-role key, account password, or project URL.

### Step 3: test the credentials locally

In a new PowerShell process:

```powershell
Remove-Item Env:SUPABASE_ACCESS_TOKEN -ErrorAction SilentlyContinue
$env:SUPABASE_ACCESS_TOKEN = Read-Host "Paste Supabase access token"
$env:SUPABASE_DB_PASSWORD = Read-Host "Paste Supabase database password"

npx.cmd --yes supabase@2.117.0 projects list
npx.cmd --yes supabase@2.117.0 link `
  --project-ref ogfbnxqlzetdjxijufpw `
  --password $env:SUPABASE_DB_PASSWORD `
  --password $env:SUPABASE_DB_PASSWORD
```

Expected result:

```text
Finished supabase link.
```

If `projects list` fails with `Unauthorized`, the token is invalid, revoked, expired, or incorrectly copied. If linking succeeds but migration access still reports IPv6, test with the explicit Supavisor URL pattern described in the final workflow rather than relying on local link metadata.

### Step 4: update GitHub's production environment

Confirm these secrets are present under:

```text
Repository Settings
→ Environments
→ production
→ production
→ Environment secrets
→ Environment secrets
```

```text
SUPABASE_ACCESS_TOKEN
SUPABASE_PROJECT_ID
SUPABASE_DB_PASSWORD
```

Keep the confirmed project reference:

```text
SUPABASE_PROJECT_ID=ogfbnxqlzetdjxijufpw
```

Keep the database password for the same project unless a later database-authentication error proves it needs rotation.

### Step 5: rerun the workflow

Run [Deploy Migrations to Supabase](https://github.com/faiyaas-dev/online-voting-system/actions/workflows/deploy.yml) manually on `main`.

Expected order:

```text
Validate project reference       ✓
Link to Supabase Project         ✓
Configure IPv4 pooler connection ✓
Verify migration state           ✓
Push Migrations                  ✓
```

## Decision table for the next failure

| Failure location | Meaning | Action |
|---|---|---|
| Project-reference preflight | GitHub project ID is malformed | Replace `SUPABASE_PROJECT_ID` with `ogfbnxqlzetdjxijufpw` |
| `projects list` returns `Unauthorized` | Token is invalid/revoked/expired | Generate and test a new token |
| Project list omits this project | Wrong account or missing membership | Fix Supabase organization/project access |
| `link` fails at `/api-keys` | Insufficient project-management privilege | Use a token from an Administrator/Owner or enable required API-key read access |
| `migration list` reports IPv6 unsupported | CLI selected the direct IPv6 host | Use an explicit Supavisor `--db-url`; do not use `--skip-pooler` |
| `supabase/.temp/pooler-url` is missing | Ephemeral CI metadata is unavailable | Derive the pooler URL from the Management API project region |
| `migration list` fails with database authentication | Database password is wrong | Reset the target project's database password and update the GitHub secret |
| `db push` reports SQL/migration failure | Credentials are working | Fix the reported migration, not the secrets |

## Current conclusion

The project is healthy enough to list through the Management API, link successfully, and connect directly to PostgreSQL from the local environment. CI and Netlify are functioning. The migration deployment was blocked because GitHub Actions cannot use the project's direct IPv6 database host. The workflow now supplies an explicit IPv4 Supavisor session-pooler URL to both migration commands, avoiding direct-host DNS fallback and reliance on ephemeral CLI pooler metadata.

The deployment is now operational. Future incidents should first identify the failing boundary: project-reference validation, Management API authorization, direct database authentication, network address family, pooler URL construction, or SQL migration execution. These are independent failure classes and must not be debugged by rotating all three secrets at once.

## Related project references

- [Deployment workflow](./.github/workflows/deploy.yml)
- [Project README](./README.md)
- [Supabase migration directory](./supabase/migrations/)
- [Supabase access-control documentation](https://supabase.com/docs/guides/platform/access-control)
- [Supabase environment/deployment documentation](https://supabase.com/docs/guides/deployment/managing-environments)
