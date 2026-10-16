# Shared Molan Business platform

This folder contains code used by the authenticated shell and every current or future business profile. Keep authentication, session persistence, global routing, upgrade checks, shared permissions, common UI tokens, and cross-profile services here or in the root shell—not duplicated inside individual profile folders.

## Shared components
- `platform-config.js`: central paths and platform identity.
- `navigation.js`: shared route/shortcut helper.
- `profile-runtime.js`: validates profile slugs and loads registered profile configurations.
- `upgrade-manager.js`: checks the root `version.json`, adds a **Check for updates** button, and offers a reload when a newer release is available.
- `platform.css`: shared upgrade banner and platform UI styling.

## Main app owns
- Supabase client initialization and publishable-key configuration.
- Authentication, sign-in/sign-up, session restoration, sign-out, and workspace membership.
- Main navigation shell, route permissions, global settings, data refresh, and upgrade system.
- Cross-profile database/service connections and shared components.

## Each business profile owns
- Its own `profile.json`, pages, feature-specific JavaScript, styles, assets, and specialist workflows.
- Its profile-specific UI and domain rules, while calling shared services rather than duplicating auth, upgrade, or shell code.

## Adding a profile
1. Create `business-profiles/<slug>/profile.json` and its profile page/module files.
2. Add the matching slug and display metadata to `business-profiles/registry.json`.
3. Ensure all declared routes resolve through the main authenticated shell.
4. Run the repository validation and navigation smoke checks before release.

## Upgrade behavior
The browser checks the root `version.json` without cache and exposes a manual check plus a banner when a different release version is detected. The update action reloads the deployed app; it does not modify Supabase records or bypass authentication. Publish a new unique `version` value with each deployed release.
