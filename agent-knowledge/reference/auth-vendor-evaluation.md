---
type: reference
tags: [auth, vendor-evaluation, better-auth, workos, clerk, auth0]
---

# Auth Vendor Evaluation

`[2026-04-19]` Research synthesis comparing Better Auth, WorkOS, Clerk, Auth0 against Tinker's constraints. Outcome: Better Auth for both OSS consumer and enterprise fork default. WorkOS/Clerk/Auth0 swap is fork-only, only if compliance forces it.

## Sources Consulted

| # | Source | URL | Bias |
|---|---|---|---|
| 1 | WorkOS comparison blog | https://workos.com/blog/workos-vs-betterauth-vs-clerk | WorkOS marketing — emphasizes WorkOS advantages, flags BA gaps in B2B scaling context |
| 2 | Auth0Alternatives BA vs WorkOS | https://www.auth0alternatives.com/compare/better-auth/vs/workos | Neutral-ish — factual feature matrix |
| 3 | Better Auth migration guide | https://better-auth.com/docs/guides/workos-migration-guide | BA-authored — optimistic about migration ease |
| 4 | Baisden Medium eval | https://javascript.plainenglish.io/i-evaluated-enterprise-auth-for-a-saas-app-and-heres-my-honest-take-on-workos-authkit-radar-57405d0ecd1e | Dev-neutral, vendor-paid context unclear but reads balanced |
| 5 | SSOJet BA vs WorkOS | https://ssojet.com/ciam-vendors/comparison/workos-vs-betterauth | Vendor-neutral but **contains factual errors** — claims BA lacks native social connectors (false); reliability downgraded |

## Consolidated Feature Matrix

| Feature | Better Auth | WorkOS | Clerk | Auth0 |
|---|---|---|---|---|
| **Cost** | $0 (MIT) | $125+/mo per conn, $2500/1M MAU over free | $0 up to 10K MAU, $0.02/MAU after, $250/mo biz | Varies; ~$200+/mo for prod |
| **Self-hostable** | ✅ | ❌ | ❌ | ❌ |
| **OSS license** | ✅ MIT | ❌ | ❌ | ❌ |
| **Social OAuth (Google/MS/GH/Apple)** | ✅ native | ✅ | ✅ | ✅ |
| **SAML 2.0 SSO** | ⚠️ plugin in flight | ✅ full | ✅ metered | ✅ |
| **SCIM directory sync** | ❌ | ✅ | ❌ | ✅ |
| **Audit logs at auth layer** | ❌ | ✅ | Limited | ✅ |
| **Self-service admin portal** | ❌ | ✅ | ❌ | ✅ |
| **Compliance certs (SOC2/HIPAA/GDPR)** | ❌ self-responsible | ✅ vendor-certified | SOC2 (Business+) | ✅ |
| **M2M / client credentials** | Plugin | ✅ | Limited | ✅ |
| **TypeScript-native** | ✅ | ❌ (SDK) | ✅ | ❌ (SDK) |
| **PKCE public client support** | ✅ | ✅ | ✅ | ✅ |

## Key Findings

### Better Auth strengths
- Zero vendor lock-in, zero cost, full infrastructure control
- Runs in-process (sidecar for Tinker) — ideal for local-first
- TypeScript-native maps to Tinker's stack
- Modern OAuth patterns first-class (PKCE, social providers, session management)

### Better Auth gaps
- No SAML 2.0 mature (plugin in flight)
- No SCIM provisioning
- No built-in audit logs
- No compliance certs (self-attest required)
- No managed admin portal for enterprise customer orgs

### WorkOS strengths
- Full enterprise feature set ready out of box
- SOC2/HIPAA/CCPA/GDPR certified
- Self-service admin portal reduces support load for B2B SaaS
- Radar (abuse detection) at auth layer — integrated credential stuffing / fake-account prevention
- Flat $125/mo/conn pricing doesn't meter per user after free tier

### WorkOS weaknesses (for Tinker specifically)
- No self-hosting option
- No free tier that exercises real enterprise features
- Mental overhead: every decision through "enterprise-ready lens" — Baisden's observation
- Stack integration strongest with Next.js; other stacks less polished

### Clerk weaknesses
- Consumer-tuned, enterprise features feel bolted-on
- SAML metered separately
- No SCIM
- Migration away is painful when enterprises demand SCIM/admin portal (Baisden paraphrase)

## Tinker Relevance Scoring

Feature × Tinker-need matrix:

| WorkOS strength | Tinker consumer need? | Tinker enterprise fork need? |
|---|---|---|
| SAML 2.0 full support | ❌ no | ⚠️ maybe (OIDC usually sufficient) |
| SCIM directory sync | ❌ no | ❌ no (no central user DB) |
| Audit logs at auth vendor | ❌ no | ❌ (Entra/Okta log natively) |
| SOC2/HIPAA certs | ❌ no | ❌ (app stores no regulated data centrally) |
| Self-service admin portal | ❌ no | ❌ (no customer-org-management need) |
| Radar abuse detection | ⚠️ low | ⚠️ low (no public login endpoint) |
| Managed hosting | ❌ **negative** | ❌ **negative** (local-first principle) |

Net: zero WorkOS strengths translate into Tinker value. Compliance certs travel with the IdP (Entra is SOC2), not Tinker.

## Migration Cost Analysis (BA → X)

Per BA migration guide (source 3):
- User email + profile preserved
- WorkOS user IDs preserved in metadata
- **Passwords NOT migrated** — forced reset on next login (WorkOS doesn't export hashes; industry standard)
- **Sessions invalidated** — forced re-auth
- Webhook integrations require manual rewrite
- Plan maintenance window

Tinker-specific cost:
- No stored passwords (OAuth-only) → password reset step is N/A
- Sessions invalidating → local, benign
- No webhook infrastructure → nothing to rewrite

**Conclusion:** Tinker's architecture makes auth-lib swap cheaper than average case. Further validates vendor-agnostic sidecar contract as escape hatch.

## Recommendation

### Upstream OSS (consumer)
Better Auth. Locked. Revisit only if BA project is abandoned or adopts hostile license change.

### Enterprise fork default
Better Auth. Works for all documented enterprise flows (Entra OIDC, Okta OIDC, Google Workspace). Only swap if:
- Org security team mandates specific vendor
- Specific compliance cert needed that BA can't attest (BA gives self-attestation; formal audit requires vendor)
- SAML 2.0 support needed before BA's SAML plugin lands

### Swap procedure (if forced)
1. Rewrite `packages/auth-sidecar/src/main.ts` using target vendor's SDK
2. Maintain `IdentitySession` output contract — downstream code (FederationAdapter, proxy, self-healing) unchanged
3. Force all users to re-auth (standard migration)
4. Update enterprise fork guide with vendor-specific setup steps

## Revisit Triggers

| Trigger | Action |
|---|---|
| BA project abandoned / license change | Swap to WorkOS or Clerk across upstream |
| 100+ enterprise fork adopters need SAML | Evaluate adding SAML via BA plugin vs vendor swap |
| SOC2 Type II demanded of upstream | Cannot provide (self-hosted OSS). Document this reality. |
| Radar-style abuse detection needed | Evaluate — but desktop apps have limited attack surface |

## Connections
- [[auth-architecture]] — adapter pattern that enables vendor swap
- [[01-sso-connector-layer]] — upstream feature spec
- [[decisions]] — D2, D3 lock these choices
