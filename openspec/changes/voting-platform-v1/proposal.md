# Proposal: Voting Platform V1

## Rationale for MoSCoW Scope

We are proposing the full Must + Should + Could scope for this V1 build because each tier provides significant compounding value to the core product proposition (a self-serve, multi-tenant voting SaaS), and building them cohesively in one pass reduces future architectural rework.

### Why Must?
The **Must** tier represents the absolute Minimum Viable Product (MVP) required to run a secure election. Without it, the product simply does not function. It establishes the multi-tenant foundation (`institutions`, `profiles`, `roster`), secure passwordless authentication (OTP), multi-level elections (department/year scoping), and the core voting flow (self-nomination, admin approval, and DB-enforced one-vote-per-voter limits). This tier is non-negotiable.

### Why Should?
The **Should** tier elevates the platform from a simple tool to a viable organizational SaaS product.
- **Department Admin Tier**: In real-world colleges, elections are highly decentralized. Forcing Institution Admins to manage every department-level election creates a bottleneck. Adding the Department Admin tier empowers delegation and matches real organizational structures.
- **Unit Tests**: Given the strict compliance and security requirements of an election platform, DB-enforced constraints (double-vote rejection, closed-election lock) and tally math must be provably correct. These tests are critical to establish trust in the system's integrity.

### Why Could?
The **Could** tier provides the polish and operational visibility necessary for scaling.
- **Platform Admin Dashboard**: Essential for our own operational oversight across tenants (e.g., tracking adoption, global election counts, participation rates) without granting raw database access.
- **CSV Validator with Row-Level Errors**: Roster uploads are notoriously messy. Without row-level validation (`roster_import_errors`), Institution Admins will struggle to onboard voters, leading to a high support burden and frustrated users.
- **Candidate Photos**: Text-only ballots lack the engagement and recognizability needed for student elections. Secure, signed-access candidate photos significantly improve the voter experience.

## Out of Scope (Won't Tier)

The following items are explicitly deferred from this sprint to maintain focus on the core voting flows and security:
- **Email notifications beyond auth OTP**: The system will not send automated emails for nominations, approvals, or election reminders.
- **Analytics**: Deep voter behavior analytics or advanced turnout tracking.
- **Audit log UI**: While the database records `created_at` and `approved_by` timestamps, we will not build a user-facing audit log UI for admins.
- **Custom design system / visual polish pass**: The frontend will remain minimal and functional, using default Tailwind utility classes without a polished bespoke design.
