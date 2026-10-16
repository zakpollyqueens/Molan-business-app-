# Retail shop profile module

**Slug:** `retail-shop`  
**Status:** Page scaffold created; backend/domain completion is not yet certified.

## Files
- `profile.json` — profile identity and existing app shortcut catalogue.
- `index.html` — dedicated page layout and visible feature buttons for this business.
- `profile.js` — profile-specific button handling and shared-runtime bridge contract.
- `profile.css` — responsive and dark-mode styles for this profile page.
- `features.json` — declared feature areas and destination routes.

## Feature areas
1. Product catalogue → `products` (route mapped; domain backend verification pending)
2. Stock & pricing → `inventory` (route mapped; domain backend verification pending)
3. Sales register → `sales` (route mapped; domain backend verification pending)
4. Returns & exchanges → `business-tools` (route mapped; domain backend verification pending)
5. Customer accounts → `customers` (route mapped; domain backend verification pending)
6. Daily cash-up → `business-tools` (route mapped; domain backend verification pending)

## Backend integration status
The page refuses to report success when the shared application runtime is absent. Each feature still requires verification that its destination performs the correct business-specific operations, checks the active company and role, and is protected by Supabase RLS. Do not treat a mapped generic route as a fully implemented specialist workflow.

## Shared responsibilities
Authentication, session lifecycle, Supabase client setup, tenant authorization, common notifications, and navigation remain in the root application. This folder owns the business-specific page structure and interactions.
