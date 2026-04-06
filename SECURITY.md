# Security policy

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security-sensitive reports.

Email the maintainer or open a **private** security advisory on GitHub if enabled for this repository:  
[GitHub Security advisories](https://github.com/MattMessinger1/agentic_refund_guardrail/security/advisories/new) (repository **Settings → Security** must allow it, or use contact via profile/README).

Include: affected version, reproduction steps, and impact.

## What this library does not do

- **refund-guard** does not call the network by itself for payments. It runs validation logic **in your process** and then invokes **your** `provider_refund_fn`.
- It does **not** send telemetry or phone home.
- **Secret keys** (Stripe, etc.) belong in **your** server environment — never in client apps or public repos.

## Scope

Security issues **in scope**: validation bypass, incorrect denial/approval logic, unexpected behavior that could cause financial loss when used as documented.

**Out of scope**: compromise of your Stripe account keys, social engineering, or bugs in Stripe’s own API (report to Stripe).
