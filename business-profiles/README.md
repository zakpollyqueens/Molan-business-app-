# Molan Business profiles

The selectable registry contains 1,550 business profiles: 50 core catalogue profiles and 1,500 extended-catalog profiles. Each registered profile owns a dedicated folder with its own profile configuration and feature pages. Some earlier generated specialist folders are retained on disk but are not counted as selectable profiles unless present in the registry. Every profile folder owns a dedicated `index.html` page and its business-specific feature buttons. The page loads that folder's `profile.json` and presents the profile's declared feature areas; when embedded in the authenticated application, buttons use the shared runtime bridge to open approved app routes.

## Folder structure

Each `business-profiles/<slug>/` folder contains:
- `profile.json` — profile identity, description, icon, feature list, and route declarations.
- `index.html` — the profile-owned page layout, summary area, feature buttons, and page styling/interaction code (some early modules also split these into `profile.js` and `profile.css`).
- `README.md` / `features.json` — available in profiles where the detailed module contract has been added; these describe declared features and integration status.

## Shared application files outside the folders

- `app.js` — authenticated application shell, session/company state, route rendering, and the narrow `window.MolanProfileRuntime` bridge.
- `business-profiles.js` — loads the 50 core profile configurations and the extended catalogue into the runtime catalogue.
- `business-profiles.css` — shared styling for profile cards in the main app.
- `auth.js` / shared Supabase bootstrap and tenant-safe data access belong outside the profile folders; credentials, session handling, shared authorization helpers, and generic components must not be duplicated per profile.

## How the pages are connected

The profile overview embeds the selected folder's `index.html`. On iframe load, the app supplies the authenticated runtime bridge. The bridge verifies that the selected profile slug matches the registered profile and that the requested feature title/route is declared by that profile before navigating through the main app shell. The main application continues to enforce workspace state, membership roles, and Supabase RLS.

## Completion status

The folder-owned page is a real UI entry point, but a visible button or route mapping alone does **not** prove that a specialist business workflow is complete. Each feature must still be checked against the correct tables/RPCs, tenant isolation, role permissions, validation, loading/error states, and real CRUD behavior. Any feature still using a generic module must be labelled partial until its domain-specific workflow is implemented and tested.

The generator validates the catalogue and profile-owned pages, commits generated folders directly to `main`, and triggers deployment and smoke checks.


## Extended catalogue folders

Each of the 1,500 entries in `extended-catalog.json` has a dedicated folder containing its own `profile.json`, `index.html`, `profile.js`, `profile.css`, `features.json`, and profile-local `pages/` for its declared features. Feature pages and hamburger navigation are scoped to the selected business profile; shared authentication, workspace authorization, and tenant-safe data access remain in the root application. UI scaffolds and route wiring do not by themselves certify every domain-specific backend workflow as complete.
