# Molan Business profiles

This directory contains the configuration for all 51 supported business profiles. Each folder has one `profile.json` file with the profile's name, description, icon, feature shortcuts, and destination route IDs.

## Architecture

- `<profile-slug>/profile.json` — profile-specific configuration and shortcut destinations.
- `../business-profiles.js` — shared loader; reads all 51 JSON files and publishes the runtime catalogue to `window.MolanBusinessProfiles`.
- `../business-profiles.css` — shared responsive styling for profile cards.
- `../app.js` — the application shell, shared profile overview/settings renderers, route handling, database operations, permissions, and button handlers.
- `../index.html` — loads the shared profile stylesheet and loader before the application script.

Keep shared JavaScript and CSS in the application root so fixes apply consistently across all profiles. Profile-specific changes belong in the matching `profile.json`. Every feature route must match a route rendered in `app.js`; do not add a destination unless the route exists or is implemented in the same change.

The profile loader uses a built-in catalogue as a fallback if an individual JSON file cannot be fetched, so a missing configuration does not prevent the application from opening.
