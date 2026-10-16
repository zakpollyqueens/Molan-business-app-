# Bar / beverage shop — Molan Business

- **Profile slug:** `bar-beverage-shop`
- **Overview:** `index.html`
- **Configuration:** `profile.json`
- **Feature manifest:** `features.json`
- **Profile script/style:** `profile.js`, `profile.css`
- **Feature index:** `pages/index.html`

## Declared feature pages

- [Bookings & service work](pages/feature-bookings-service-work/index.html) — route `business-tools`; backend status: runtime integration must be verified.
- [Ingredients & supplies](pages/feature-ingredients-supplies/index.html) — route `inventory`; backend status: runtime integration must be verified.
- [Orders & sales](pages/feature-orders-sales/index.html) — route `sales`; backend status: runtime integration must be verified.
- [Tasks & deadlines](pages/feature-tasks-deadlines/index.html) — route `tasks`; backend status: runtime integration must be verified.
- [Customers / members](pages/feature-customers-members/index.html) — route `customers`; backend status: runtime integration must be verified.
- [Operations register](pages/feature-operations-register/index.html) — route `operations`; backend status: runtime integration must be verified.
- [Finance & expenses](pages/feature-finance-expenses/index.html) — route `finance`; backend status: runtime integration must be verified.
- [Reports & insights](pages/feature-reports-insights/index.html) — route `reports`; backend status: runtime integration must be verified.
- [Team & permissions](pages/feature-team-permissions/index.html) — route `team`; backend status: runtime integration must be verified.
- [Announcements](pages/feature-announcements/index.html) — route `announcements`; backend status: runtime integration must be verified.

## Security and completion

The profile must not initialize a privileged Supabase client or contain service-role credentials. Data access must use the authenticated Molan Business runtime and server-enforced tenant/role permissions. A route or scaffold is not proof that CRUD operations are complete; verify loading, empty, validation, error, success and authorization states against the real backend before release.
