# Wholesale business profile module

**Slug:** `wholesale-business`  
**Status:** Page scaffold created; backend/domain completion is not yet certified.

## Files
- `profile.json` — profile identity and existing app shortcut catalogue.
- `index.html` — dedicated page layout and visible feature buttons for this business.
- `profile.js` — profile-specific button handling and shared-runtime bridge contract.
- `profile.css` — responsive and dark-mode styles for this profile page.
- `features.json` — declared feature areas and destination routes.

## Feature areas
1. Bulk inventory → `inventory` (route mapped; domain backend verification pending)
2. Customer price lists → `customers` (route mapped; domain backend verification pending)
3. Purchase orders → `sales` (route mapped; domain backend verification pending)
4. Wholesale sales → `sales` (route mapped; domain backend verification pending)
5. Credit customers → `customers` (route mapped; domain backend verification pending)
6. Delivery dispatch → `sales` (route mapped; domain backend verification pending)

## Backend integration status
The page refuses to report success when the shared application runtime is absent. Each feature still requires verification that its destination performs the correct business-specific operations, checks the active company and role, and is protected by Supabase RLS. Do not treat a mapped generic route as a fully implemented specialist workflow.

## Shared responsibilities
Authentication, session lifecycle, Supabase client setup, tenant authorization, common notifications, and navigation remain in the root application. This folder owns the business-specific page structure and interactions.
