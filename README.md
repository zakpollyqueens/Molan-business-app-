# Molan Business

Molan Business is a responsive, Supabase-backed workspace for small businesses and teams. The production frontend is published with GitHub Pages.

## Open the application

- Live app: https://zakpollyqueens.github.io/Molan-business-app-/
- Source repository: https://github.com/zakpollyqueens/Molan-business-app-

New visitors are connected automatically to the configured Supabase project. The browser uses only the project's **publishable** key; access to company data must be enforced by Supabase Row Level Security (RLS). Existing local browser configuration is retained for users who deliberately configured a different project.

## Current functionality

- Email/password sign-up and sign-in, password-reset requests, persistent browser sessions, and explicit sign-out
- Company workspace creation and business onboarding with 30 business-category choices and an optional existing website
- Multi-business workspace switcher for users who belong to more than one company
- Business profile editor with contact details, branding, cover image, and a Supabase Storage photo gallery for premises, staff, vehicles, products, and projects
- Role-based company membership, departments, invitation links, and invitation acceptance
- Overview dashboard and management for tasks, products, announcements, team visibility, and audit events
- Customer records, inventory records, itemized sales orders, manual finance transactions, and a stock movement ledger for purchases, adjustments, returns, and purchase-expense posting
- Transactional stock deduction for confirmed/paid/part-paid orders, with server-side quantity and tenant validation; draft orders do not deduct stock
- Attendance records, management reports, and Staff Council meetings, agendas, minutes, and decisions
- ZakiTech website service requests and installment records
- Server-side enforcement of website package prices: Starter UGX 200,000; Business UGX 300,000; Premium UGX 450,000
- Responsive desktop and mobile hamburger navigation, display preferences, and category-based workstation shortcuts
- A category-aware industry workspace with an expanded module dashboard, plus an extended Business Tools page for appointments, procurement, maintenance, projects, customer follow-up, events, quality checks, equipment servicing, cases, programmes, returns, stock corrections and field/logistics work
- Category-specific operation templates for education, healthcare, retail/wholesale/manufacturing, agriculture, transport/logistics, construction/real estate, hospitality, professional services, NGOs, faith/community groups and general businesses
- A Website & Media Studio where owners/admins upload multiple business images from their account, copy public image URLs, reuse images as the company logo or cover, and manage the gallery; separately hosted websites still need a site integration to publish those assets automatically
- GitHub Actions frontend syntax and module smoke checks, plus automated GitHub Pages deployment

### SACCO and savings-circle workspace

The SACCO workspace now includes company-scoped member account codes, configurable savings terms and reconciliation schedules, pending savings submissions, chairperson review, a withdrawal-request queue, and separate payment recording. Pending savings do not affect confirmed balances; approved withdrawals reduce savings only when an actual payment is recorded. Financial review/payment actions are performed through role-checked database RPCs, and SACCO tables use RLS plus composite tenant foreign keys.

The onboarding catalogue includes 50 specific business profile categories, including SACCOs, savings circles, cooperatives, retail and service businesses.

The current first implementation phase does not yet include the full member self-service portal, welfare fund/loan accounting, automated email/SMS notifications, online payment verification, or election workflows; these remain follow-up work before describing the full SACCO system as complete.

## Supabase project and security

The app connects to project reference `rcubnewrfieqhwcnvrzs`. The public browser configuration contains a Supabase publishable key only. **Never place a service-role key or other server secret in frontend code.**

Supabase RLS is enabled on the application's public tables. Invitation creation/acceptance and company creation use database functions with validation and controlled privileges. Review Supabase Security Advisor findings periodically, especially after schema or policy changes.

Email confirmation behavior depends on Supabase Auth settings. If email confirmation is enabled, a new user must confirm their email before signing in. Password reset depends on the project's configured email delivery and redirect URLs.

## Important limitations

- Team invitation links are generated in the app, but automatic email delivery is not configured.
- Website-service payments are recorded for manual review; there is no automated Mobile Money/bank payment gateway or automatic payment verification.
- Sales orders support line items and stock deduction for confirmed, paid, and partially paid orders. Stock changes and stock movements are transactional and audited; purchase movements update quantity and record an expense. Returns and adjustments are recorded in the stock ledger. Full double-entry accounting, tax reporting, and bank reconciliation remain separate future work.
- Finance entries are management records, not a full accounting package and not connected to bank feeds.
- The app provides a general business-management foundation, not a complete school information system or full enterprise resource-planning suite.
- GitHub Actions confirms build/deployment and static checks. Full browser-based end-to-end testing of sign-up, login, workspace creation, permissions, and each workflow is still required before treating all features as production-verified.

## Local development

Serve this folder with a static HTTP server, or use GitHub Pages. The app loads Supabase JavaScript v2 from its CDN.
