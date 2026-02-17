# Security Policy

TSera is an open-source framework (library code). This policy explains **how to report
vulnerabilities**, how we **triage and fix** them, and what you can expect during **coordinated
disclosure**.

## Report a vulnerability (private channels)

**Do not open public issues or PRs for security problems.**

Please report vulnerabilities through the official contact channels listed in the **Contact &
privacy** section below.

> **Code of Conduct reports ?**\
> See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).\
> These are for behavior, not software bugs.

We will confirm receipt and keep details confidential to the extent possible. If you’re
uncomfortable using the above channels, we can provide a temporary **anonymous intake form** on
request.

### What to include

- A concise **summary** of the issue and **impact**
- Affected **package/module** and **version**
- **Environment** (OS, Deno version)
- **Proof of Concept** (steps or minimal code), expected vs. actual behavior
- **Attack prerequisites** (permissions, configuration) and a suggested fix or mitigation if known

## Good-faith research — Safe Harbor

If you follow this policy and make a good-faith effort to avoid privacy violations, data
destruction, and service degradation, **we will not pursue or support legal action** for testing
conducted in compliance with this policy. If you are unsure whether a test is permitted, contact us
first.

### Prohibited testing

- Social engineering, phishing, or threats
- DDoS or brute-force attacks
- Data exfiltration of real user data
- Testing third-party deployments without the owner’s explicit permission

## Triage & coordinated disclosure

We use CVSS v3.1 as guidance (no SLA).

- We may create a **private GitHub Security Advisory** and invite you as a collaborator.
- Fixes are developed on a private branch; we prepare release notes and mitigations.
- We may **request a CVE ID** via GitHub advisories when appropriate.
- We publish patched releases and the advisory (with credit, if you consent).
- Public disclosure is coordinated with you; we generally disclose when the fix is available.

**Credit:** With your permission, we will acknowledge you in the advisory and release notes. We do
**not** run a monetary bug bounty at this time.

## Scope

TSera is primarily developer tooling and scaffolding. Security of applications built with TSera
ultimately depends on application code, configuration, and deployment environment.

### In scope (examples)

- Remote Code Execution (RCE) or sandbox escape in TSera tools
- Authentication/authorization bypass in TSera templates or generators
- Injection (command/template/SQL) caused by TSera code or scaffolding defaults
- Information disclosure of secrets produced by TSera tooling
- Integrity bugs allowing tampering with generated configs or migrations

### Out of scope (examples)

- Issues in **your own application** built with TSera (unless caused by insecure defaults in our
  templates)
- Vulnerabilities in **third-party dependencies** without a demonstrable exploitable impact in TSera
- Findings requiring unrealistic configurations or only root/local privileged access
- Missing best-practice headers or rate limits in **example apps** not enabled by default
- Social engineering, spam, or volumetric attacks (DDoS)

If in doubt, report anyway — we’ll help triage.

## Patches & releases

- Security fixes land as **patch or minor** releases.
- Backports are considered **case-by-case** based on impact and feasibility.
- Release notes include **mitigations** and **upgrade guidance**.
- We may delay merging unrelated PRs until a security release is out, to keep the diff small and
  upgrades simple.

## Contact & privacy

- Primary contact: [security@tsera.dev](mailto:security@tsera.dev)
- Backup contact: Discord **@Admin** (TSera server on
  [discord.tsera.dev](https://discord.tsera.dev))
- We store report data **no longer than 12 months**, unless required for an ongoing case or legal
  obligation.

### **Thank you for helping us keep the TSera ecosystem secure. 🩵**
