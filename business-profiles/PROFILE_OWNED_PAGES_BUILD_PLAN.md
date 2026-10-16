# Profile-owned pages architecture and build plan

## Non-negotiable architecture
All 51 business profile folders must own the business-specific user experience—not merely a `profile.json` shortcut catalogue. Each profile folder must contain its own page entry point, page markup, profile-specific JavaScript, profile-specific stylesheet, and a feature manifest that maps its controls to authorized backend operations. The root application keeps only shared infrastructure: authentication/session handling, Supabase client setup, tenant/role authorization helpers, shared data-access primitives, common components, shared CSS tokens, navigation shell, and reusable generic utilities.

## Target folder contract
Each `business-profiles/<slug>/` folder will contain:
- `profile.json`: identity, route, capabilities, and feature metadata.
- `index.html`: the profile's page entry point and its own semantic layout.
- `profile.js`: profile-specific rendering, interactions, form validation, and orchestration.
- `profile.css`: profile-specific responsive layout and visual treatment.
- `features.json`: the explicit inventory of page sections, controls, data entities, and backend actions.
- `README.md`: scope, page map, permissions, backend dependencies, and implementation status.

## Shared files that stay outside profile folders
- `auth.js` / Supabase bootstrap: sign-in, session persistence, sign-out, and client initialization.
- Shared authorization and tenant-safe data access: all company-scoped reads/writes must be filtered and protected by Supabase RLS; no service-role secrets in browser code.
- Shared application shell/router, common components, design tokens and global styles.
- Shared generic utilities only where they are truly reused by multiple profiles.

## Delivery phases
1. **Inventory and contract:** validate all 51 slugs, profile names, unique route IDs, data entities, capability declarations, role requirements, and current backend tables/RPCs. Produce a coverage matrix; flag any feature that has no real backend operation.
2. **Folder-owned page skeletons:** create all profile-owned page entry points, markup, JS, CSS, feature manifests and READMEs. Each page must render its own business-specific sections and buttons; do not treat a route name alone as an implemented feature.
3. **Shared secure bridge:** expose a narrow shared API for auth/session, active company, permissions, safe data access, notifications, and navigation. Profile scripts call this contract rather than duplicating credentials or bypassing RLS.
4. **Backend wiring by domain:** connect each profile's buttons/forms to existing tables/RPCs where those truly fit; add migrations/RPCs only when the domain needs new data or transactional guarantees. Never point unrelated profiles at a generic page and call it complete.
5. **Feature completion:** implement domain-specific workflows and validation, including meaningful empty/loading/error/success states, list/detail/create/edit actions, search/filtering, and reporting where appropriate.
6. **Automated enforcement:** CI must require all 51 folders to contain the complete file contract, validate manifests, check every declared control/action, ensure profile-specific assets are loaded, and fail when a profile references an unimplemented backend action.
7. **Integration and acceptance:** connect profile cards, overview/dashboard, hamburger, and settings to the correct folder-owned page. Test each route, button, permissions, tenant isolation, responsive layouts, and key CRUD workflows. Report completed, partial, and blocked features separately.

## Acceptance criteria
- Exactly 51 profile folders exist and every folder has all six target files.
- Each folder owns its page layout and profile-specific event handlers.
- All visible controls have a defined action and an implemented, permission-checked destination.
- Each backend action has a documented table/RPC mapping and tenant/RLS protection.
- No fake success messages, inert buttons, guessed database columns, or false claims that a generic module is a complete specialist workflow.
- Shared auth/client and general infrastructure remain outside the 51 folders.
- CI validates the folder contract and route/action wiring.
- No changes are deployed to production merely by creating this branch or pull request; changes require review and merge.

## Current baseline / gap
The current profile implementation is configuration-led: folders mainly contain `profile.json` and feature shortcuts that route to shared `app.js` pages. That is useful for the catalogue, but it does **not** meet the requirement that every profile owns its actual pages and interactions. This branch is intended to close that architectural gap incrementally and honestly; a folder or UI scaffold is not considered backend-complete until its actions are wired and tested.

## Implementation update — 2026-10-16
- Added a dedicated `index.html` page to all 51 business-profile folders. Each page reads its own `profile.json`, displays that profile's declared feature buttons, and explicitly reports when the shared authenticated runtime is not connected.
- The main profile workspace now embeds the selected folder-owned page. The parent application supplies a narrow runtime bridge after iframe load.
- The bridge validates the selected profile slug, confirms the requested feature title and route are declared in that profile, and then routes through the main application shell. The existing application still owns authentication, active workspace state, permissions and database access.
- CI now checks that each profile folder has an `index.html`, its `data-profile` identity matches the folder slug, it loads `profile.json`, and it declares runtime bridge integration.
- **Not yet complete:** the 51 pages are currently dedicated page scaffolds and feature entry points. Not every profile has its own fully independent specialist data workflows, and some profile-specific CSS/JS is inline in its `index.html` while early modules split those assets into files. The next build phase must normalize the per-folder asset contract, implement profile-specific CRUD and validations, verify table/RPC mappings and tenant/RLS protections, and test all controls on a real browser/device. Do not call the app backend-complete until those checks pass.
