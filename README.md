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

### SACCO Savings Group workspace

The SACCO workspace now includes company-scoped member account codes, configurable savings terms and reconciliation schedules, pending savings submissions, chairperson review, a withdrawal-request queue, and separate payment recording. Pending savings do not affect confirmed balances; approved withdrawals reduce savings only when an actual payment is recorded. Financial review/payment actions are performed through role-checked database RPCs, and SACCO tables use RLS plus composite tenant foreign keys.

The onboarding catalogue contains 50 active business profile categories. SACCO, savings-circle and village-savings workflows are consolidated into the single **SACCO Savings Group** profile; the retired savings-circle folder only redirects to that workspace. The independent professional profile is included as a non-SACCO category.

The separate welfare-fund ledger and request review/payment workflow now have dedicated tables, row-level security policies and role-checked transactional RPCs in `supabase/migrations/20261016120000_sacco_welfare_fund.sql`. Apply that migration to the linked Supabase project before using the welfare screen. The full member self-service portal, automated email/SMS notifications, online payment verification, loan accounting and election workflows remain follow-up work.

## Supabase project and security

The app connects to project reference `rcubnewrfieqhwcnvrzs`. The public browser configuration contains a Supabase publishable key only. **Never place a service-role key or other server secret in frontend code.**

Supabase RLS is enabled on the application's public tables. Invitation creation/acceptance and company creation use database functions with validation and controlled privileges. Review Supabase Security Advisor findings periodically, especially after schema or policy changes.

Email confirmation behavior depends on Supabase Auth settings. If email confirmation is enabled, a new user must confirm their email before signing in. Password reset depends on the project's configured email delivery and redirect URLs.

## Important limitations

- Team invitation links are generated in the app, but automatic email delivery is not configured.
- Website package payments use Jjuma Pay with server-side transaction verification. The first 50% starts the website build; the final 50% is requested after the AI-generated draft is ready. The live URL is published and released only after the final payment is verified.
- Sales orders support line items and stock deduction for confirmed, paid, and partially paid orders. Stock changes and stock movements are transactional and audited; purchase movements update quantity and record an expense. Returns and adjustments are recorded in the stock ledger. Full double-entry accounting, tax reporting, and bank reconciliation remain separate future work.
- Finance entries are management records, not a full accounting package and not connected to bank feeds.
- The app provides a general business-management foundation, not a complete school information system or full enterprise resource-planning suite.
- GitHub Actions confirms build/deployment and static checks. Full browser-based end-to-end testing of sign-up, login, workspace creation, permissions, and each workflow is still required before treating all features as production-verified.

## Local development

Serve this folder with a static HTTP server, or use GitHub Pages. The app loads Supabase JavaScript v2 from its CDN.

## Molano AI Business — Gold plan benefit

The Gold subscription is marketed as including Molano AI Business for AI-assisted business management. This benefit is highlighted in the public onboarding/pricing screen and in the in-workspace Subscription plans & upgrades page. Gold is a 3-month package; Silver is 2 months; Premium is 1 month. The marketing UI does not itself grant AI access. Before treating this as fully operational, wire and verify a server-side Gold entitlement against the verified subscription record, enforce it in the workspace AI entry point, and confirm the JJuma Pay checkout/webhook activation flow end-to-end. Do not grant access based only on browser state or a return URL.

## Subscription plan schedule and billing status

The customer-facing plan durations are **Gold — 3 months**, **Silver — 2 months**, and **Premium — 1 month**. The displayed amount is the full package fee, due again when the selected period ends: Gold renews every 3 months, Silver every 2 months, and Premium every month.

Current regional package prices:
- **Uganda (UGX):** Gold 100,000; Silver 70,000; Premium 30,000.
- **Kenya (KES):** Gold 90,000; Silver 80,000; Premium 70,000.
- **Tanzania (TZS):** Gold 140,000; Silver 120,000; Premium 90,000.
- **Other African countries (USD):** Gold $80; Silver $50; Premium $40.
- **Europe (EUR default):** Gold €100; Silver €50; Premium €30.
- **Asia (USD):** Gold $80; Silver $70; Premium $50.
- **America (USD):** Gold $100; Silver $60; Premium $50.
- **Unspecified markets (USD default):** Gold $80; Silver $50; Premium $40.

The subscription catalog stores full package totals separately from the monthly equivalent. The page can request browser location permission and use a reverse-geocoding service to suggest a country/region; users can choose a market manually. Payment-provider checkout remains disabled until the payment integration is configured. Verified payment activation has to match the exact approved package total. Automatic access locking on expiry and scheduled renewal reminders still require end-to-end implementation.


## Staff chat, meetings and governance
- The sidebar includes Team chat & meetings and a Notification Center. Messages support reactions; authorized managers can assign tasks; authorized staff can publish Zoom, Google Meet, Microsoft Teams or other meeting links. Molan Business shares the links but does not host the video calls.
- Unread notification cards are highlighted per user and can be marked read. Messages, task assignments, meetings and published board outcomes can create notifications.
- The business owner can create a Board of Governors, record confidential meetings, decisions and ideas, and publish selected outcomes to staff notifications. Confidential records remain restricted by database row-level security. Board members need to be linked to their authenticated staff account to receive confidential in-app access.
- This general Board of Governors workflow is intentionally excluded from SACCO Savings Group profiles, which keep their dedicated member/governance workflows.
- Validation note: the collaboration schema and RLS policies have been applied to Supabase. Verify role access, notification visibility, and meeting link behavior with test owner, manager, staff and board accounts before production use.


### Workspace privacy lock

Workspace settings include a device-local passcode/password lock and optional platform fingerprint/face unlock through WebAuthn when supported by the browser and device. The lock is scoped to the signed-in user and active business on that device and prompts again after a browser/app restart. It is a privacy gate only; it does not replace Supabase Auth, RLS or server-side authorization. Clearing browser storage removes the local lock, so sensitive data must remain protected by database policies.


## Expanded business profile catalogue

The central registry now contains **550 business profile types**: the original 50 active profile configurations plus 500 additional industry-specific profiles. The extra profiles each define their own eight-feature map in `business-profiles/extended-catalog.json`; their cards and feature pages use the shared Molan Business workspace modules, scoped to the selected business workspace. The guided onboarding business-type field includes a search box that filters the dropdown, and the catalogue page supports searching and category filtering. The additional profiles are configuration-backed templates rather than 500 separately duplicated application runtimes.


## Automated website service delivery

- After a verified first 50% payment, `molan-jjuma-payments` calls the `website-service-builder` Supabase Edge Function.
- Molano AI generates a single-file responsive HTML website from the submitted business brief, style, public information, contact details and requested features.
- Generated HTML is stored in the private `website-service-builds` bucket while the request waits for the final 50% payment.
- Customers see progress in Website services and on the payment return page. They may keep the page open for live progress or return later; the request remains saved.
- After verified final payment, the builder publishes the HTML to `website-service-deliveries` and records the live URL on the request. The customer-facing UI hides delivery links until `payment_status = paid`.
- Build status and progress are stored in `website_service_build_jobs`; private artifact pointers are stored in service-role-only `website_service_build_artifacts`.
- If the Molano AI build endpoint or publication step is unavailable, the request remains recorded and the customer or authorized ZakiTech staff can retry without paying again for the same stage.
