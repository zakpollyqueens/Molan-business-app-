# Molan Business camera integration strategy

## Security and ownership boundary

A camera is accepted only after the supported integration verifies device/account ownership and confirms that it belongs to the current business workspace. A QR payload, serial number, Bluetooth advertisement, Wi-Fi SSID, or typed device ID is an identifier/setup input, not proof of ownership. Never allow a scanned identifier to bind a camera already claimed by a different company. Device claims should be performed by a trusted provider connector using a one-time challenge and should be unique across companies.

Staff camera viewing is controlled by `company_member_permissions`. `camera.view` permits viewing available live feeds and recording playback; `camera.manage` permits connection setup. Neither grants permission to delete footage. Only an active company member with role `owner` can update/delete recording metadata or delete/update stored recording objects. Trusted server-side integrations should ingest recordings using server credentials; browser users must not be given upload/delete service credentials.

## Connection methods shown in the interface

- **QR code:** parse the manufacturer-issued device identifier or one-time pairing challenge; verify it through a vendor adapter before claiming the device.
- **Bluetooth-assisted setup:** optional commissioning flow for devices that support it. Bluetooth often provisions the camera onto Wi-Fi; it is not a universal video transport.
- **Wi-Fi / local network / NVR:** discovery should run in a trusted local bridge or NVR connector where browser sandbox/network restrictions prevent direct discovery.
- **ONVIF:** use authenticated discovery and capabilities negotiation for compatible IP cameras/NVRs. Profile S covers basic streaming; Profile T covers advanced streaming; Profile G covers supported recording search/retrieval. Verify the exact model and firmware in the ONVIF conformant-products directory.
- **Manufacturer cloud/API:** use a vendor-approved authorization flow and documented APIs, with least-privilege scopes and revocable tokens.
- **Manual device ID:** accept a vendor-issued ID/serial/pairing code, but never treat the ID alone as authentication.

## Capability model

Each adapter should declare capabilities independently: `device_claim`, `live_stream`, `recording_search`, `recording_playback`, `recording_ingest`, `events`, and optional `ptz`. UI controls must be driven by detected capabilities, not merely a brand name. If a capability is unsupported, explain what supported recorder, official cloud service, or secure relay is needed; do not label the camera connected until authenticated.

## Initial adapter targets

1. **ONVIF IP cameras and NVR/DVR systems** — server/local-bridge adapter for discovery and authenticated media services. Profile G is especially relevant for recording retrieval. Raw RTSP URLs and camera passwords must never be stored in the public browser database or exposed to the browser.
2. **Manufacturer cloud/API adapters** — build individually against each vendor's documented auth, live-view, recording-search and playback APIs. Support depends on model, firmware, subscription, region and account permissions.
3. **Recorder/relay adapter** — ingest timestamped segments from compatible NVR/DVR systems or a secured local relay into private storage. The relay must authenticate to the business, preserve the camera's original timestamps/time zone where available, and report offline gaps.
4. **Vendor app commissioning hand-off** — when Bluetooth/Wi-Fi provisioning is only available in the manufacturer's app, guide the owner through that setup and then authorize Molan through a supported API/ONVIF/NVR path. Do not pretend the web page can provision every model itself.

## Recording metadata and playback

Recording rows use `recording_started_at` and `recording_ended_at` as source timestamps and retain source, status and optional retention deadline. Store clips under a private storage path beginning with the business UUID and camera UUID. Generate short-lived signed playback URLs only after checking `camera.view`. A production ingestion connector should validate the company/camera association, enforce unique segment IDs, and log every ingest, playback authorization and owner deletion.

## Official technical references reviewed

- ONVIF Profiles: https://www.onvif.org/profiles/
- ONVIF Profile S (basic streaming): https://www.onvif.org/profiles/profile-s/
- ONVIF Profile T (advanced streaming): https://www.onvif.org/profiles/profile-t/
- ONVIF Profile G (recording and retrieval): https://www.onvif.org/profiles/profile-g/
- ONVIF Profile V (cloud video; Release Candidate as of October 2026): https://www.onvif.org/profiles/profile-v/
- ONVIF Conformant Products: https://www.onvif.org/conformant-products/
- Reolink's official guide to model-specific RTSP/ONVIF support: https://support.reolink.com/articles/900000617826-Which-Reolink-Products-Support-CGI-RTSP-ONVIF/
- Reolink's official Bluetooth-assisted Wi-Fi setup guide: https://support.reolink.com/articles/27920187894937-How-to-Configure-Wi-Fi-Connection-for-Reolink-Cameras-via-Bluetooth/
- Ubiquiti's official third-party camera adoption guide for UniFi Protect: https://help.ui.com/hc/en-us/articles/26301104828439-Third-Party-Cameras-in-UniFi-Protect

## Important limitation

There is no single universal pairing method or protocol that makes every camera model worldwide stream and record through a web app. A universal-looking onboarding UI is feasible; universal interoperability requires a standards-based connector plus vendor adapters and sometimes compatible recorder hardware. A QR/Bluetooth/Wi-Fi setup option cannot replace that integration work.
