# Contributing to Online Voting System

Thank you for your interest in contributing to the Online Voting System. This document provides guidelines, development workflows, quality gates, and code standards for all contributors.

---

## 1. Development Prerequisites

- **Node.js**: 20.19+
- **Package Manager**: `npm` (v9+) or `bun`
- **Supabase CLI**: `npm install -g supabase`
- **OpenSpec CLI**: `npm install -g @fission-ai/openspec`

---

## 2. Local Environment Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-org/online-voting-system.git
   cd online-voting-system
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   ```bash
   cp .env.local.example .env.local
   ```
   Fill in your development Supabase URL and anonymous key.

4. **Start the local development server**:
   ```bash
   npm run dev
   ```

---

## 3. OpenSpec Change Process

Every database schema modification, RLS policy update, or major feature addition must follow the OpenSpec workflow:

1. Propose the change:
   ```bash
   openspec propose <change-name>
   ```
2. Author `proposal.md`, `specs/`, and `design.md` detailing the user stories and Given/When/Then scenarios.
3. Review and validate before writing migration SQL.
4. Implement tasks in `tasks.md` and archive upon completion.

---

## 4. Code Standards & Conventions

- **TypeScript**: Strict mode enabled. Avoid `any` where explicit interfaces exist in `lib/supabase/types.ts`.
- **Styling**: Tailwind CSS utility classes adhering to the minimalist dark aesthetic.
- **Security-First Architecture**:
  - Never execute raw unbounded queries from client components.
  - Never place service-role credentials in client code.
  - Always enforce multi-tenant isolation via `institution_id` and RLS.
- **Git Commits**: Use Conventional Commits format:
  - `feat: add live countdown on voting page`
  - `fix: resolve candidate headshot square crop on mobile`
  - `docs: update API reference for audit certificates`
  - `test: add unit test for double-vote rejection`

---

## 5. Quality Gates & Testing

Before submitting a Pull Request, all automated checks must pass:

```bash
# Run linting
npm run lint

# Run Jest unit test suite
npm run test

# Run Playwright E2E browser tests
npx playwright test
```

### Pull Request Checklist
- [ ] Code follows project conventions and strict TypeScript typing.
- [ ] New database migrations include corresponding RLS policies.
- [ ] Automated tests cover happy paths and edge cases (e.g. cross-tenant access rejection).
- [ ] Documentation updated in `docs/` for any modified user flows or RPCs.
