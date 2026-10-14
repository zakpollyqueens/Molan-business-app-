# Molan Business

Molan Business is a responsive company workspace frontend backed by Supabase.

## Implemented
- Email/password sign-up and sign-in, password-reset requests, and persistent browser sessions
- Company workspace creation through an authenticated database function
- Company, member, department, task, product, announcement, and audit-event database tables
- Row-level security policies for company membership and role-based access
- Automatic user-profile creation after Supabase Auth signup
- Overview dashboard with task, product, and team metrics
- Task creation, assignment, priority, due dates, status filters, and search
- Product hub for applications, websites, and services
- Company announcements
- Team and role visibility
- Responsive desktop and mobile navigation
- Database indexes for frequently queried foreign-key columns
- JavaScript syntax validation in GitHub Actions

## Supabase setup
The connected Supabase project reference is `rcubnewrfieqhwcnvrzs`.

On first launch, enter the project URL and a **publishable** key in the setup screen. The configuration is stored in the current browser's local storage. Never put a service-role or secret key into client-side code.

Email confirmation behavior depends on the project's Supabase Auth settings. If confirmation is enabled, a new user must confirm their email before signing in.

## Run locally
Serve this folder with any static HTTP server, or publish it using a static host. The app uses the Supabase JavaScript v2 CDN library.

## Next development phases
- Team invitation and member administration
- Department editing and deletion
- Editing and deletion with audit history
- Finance, inventory, customers, sales, and reporting modules
- Browser-level end-to-end tests
- Production deployment and domain configuration

## Important
The initial frontend and database foundation have been committed, but this README does not claim the application has passed full end-to-end testing or has been published to a live hosting URL.


## Expanded business modules
- Team invitations use expiring, one-time links; the invited person must sign in with the invited email. Email delivery is not configured, so the workspace admin shares the generated link.
- Customer records and inventory items with stock quantity, reorder level, unit cost, and selling price.
- Sales order records and high-level order/payment totals. The current sales form records order totals; line-item entry and automatic stock deduction remain future work.
- Finance income/expense entries and simple totals. These are manual management records and are not connected to a bank or payment processor.
- Database RLS policies are enabled for the added tables. Role-specific financial restrictions and granular department-level data access need additional review before handling sensitive live finance data.
- Invitation token acceptance checks the authenticated account email and token expiry; the token is stored hashed in the database.


## Onboarding, school operations and website services
- Company onboarding captures a business profile category (30 options) and an existing website URL.
- Attendance records, management reports and Staff Council meeting/minutes records are available as workspace modules.
- Website service requests route to ZakiTech with package prices enforced in the database: Starter UGX 200,000; Business UGX 300,000; Premium UGX 450,000.
- Website payments support installment records and remain pending until an authorized owner/admin checks the payment reference and marks them verified. No mobile-money gateway or automated payment verification is connected yet.
- GitHub Pages deployment workflow is included. Repository Pages settings may need to be set to use **GitHub Actions** before the first deployment can succeed.
- These modules are an extensible business-management foundation; they are not yet a full school information system, full accounting package, payment gateway, or automated stock-deduction sales system.
