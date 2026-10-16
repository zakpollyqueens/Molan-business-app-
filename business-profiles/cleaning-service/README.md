# Cleaning service — Molan Business

Profile: `cleaning-service` · Overview: `index.html` · Config: `profile.json` · Manifest: `features.json` · Feature directory: `pages/index.html`.

## Features

- [Appointments & service delivery](pages/feature-appointments-service-delivery/index.html) — route `business-tools`; verify backend integration before release.
- [Projects & operations](pages/feature-projects-operations/index.html) — route `operations`; verify backend integration before release.
- [Website & media](pages/feature-website-media/index.html) — route `website-studio`; verify backend integration before release.
- [Tasks & deadlines](pages/feature-tasks-deadlines/index.html) — route `tasks`; verify backend integration before release.
- [Customers / members](pages/feature-customers-members/index.html) — route `customers`; verify backend integration before release.
- [Finance & expenses](pages/feature-finance-expenses/index.html) — route `finance`; verify backend integration before release.
- [Reports & insights](pages/feature-reports-insights/index.html) — route `reports`; verify backend integration before release.
- [Team & permissions](pages/feature-team-permissions/index.html) — route `team`; verify backend integration before release.
- [Announcements](pages/feature-announcements/index.html) — route `announcements`; verify backend integration before release.

All data access must use authenticated shared services and server-enforced tenant/role permissions. Never place service-role credentials in browser code. A route scaffold is not proof of completed CRUD workflows.
