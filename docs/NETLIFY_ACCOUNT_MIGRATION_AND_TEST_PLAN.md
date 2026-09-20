# Netlify account transition and manual quality gate

This runbook moves the online voting site from an old Netlify account/team to a new one without treating deletion as the first step. It is designed for the repository's Next.js + Supabase architecture and for Netlify's credit-based pricing model.

> **Safety rule:** Do not delete the old Netlify site until the replacement site has passed the local test gate, a production build, smoke checks, domain checks, and a rollback rehearsal. A Netlify site transfer is preferable to delete-and-recreate when it is available because it avoids needless reconfiguration and preserves the existing site identity.

## 1. Inputs, roles, and evidence

Record these values in a private change record, not in Git:

- old Netlify team/account and site name/ID
- new Netlify team/account and site name/ID
- Git repository and production branch
- Supabase project reference, URL, publishable/anonymous key, and Auth redirect URLs
- custom domain, DNS provider, and current DNS records
- current production URL and a deploy permalink that can be used as rollback evidence
- a maintenance window and the person authorised to delete the old site

Never record access tokens, database passwords, `SUPABASE_SERVICE_ROLE_KEY`, or OTP links in the change record. Rotate any token used for the move after the cutover.

## 2. Choose the migration path

```text
if the old site can be transferred to the new Netlify team:
    use Netlify's site-transfer workflow
    preserve the site identity and reconnect/verify team access
else:
    create a new site in the new team
    connect the same Git repository and production branch
    reproduce build settings, environment variables, domains, redirects, headers,
    functions/plugins, deploy contexts, access controls, and notifications
```

Do not create a second Supabase production project for this hosting move. Netlify hosts the frontend; Supabase remains the data/auth/storage system unless a separate database migration has been explicitly approved.

## 3. Freeze and inventory the old site

1. Stop unrelated merges to the production branch for the cutover window.
2. In the old site, export or copy the build command (`npm run build`), publish/output behavior (`.next` with the Next.js plugin), Node version, base directory, production branch, deploy contexts, plugins, redirects, headers, functions, domain aliases, HTTPS status, deploy notifications, and access controls.
3. Save the current production URL and a deploy permalink. Netlify deploy permalinks are immutable snapshots and are the emergency rollback reference.
4. Confirm that the repository contains no credentials and that `.env.local` is ignored.
5. Confirm Supabase Auth redirect URLs include both the current URL and the planned replacement URL during the overlap period.

## 4. White-box testing on the local system

Run these commands from the repository root in PowerShell. Use `npm.cmd` if PowerShell blocks `npm.ps1`.

```powershell
npm.cmd ci
npm.cmd run lint
npm.cmd run test
npm.cmd run test:coverage
npm.cmd run build
```

Record the exit code and the generated coverage summary. The white-box gate must cover:

| Area | Manual check | Pass condition |
|---|---|---|
| Unit logic | `tests/unit/*.test.ts` | vote, photo, roster CSV, and auth-error contracts pass |
| Branch coverage | inspect the coverage report for valid/invalid, eligible/ineligible, open/closed, admin/voter, and error branches | no untested security decision branch is accepted without a documented reason |
| Path coverage | trace signup, OTP callback, roster claim, nomination, approval, vote, results, and platform metrics paths | every success path and each expected rejection path has a test or recorded manual result |
| Integration/API | run against a disposable/local Supabase stack where available; exercise RPCs and table writes through the real Supabase client | response shape, auth context, RLS denial, and user-facing error mapping are correct |
| Error/exception handling | force invalid CSV, duplicate vote, closed election, missing roster email, expired/invalid link, and unavailable RPC | no raw SQLSTATE, RPC name, secret, or stack trace is shown to a voter |
| Build/type safety | `npm.cmd run lint`, `npm.cmd run build`, and `npx tsc --noEmit` | all commands exit zero |

The repository's three database integrity rules remain mandatory: duplicate votes are rejected, closed-election inserts are rejected by RLS, and result tallies match a hand-computed fixture. Also verify Institution A cannot read or mutate Institution B data.

## 5. Black-box testing on the local system

Start the app with the same public Supabase variables used by the candidate site:

```powershell
$env:NEXT_PUBLIC_SUPABASE_URL="https://<dev-project>.supabase.co"
$env:NEXT_PUBLIC_SUPABASE_ANON_KEY="<publishable-or-anon-key>"
npm.cmd run dev
```

In a second terminal:

```powershell
npm.cmd run test:smoke
npm.cmd run test:e2e
```

Manually repeat the following with browser DevTools Network and Console open:

### Smoke testing

- `/` loads with Sign In and Register Institution.
- `/signup` renders institution name, slug, and email fields.
- unauthenticated `/elections` redirects to `/login`.
- no console error, failed asset request, or unexpected 5xx occurs.

### Integration and API testing

- complete OTP callback and voter roster claim with a disposable account;
- create an institution and admin, then verify the profile role is server-assigned;
- create an election, open nomination, nominate/approve a candidate, open voting, cast one vote, and close the election;
- call results through the UI/RPC and confirm raw vote rows are never exposed;
- verify platform metrics are aggregate-only and denied to non-platform users.

### Boundary Value Analysis

Use values just below, at, and just above each boundary:

- photo: 2 MB - 1 byte, exactly 2 MB, 2 MB + 1 byte;
- photo MIME: JPEG/PNG/WebP accepted; GIF, text, empty, and spoofed extension rejected;
- CSV: zero rows, one valid row, required-column omission, blank line, quoted comma/newline, duplicate email/roll number, invalid year, malformed email;
- election: draft, nomination_open, voting_open, closed; scope department/year null, exact match, and mismatch;
- vote: first insert succeeds, second insert for the same voter/election fails, different election remains independent;
- auth: valid, expired, malformed, and wrong-institution links.

Capture the result, expected result, actual result, and evidence URL/screenshot for each failed or surprising case.

## 6. Credit-conscious candidate-site setup

Create or transfer the site only after the local gate is green.

1. Connect the new site to the existing Git repository and production branch.
2. Set the exact build command from `netlify.toml`: `npm run build`.
3. Use the Next.js plugin already present in `netlify.toml`; do not add a second framework adapter.
4. Configure only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or the repository's supported publishable key). Never configure a service-role key in Netlify.
5. Set the Node version explicitly if the old site did so, preferably through the repository's supported version file or Netlify build setting.
6. During the move, disable nonessential branch deploys and Deploy Previews. Re-enable previews after the first stable production deploy if the credit budget permits. Use GitHub Actions for tests so failed test changes do not consume a Netlify production build.
7. Avoid repeated manual redeploys. Run one candidate production deploy after local build/test success.

## 6A. New-account preconditioning algorithm (Netlify CLI first)

Run this from a clean PowerShell window after installing the current Netlify CLI:

```powershell
npm.cmd install --global netlify-cli
netlify --version
netlify help
```

The CLI syntax can change between releases, so stop if a command is not present in `netlify help`; do not substitute an unreviewed destructive API call.

### A. Authenticate and prove the account context

Use a browser login for a one-off move, or a short-lived token supplied through the shell for automation. Never commit a token or put it in `.env.local`.

```powershell
netlify login
netlify status
netlify teams:list
```

If the old and new accounts are separate Netlify accounts, use separate authenticated sessions or a token that is explicitly authorised for both teams. Confirm the displayed account/team before every site command.

### B. Snapshot the old site without exposing secrets

```powershell
netlify link --id <OLD_SITE_ID>
netlify status
netlify env:list --context production --json
netlify env:list --context deploy-preview --json
netlify env:list --context branch-deploy --json
netlify open:admin
netlify open:site
```

Save the JSON only in a protected, local change record. Treat it as sensitive: resolved environment values can include secrets. Do not commit it, paste it into a ticket, or print it in CI logs. Record the old site ID, team, production URL, deploy permalink, repository/branch, build settings, domains, and deploy-context settings separately.

### C. Create or prepare the new site

For a delete-and-recreate migration, create the empty site in the new team:

```powershell
netlify sites:create --name <NEW_SITE_NAME> --team <NEW_TEAM_SLUG>
netlify link --id <NEW_SITE_ID>
netlify status
```

For a site that already exists, use `netlify link --id <NEW_SITE_ID>` instead. If continuous deployment must be configured from the repository, run this only after confirming the new site/team:

```powershell
netlify init --git-remote-name origin
```

Prefer the Netlify dashboard for selecting the GitHub installation/repository when the new account does not yet have GitHub access. `netlify init` cannot grant a GitHub App installation permission that the account does not possess.

### D. Reproduce environment variables safely

Preferred path when the authenticated identity can read both sites:

```powershell
netlify env:clone --from <OLD_SITE_ID> --to <NEW_SITE_ID>
netlify env:list --site <NEW_SITE_ID> --context production --json
```

If the accounts cannot share an authorised CLI identity, import from a protected local file that is never committed:

```powershell
netlify link --id <NEW_SITE_ID>
netlify env:import C:\secure\online-voting-production.env
```

For this application, the new site should contain only the public runtime variables:

```powershell
netlify env:set NEXT_PUBLIC_SUPABASE_URL "https://<project-ref>.supabase.co" --context production
netlify env:set NEXT_PUBLIC_SUPABASE_ANON_KEY "<publishable-or-anon-key>" --context production
```

Use `--context deploy-preview` or `--context branch-deploy` only when those deploys are intentionally enabled. Do not clone or import `SUPABASE_SERVICE_ROLE_KEY`, database passwords, or other privileged credentials into Netlify. If a server-only Netlify Function genuinely requires a secret, set it explicitly with the CLI's secret option and scope it to functions; this repository's current frontend does not need that exception.

Verify names and scopes without printing values:

```powershell
netlify env:list --site <NEW_SITE_ID> --context production
netlify env:list --site <NEW_SITE_ID> --context deploy-preview
```

### E. Reproduce and locally exercise Netlify behavior

From the linked repository:

```powershell
netlify dev --context production
```

In another terminal, run the smoke checks against the local Netlify proxy. Then stop the process cleanly. This exercises the build configuration, redirects, headers, functions, framework detection, and context variables before consuming a hosted deploy.

For an explicit production-like build:

```powershell
netlify build --context production
```

Do not use `netlify deploy --prod` until this local Netlify build and the repository test gate are green.

### F. Make one candidate deploy, then verify it

Use a draft deploy first; it does not replace production:

```powershell
netlify deploy --site <NEW_SITE_ID> --context production --message "account migration candidate" --json
```

Open the candidate URL from the JSON output, or:

```powershell
netlify open:site --site <NEW_SITE_ID>
```

Run the smoke, authentication, Supabase, election, nomination, and voting checks from this runbook against the candidate URL. Only after those pass should the authorised operator publish once:

```powershell
netlify deploy --site <NEW_SITE_ID> --prod --context production --message "account migration production cutover" --json
```

The `--no-build` flag is intentionally not used here: it can avoid a duplicate build, but only when the exact already-built output is known to be valid for the candidate site. For this Next.js application, prefer one verified production build over accidentally publishing stale output.

### G. CLI cleanup and post-cutover evidence

```powershell
netlify status --site <NEW_SITE_ID>
netlify env:list --site <NEW_SITE_ID> --context production
netlify open:admin --site <NEW_SITE_ID>
netlify open:site --site <NEW_SITE_ID>
```

Record the new site ID, production deploy ID/permalink, final URL, build log URL, and verification timestamp. After the observation window, unlink the local folder before switching accounts or working on another site:

```powershell
netlify unlink
```

Do not run a site-delete command as part of an unattended script. Deletion is the final, separately approved action described in section 9.

### CLI capability boundary: leave these to the operator

The CLI can prepare, link, configure variables, build, deploy, inspect, and open the project. The following must remain an explicit operator action because they change account ownership, billing, external identity, or irreversible production state:

| Operator action | Why it is not delegated here |
|---|---|
| Create/verify the new Netlify account, plan, payment/credit settings, and spend limits | Account owner/billing authority |
| Accept team invitations, choose team roles, and authorise the Netlify GitHub/GitLab app | External identity and permissions |
| Transfer the site between teams, if using transfer rather than recreate | Ownership change and account UI/API approval |
| Confirm custom domain ownership, DNS records, and certificate status | Registrar/DNS authority and propagation |
| Update Supabase Auth Site URL/redirect allow-list | Supabase project-owner action |
| Enable/disable Deploy Previews, branch deploys, build hooks, notifications, access/password protection, and deploy retention | Site policy choices with account/plan implications |
| Approve the production DNS cutover and observation window | Release authority |
| Delete the old site/team and revoke old account tokens | Irreversible/destructive action |

## 7. Candidate deploy verification

Before changing DNS or deleting the old site:

1. Open the new `*.netlify.app` URL and its immutable deploy permalink.
2. Repeat the smoke suite and the critical voter/admin journeys against the candidate URL.
3. Verify browser console, Network responses, Supabase Auth callback, images, redirects, headers, and HTTPS.
4. Verify Netlify build logs contain no secret values and the build uses the intended production variables.
5. Verify the old production URL is still healthy. If the candidate fails, fix or roll back without touching the old site.

## 8. Cut over the domain and authentication

1. Add the custom domain to the candidate site and complete Netlify domain/HTTPS verification.
2. Update Supabase Auth Site URL and redirect allow-list to include the candidate/custom domain before switching users.
3. If using external DNS, keep the existing records until the candidate is ready, then change the CNAME/ALIAS/A record according to the DNS provider and Netlify's current domain instructions.
4. Allow for DNS/cache propagation. Test from a normal browser, private window, and a second network.
5. Re-run sign-in, callback, nomination, vote, and results checks through the real custom domain.
6. Keep the old deploy permalink and a written rollback instruction: restore the old DNS target and old Supabase redirect entry.

## 9. Delete the old site only after the observation window

Wait through an agreed observation period with no election activity or user-impacting errors. Confirm:

- candidate site and custom domain are healthy;
- no active election is mid-vote during deletion;
- DNS and Supabase Auth redirects no longer depend on the old site;
- GitHub/Netlify hooks and badges point to the candidate site;
- the owner has approved deletion and the rollback evidence is archived.

Then remove the old site from the old Netlify team using the dashboard's project/site deletion control. Treat this as irreversible for the purposes of this runbook. Do not delete the Supabase project, storage bucket, database, Git repository, or domain registration.

After deletion, revoke old Netlify personal access tokens, remove old team members, and update the README badge and any bookmarks/monitoring to the new site.

## 10. Rollback algorithm

```text
if candidate deploy fails before DNS cutover:
    keep old site live
    fix candidate or abandon it
if candidate fails after DNS cutover:
    restore old DNS target
    restore old Supabase Auth redirect if required
    verify old immutable deploy permalink
    investigate candidate logs without deleting evidence
if old site has already been deleted:
    redeploy the pinned Git commit to a newly created site
    restore environment/domain settings from the inventory
    rotate credentials and notify stakeholders
```

## Official references consulted

- [Netlify build configuration](https://docs.netlify.com/build/configure-builds/overview/)
- [Netlify environment variables](https://docs.netlify.com/build/configure-builds/environment-variables/)
- [Netlify deploys and immutable deploy URLs](https://docs.netlify.com/deploy/manage-deploys/manage-deploys-overview/)
- [Netlify Deploy Previews](https://docs.netlify.com/deploy/deploy-types/deploy-previews/)
- [Netlify CLI](https://docs.netlify.com/api-and-cli-guides/cli-guides/get-started-with-cli/)
- [Netlify domain configuration](https://docs.netlify.com/manage/domains/get-started-with-domains/)
- [Netlify credit-based billing overview](https://docs.netlify.com/manage/accounts-and-billing/billing/overview/)
