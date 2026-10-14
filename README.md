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
- Department management
- Editing and deletion with audit history
- Finance, inventory, customers, sales, and reporting modules
- Browser-level end-to-end tests
- Production deployment and domain configuration

## Important
The initial frontend and database foundation have been committed, but this README does not claim the application has passed full end-to-end testing or has been published to a live hosting URL.
