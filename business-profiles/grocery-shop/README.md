# Grocery shop profile module

**Slug:** `grocery-shop`  
**Status:** Page scaffold created; backend/domain completion is not yet certified.

## Files
- `profile.json` — profile identity and existing app shortcut catalogue.
- `index.html` — dedicated page layout and visible feature buttons for this business.
- `profile.js` — profile-specific button handling and shared-runtime bridge contract.
- `profile.css` — responsive and dark-mode styles for this profile page.
- `features.json` — declared feature areas and destination routes.

## Feature areas
1. Stock & reorder levels → `inventory` (route mapped; domain backend verification pending)
2. Supplier purchases → `inventory` (route mapped; domain backend verification pending)
3. Daily sales → `sales` (route mapped; domain backend verification pending)
4. Expiry and wastage log → `business-tools` (route mapped; domain backend verification pending)
5. Cash reconciliation → `finance` (route mapped; domain backend verification pending)
6. Customer accounts → `customers` (route mapped; domain backend verification pending)

## Backend integration status
The page refuses to report success when the shared application runtime is absent. Each feature still requires verification that its destination performs the correct business-specific operations, checks the active company and role, and is protected by Supabase RLS. Do not treat a mapped generic route as a fully implemented specialist workflow.

## Shared responsibilities
Authentication, session lifecycle, Supabase client setup, tenant authorization, common notifications, and navigation remain in the root application. This folder owns the business-specific page structure and interactions.
