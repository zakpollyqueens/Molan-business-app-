# Shared Molan Business platform

The main application owns Supabase authentication/session persistence, global navigation, shared services, permissions integration, common UI, and the central upgrade system. Profile folders own domain-specific pages, feature scripts, styles, assets, and workflows. UI permission helpers never replace Supabase Row Level Security.

## Shared files
- `platform-config.js`: central app paths and configuration.
- `navigation.js`: shared route/shortcut helper.
- `profile-runtime.js`: validates registered profile identifiers and loads profile configs.
- `permissions.js`: reusable UI role helpers.
- `upgrade-manager.js`: root release-manifest checker and update notification.
- `platform.css`: shared upgrade banner styling.

## Adding a profile
Create its folder, `profile.json`, page/module files, then add its slug and metadata to `business-profiles/registry.json`. Connect all declared routes to the authenticated app shell and run validation before release.

## Upgrades
Publish a new unique version in root `version.json` with each deployment. The browser checks without cache, displays an update prompt when a different version is detected, and reloads only after the user chooses Update now. It does not modify business records or bypass authentication.
