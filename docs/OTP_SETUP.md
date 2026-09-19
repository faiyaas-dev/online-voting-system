# Supabase OTP setup and troubleshooting

The application supports both six-digit email OTPs and email links. The
browser sends the request with `signInWithOtp`; the server exchanges either a
PKCE `code` or a `token_hash` and then redirects back to the page that started
the flow.

## 1. Configure the public application variables

Set these variables in the local `.env.local` file and in the Netlify
production environment:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

For older Supabase projects, `NEXT_PUBLIC_SUPABASE_ANON_KEY` can be used
instead of the publishable key. Never put a `service_role` or `sb_secret_`
key in either variable.

Restart the local Next.js server after changing environment variables.

## 2. Allow every application callback URL

In Supabase Dashboard, open **Authentication → URL Configuration**:

1. Set **Site URL** to the deployed application URL, for example
   `https://your-site.netlify.app`.
2. Add the local URL `http://localhost:3000/**`.
3. Add the production URL `https://your-site.netlify.app/**`.
4. If a custom domain is used, add `https://your-domain.example/**`.

The application sends callback URLs ending in `/auth/callback` and preserves
the destination page in a `next` query parameter. The wildcard entries above
allow both login and signup flows without allowing an external redirect.

## 3. Configure email delivery

In **Authentication → SMTP Settings**, configure a verified sender with a
transactional SMTP provider. The sender domain must be verified with that
provider. The built-in Supabase email service is intended for development and
has rate limits; it is not a reliable production mail service.

Check the provider's host, port, username, password, sender email, and sender
name. Save the settings, then use the provider's delivery log to confirm
whether a test message was accepted or rejected.

## 4. Choose the email format

In **Authentication → Email Templates → Magic Link**:

- For a six-digit code, include `{{ .Token }}` in the message. Example:

  ```html
  <h2>Sign in to College Election System</h2>
  <p>Enter this one-time code: <strong>{{ .Token }}</strong></p>
  <p>This code expires according to the Email OTP expiration setting.</p>
  ```

- For a clickable link using the recommended PKCE server flow, use:

  ```html
  <h2>Sign in to College Election System</h2>
  <p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Sign in</a></p>
  ```

The application accepts both this `/auth/confirm` link and the older
`/auth/callback?code=...` format. A link is single-use. Inbox security
scanners can consume a link before the user clicks it, so the six-digit code
or **Resend code** is the recovery path.

## 5. Verify the complete flow

1. Start the app with `npm.cmd run dev`.
2. Open `http://localhost:3000/signup` and request an OTP using a mailbox you
   control.
3. Confirm that the message appears in the SMTP provider's delivery log.
4. Enter the six-digit code, or click the email link.
5. Confirm that the browser returns to `/signup` and the institution is
   created.
6. Open `/login` in a private window and repeat the flow.
7. Repeat after deploying to production using the production URL.

## 6. Configure GitHub Actions E2E tests

The E2E workflow starts a local Next.js server in GitHub Actions, so it needs
the same public Supabase values as the browser application. Add these as
repository secrets under **Settings → Secrets and variables → Actions**:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

Use only the public URL and public anon/publishable key. Never add a
`service_role` or `sb_secret_` key. The workflow validates these secrets before
starting Playwright so a missing value fails immediately instead of appearing
as a web-server timeout.

## Error diagnosis

| Symptom | Action |
|---|---|
| `Error sending confirmation email` | Fix SMTP settings, sender verification, provider credentials, or provider rate limits. |
| `redirect URL is not allowed` | Add the exact local/production wildcard URL under URL Configuration. |
| Link returns to the form with `auth_callback_failed` | The link is expired, already used, or the email template does not contain `{{ .TokenHash }}`. Resend a code and verify the template. |
| Six-digit code is not present | Add `{{ .Token }}` to the Magic Link template; `signInWithOtp` uses that template for OTP messages. |
| Codes are rejected immediately | Request only one code per 60 seconds and use the newest message; old codes are invalidated. |
| Production works locally but not on Netlify | Set the public Supabase variables in the Netlify site environment and redeploy. |
