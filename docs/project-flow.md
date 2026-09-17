# End-to-End Project Flow

This diagram shows the complete user journey and the shared backend boundaries for
every user archetype in the platform:

- **Visitor / new institution owner**: signs in and creates an institution.
- **Platform Admin**: monitors aggregate platform metrics without seeing tenant PII
  or individual ballots.
- **Institution Admin**: manages the institution roster, department admins,
  elections, candidates, and closed-election reports.
- **Department Admin**: manages elections and candidate approvals for one
  department.
- **Voter**: claims roster eligibility, views matching elections, self-nominates,
  and casts one ballot per election.

```mermaid
flowchart TB
    %% -------------------- Shared entry and authentication --------------------
    VISITOR([Visitor / new institution owner])
    LOGIN[Open web app]
    AUTH{Authenticated?}
    OTP[Enter email and request OTP / magic link]
    SUPABASE_AUTH[(Supabase Auth)]
    CALLBACK[Magic-link callback creates authenticated session]
    PROFILE[Load profile from profiles]
    ROLE{Profile role}

    VISITOR --> LOGIN --> AUTH
    AUTH -- No --> OTP --> SUPABASE_AUTH
    SUPABASE_AUTH --> CALLBACK --> PROFILE
    AUTH -- Yes --> PROFILE
    PROFILE --> ROLE

    %% -------------------- Self-serve institution onboarding --------------------
    SIGNUP[Register institution: name + slug]
    CREATE_RPC{{create_institution_and_admin()}}
    INSTITUTION[(institutions)]
    ADMIN_PROFILE[(profiles: institution_admin)]
    SIGNUP --> CREATE_RPC
    CREATE_RPC --> INSTITUTION
    CREATE_RPC --> ADMIN_PROFILE
    ADMIN_PROFILE --> INST_ADMIN

    %% -------------------- Role entry points --------------------
    ROLE -- No profile / new user --> CLAIM_CHOICE{Choose institution}
    CLAIM_CHOICE --> CLAIM_RPC{{claim_voter_profile()}}
    CLAIM_RPC --> ROSTER_MATCH{Email found in roster?}
    ROSTER_MATCH -- No --> CLAIM_ERROR[Show roster eligibility error]
    ROSTER_MATCH -- Yes --> VOTER_PROFILE[(profiles: voter)]
    VOTER_PROFILE --> VOTER

    ROLE -- platform_admin --> PLATFORM
    ROLE -- institution_admin --> INST_ADMIN
    ROLE -- department_admin --> DEPT_ADMIN
    ROLE -- voter --> VOTER

    %% -------------------- Institution administrator lane --------------------
    subgraph IA[Institution Admin]
        INST_ADMIN[Institution Admin dashboard]
        IA_ROSTER[Upload roster CSV]
        IA_VALIDATE[Validate rows in roster-csv-validate Edge Function]
        IA_ERRORS[Review invalid-row errors]
        IA_INVITE[Invite Department Admin]
        IA_CREATE[Create institution-wide or scoped election]
        IA_LIFECYCLE[Manage election lifecycle:<br/>draft → nomination_open → voting_open → closed]
        IA_APPROVE[Approve or reject pending candidates]
        IA_REPORT[Open closed-election audit report]

        INST_ADMIN --> IA_ROSTER --> IA_VALIDATE
        IA_VALIDATE -- Invalid rows --> IA_ERRORS
        IA_VALIDATE -- Valid rows --> ROSTER
        INST_ADMIN --> IA_INVITE
        INST_ADMIN --> IA_CREATE --> IA_LIFECYCLE
        INST_ADMIN --> IA_APPROVE
        IA_LIFECYCLE -- closed --> IA_REPORT
    end

    %% -------------------- Department administrator lane --------------------
    subgraph DA[Department Admin]
        DEPT_ADMIN[Department Admin dashboard]
        DA_CREATE[Create department-scoped election]
        DA_ELECTIONS[View own-department elections]
        DA_APPROVE[Approve or reject candidates<br/>for own department]

        DEPT_ADMIN --> DA_CREATE --> DA_ELECTIONS
        DEPT_ADMIN --> DA_APPROVE
    end

    %% -------------------- Platform administrator lane --------------------
    subgraph PA[Platform Admin]
        PLATFORM[Platform Admin dashboard]
        PA_METRICS[Request aggregate platform metrics]
        METRICS_RPC{{get_platform_metrics()}}
        PA_VIEW[View tenant, election, vote,<br/>and active-election aggregates]

        PLATFORM --> PA_METRICS --> METRICS_RPC --> PA_VIEW
    end

    %% -------------------- Voter lane --------------------
    subgraph V[Voter]
        VOTER[Voter dashboard]
        ELIGIBLE[Load elections matching<br/>institution + department + year]
        ELECTIONS{Election available?}
        NOMINATION{nomination_open?}
        NOMINATE[Submit self-nomination,<br/>manifesto, and optional photo]
        PHOTO[Upload candidate photo]
        CANDIDATE_REVIEW[Wait for admin approval]
        BALLOT[View approved candidates]
        VOTE_WINDOW{voting_open and eligible?}
        CAST[Submit ballot]
        DUPLICATE{Already voted in election?}
        VOTE_SUCCESS[Vote recorded]
        VOTE_ERROR[Reject vote:<br/>closed/ineligible/duplicate]
        RESULTS_LOCKED[Results hidden while election is open]
        RESULTS_VISIBLE[Results available after close]

        VOTER --> ELIGIBLE --> ELECTIONS
        ELECTIONS -- No --> VOTER
        ELECTIONS -- Yes --> NOMINATION
        NOMINATION -- Yes --> NOMINATE
        NOMINATE --> PHOTO --> CANDIDATE_REVIEW
        NOMINATION -- No --> BALLOT
        CANDIDATE_REVIEW --> BALLOT
        BALLOT --> VOTE_WINDOW
        VOTE_WINDOW -- No --> RESULTS_LOCKED
        VOTE_WINDOW -- Yes --> CAST --> DUPLICATE
        DUPLICATE -- Yes --> VOTE_ERROR
        DUPLICATE -- No --> VOTE_SUCCESS
        VOTE_SUCCESS --> RESULTS_LOCKED
        RESULTS_LOCKED -- Election closes --> RESULTS_VISIBLE
    end

    %% -------------------- Shared data and enforcement boundary --------------------
    subgraph BACKEND[Shared Supabase backend and enforcement]
        ROSTER[(roster:<br/>authoritative eligibility)]
        ROSTER_ERRORS[(roster_import_errors)]
        ELECTIONS_DB[(elections)]
        CANDIDATES[(candidates)]
        VOTES[(votes)]
        STORAGE[(Supabase Storage:<br/>candidate-photos)]
        RLS[[PostgreSQL RLS policies]]
        UNIQUE[[UNIQUE(voter_id, election_id)]]
        RESULTS_RPC{{get_election_results()}}
        REPORT[Aggregate tally only;<br/>raw vote rows remain private]
    end

    %% Admin writes
    IA_VALIDATE --> ROSTER_ERRORS
    IA_CREATE --> ELECTIONS_DB
    IA_LIFECYCLE --> ELECTIONS_DB
    DA_CREATE --> ELECTIONS_DB
    IA_APPROVE --> CANDIDATES
    DA_APPROVE --> CANDIDATES
    IA_INVITE --> ADMIN_PROFILE

    %% Voter reads and writes
    ROSTER --> CLAIM_RPC
    ELIGIBLE --> RLS --> ELECTIONS_DB
    NOMINATE --> RLS --> CANDIDATES
    PHOTO --> STORAGE
    CAST --> RLS
    RLS --> VOTES
    VOTES --> UNIQUE
    UNIQUE -- Duplicate --> VOTE_ERROR
    ELECTIONS_DB --> VOTE_WINDOW
    CANDIDATES --> BALLOT
    ELECTIONS_DB --> RESULTS_RPC
    VOTES --> RESULTS_RPC
    RESULTS_RPC --> REPORT
    REPORT --> RESULTS_VISIBLE

    %% Platform aggregate boundary
    INSTITUTION --> METRICS_RPC
    ELECTIONS_DB --> METRICS_RPC
    VOTES --> METRICS_RPC

    %% Styling
    classDef user fill:#111827,stroke:#9ca3af,color:#fff
    classDef admin fill:#172554,stroke:#60a5fa,color:#fff
    classDef voter fill:#064e3b,stroke:#34d399,color:#fff
    classDef data fill:#3f3f46,stroke:#d4d4d8,color:#fff
    classDef security fill:#581c87,stroke:#c084fc,color:#fff
    classDef decision fill:#78350f,stroke:#fbbf24,color:#fff

    class VISITOR,LOGIN,OTP,CALLBACK,PROFILE user
    class INST_ADMIN,IA_ROSTER,IA_VALIDATE,IA_ERRORS,IA_INVITE,IA_CREATE,IA_LIFECYCLE,IA_APPROVE,IA_REPORT,DEPT_ADMIN,DA_CREATE,DA_ELECTIONS,DA_APPROVE,PLATFORM,PA_METRICS,PA_VIEW admin
    class VOTER,ELIGIBLE,NOMINATE,PHOTO,CANDIDATE_REVIEW,BALLOT,CAST,VOTE_SUCCESS,RESULTS_LOCKED,RESULTS_VISIBLE voter
    class INSTITUTION,ADMIN_PROFILE,VOTER_PROFILE,ROSTER,ROSTER_ERRORS,ELECTIONS_DB,CANDIDATES,VOTES,STORAGE,REPORT data
    class CREATE_RPC,CLAIM_RPC,METRICS_RPC,RESULTS_RPC,RLS,UNIQUE security
    class AUTH,ROLE,CLAIM_CHOICE,ROSTER_MATCH,ELECTIONS,NOMINATION,VOTE_WINDOW,DUPLICATE decision
```

## Security boundaries shown in the flow

1. **Tenant isolation**: RLS checks `institution_id` on roster, elections,
   candidates, and votes.
2. **Voter eligibility**: `claim_voter_profile()` matches the authenticated email
   to the institution roster before creating the voter profile.
3. **Election scoping**: voters see and can vote only in elections matching their
   institution, department, and year.
4. **Candidate governance**: nominations are pending until the appropriate
   Institution Admin or Department Admin approves them.
5. **Single vote**: RLS requires an open, eligible election and the database
   constraint `UNIQUE(voter_id, election_id)` rejects duplicates.
6. **Result confidentiality**: `get_election_results()` returns aggregate counts,
   and voter results remain locked until the election is closed.
7. **Platform oversight**: `get_platform_metrics()` returns aggregate metrics only;
   Platform Admins do not receive roster PII or raw ballots.
