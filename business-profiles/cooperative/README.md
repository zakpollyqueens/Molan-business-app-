# Cooperative — Molan Business

Profile `cooperative`; overview `index.html`; configuration `profile.json`; feature manifest `features.json`; page directory `pages/index.html`.

## Declared feature pages

- [Savings & member accounts](pages/feature-savings-member-accounts/index.html) — route `sacco`; backend integration must be verified.
- [Finance ledger](pages/feature-finance-ledger/index.html) — route `finance`; backend integration must be verified.
- [Members](pages/feature-members/index.html) — route `customers`; backend integration must be verified.
- [Reports](pages/feature-reports/index.html) — route `reports`; backend integration must be verified.
- [Tasks & deadlines](pages/feature-tasks-deadlines/index.html) — route `tasks`; backend integration must be verified.
- [Operations register](pages/feature-operations-register/index.html) — route `operations`; backend integration must be verified.
- [Team & permissions](pages/feature-team-permissions/index.html) — route `team`; backend integration must be verified.
- [Announcements](pages/feature-announcements/index.html) — route `announcements`; backend integration must be verified.

Security: use authenticated shared services and server-enforced tenant/role permissions. Never expose service-role credentials in browser code. Scaffolding does not prove CRUD completion.
