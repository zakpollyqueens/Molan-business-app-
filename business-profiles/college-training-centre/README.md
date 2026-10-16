# College / training centre — Molan Business

Profile `college-training-centre`; overview `index.html`; configuration `profile.json`; feature manifest `features.json`; page directory `pages/index.html`.

## Declared feature pages

- [Classes & learners](pages/feature-classes-learners/index.html) — route `operations`; backend integration must be verified.
- [Attendance](pages/feature-attendance/index.html) — route `attendance`; backend integration must be verified.
- [Fees & finance](pages/feature-fees-finance/index.html) — route `finance`; backend integration must be verified.
- [Savings & SACCO](pages/feature-savings-sacco/index.html) — route `sacco`; backend integration must be verified.
- [Tasks & deadlines](pages/feature-tasks-deadlines/index.html) — route `tasks`; backend integration must be verified.
- [Customers / members](pages/feature-customers-members/index.html) — route `customers`; backend integration must be verified.
- [Reports & insights](pages/feature-reports-insights/index.html) — route `reports`; backend integration must be verified.
- [Team & permissions](pages/feature-team-permissions/index.html) — route `team`; backend integration must be verified.
- [Announcements](pages/feature-announcements/index.html) — route `announcements`; backend integration must be verified.

Security: use authenticated shared services and server-enforced tenant/role permissions. Never expose service-role credentials in browser code. Scaffolding does not prove CRUD completion.
