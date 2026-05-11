# Cloudflare Access Policy — Production Deploy

> Phase 6 POLISH (D-6-18, carry-forward from Phase 1 Q3). Source: `.planning/PROJECT.md` key decision "CF Access email-only on production deploys". Companion to [`cloudflare-pages-setup.md`](./cloudflare-pages-setup.md), which already documents the preview-deployment policy.

## Goal

Restrict access to `https://agenticapps-dashboard.pages.dev` (and any future custom domain like `dashboard.agenticapps.eu`) to a single email — `donald.vlahovic@neuro-flash.com` — until the project flips public in Phase 8.

## Why documentation, not code

The repo has zero Cloudflare Workers / Pages Functions in v1 (PROJECT.md hard constraint, mirrored in `00-CONTEXT.md` D-11). No `wrangler`, no Terraform. CF Access state lives in the Cloudflare dashboard. This file captures the exact Application + Policy shape so it can be recreated if the dashboard state is ever reset.

## Apply via Cloudflare Dashboard

1. Open <https://one.dash.cloudflare.com> (Zero Trust login).
2. Navigate: **Access → Applications → Add an application → Self-hosted**.
3. **Application Configuration:**
   - Application name: `AgenticApps Dashboard`
   - Session duration: `24 hours`
   - Application domain: `agenticapps-dashboard.pages.dev`
   - (Optional, when the custom domain lands) Additional subdomain: `dashboard.agenticapps.eu`
4. **Identity providers:** select `One-time PIN` only (default email-OTP — no Google/GitHub OAuth needed for a single-user product).
5. **Policies tab → Add a policy:**
   - Policy name: `Email allowlist`
   - Action: `Allow`
   - Configure rules → Include → Selector: `Emails` → Value: `donald.vlahovic@neuro-flash.com`
   - Save policy.
6. **Save Application.**

The preview-deployment policy is documented separately in [`cloudflare-pages-setup.md`](./cloudflare-pages-setup.md) §"Cloudflare Access — preview deployments". Both policies are independent.

## Equivalent JSON shape (reference only)

The Application + Policy combination above corresponds to this JSON. CF Access does not currently expose a fully public REST API for v1, but documenting the shape clarifies intent and would be the input if this is ever automated:

```json
{
  "name": "AgenticApps Dashboard",
  "domain": "agenticapps-dashboard.pages.dev",
  "type": "self_hosted",
  "session_duration": "24h",
  "policies": [
    {
      "name": "Email allowlist",
      "decision": "allow",
      "include": [
        { "email": { "email": "donald.vlahovic@neuro-flash.com" } }
      ]
    }
  ]
}
```

## Verification

1. Open the production URL in an incognito browser window.
2. CF Access should display the email-OTP challenge page.
3. Enter `donald.vlahovic@neuro-flash.com` → receive the OTP via email → paste → SPA loads.
4. From a non-allowlisted email: enter the email → receive OTP → paste → CF Access denies access ("You're not allowed to access this application").

## Phase 8 flip

When the project goes public (OSS-03), either:

- Delete the CF Access Application (drops the gate entirely), **OR**
- Change the policy from `Allow` (email-only) to `Bypass` for unauthenticated visitors while keeping audit logs.

Decision deferred to Phase 8 per `.planning/ROADMAP.md`.

## Reference

- Phase 1 deferred decision: `.planning/phases/01-daemon-registry-pairing/01-CONTEXT.md` §"Q3 — CF Access policy on production deploys"
- Phase 6 lock-in: `.planning/phases/06-polish-service-install-acceptance/06-CONTEXT.md` D-6-18
- Companion doc: [`cloudflare-pages-setup.md`](./cloudflare-pages-setup.md) (preview deployments + build config)
