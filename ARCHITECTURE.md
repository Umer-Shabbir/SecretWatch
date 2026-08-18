# GitHub Key Leak Reporter — Architecture

## 1. What it does

Web app scans GitHub public repos/code search for leaked API keys/secrets (regex + entropy patterns). On find, opens GitHub issue on offending repo with custom templated message, using submitted user GitHub token (raises search rate limit, posts as that user's identity). Marketing site (public) + user dashboard (submit token, see scan/flag history) + admin panel (manage workers, rules, users, review queue before auto-post).

Not a Python GUI. Full web app: Node.js stack, background workers, scheduler, Postgres DB, deployed on ~$5-10/mo infra.

---

## 2. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend (marketing + user dashboard + admin) | **Next.js 14 (App Router)**, TypeScript, Tailwind | One repo, SSR marketing pages (SEO) + auth'd app in same project. |
| Backend API | Next.js API routes / Route Handlers | No separate backend service needed — cuts a whole deploy target. |
| Auth | **Auth.js (NextAuth)** — GitHub OAuth login for users, credentials/email for admin | Users log in with GitHub anyway; natural fit, also can request token scope via OAuth instead of raw PAT paste (safer). |
| DB | **PostgreSQL** (Neon free tier or Railway Postgres) | Relational fit for users/tokens/findings/jobs. Neon free tier = 0.5GB, autosuspend, fine at this scale. |
| ORM | **Prisma** | Type-safe queries, migrations, works everywhere. |
| Job queue | **BullMQ** (Redis-backed) | Mature Node queue: retries, rate-limiting, scheduling (repeatable jobs = your "worker scheduling"), concurrency control per queue. |
| Redis | Upstash Redis (free tier, serverless, pay-per-request) | Cheapest way to get Redis without running your own; BullMQ supports it. |
| Workers | Standalone Node process(es), same repo (`/worker`), talk to same Postgres + Redis | Scanner worker (calls GitHub Code Search API), Flagger worker (opens issues), Scheduler (cron-like repeatable BullMQ jobs). |
| Secrets encryption | `crypto` (AES-256-GCM) column-level encryption for stored GitHub tokens, key from env var | Never store raw PATs in plaintext. |
| Hosting | **Railway** (web + worker + Postgres + cron, one project) OR single **Hetzner CX22 VPS** (~€4.5/mo) with Docker Compose | Railway = zero ops, ~$5-10/mo with usage-based billing. VPS = flat cheapest, more manual ops. Recommend Railway to start, migrate to VPS if usage grows. |
| Monitoring/logs | Railway built-in logs + BullMQ Board (`@bull-board/express`) mounted as admin sub-route | Free, no third-party bill. |

**Recommendation:** Railway for everything (web service + worker service + Postgres plugin), Upstash for Redis (free tier). Total cost ~$5-10/mo at low volume. Move to Hetzner VPS only if Railway usage-based billing grows past that.

---

## 3. High-level architecture

```
                          ┌─────────────────────────┐
                          │   Marketing Site (SSR)   │  public, no auth
                          │   /  /pricing  /how-it-works
                          └────────────┬────────────┘
                                       │
                          ┌────────────▼────────────┐
                          │      Next.js App        │
                          │  ┌────────────────────┐  │
                          │  │ User Dashboard      │  │  auth: GitHub OAuth
                          │  │ - submit token      │  │
                          │  │ - view flagged repos│  │
                          │  │ - toggle scan rules │  │
                          │  └────────────────────┘  │
                          │  ┌────────────────────┐  │
                          │  │ Admin Panel         │  │  auth: role=admin
                          │  │ - user/token mgmt   │  │
                          │  │ - worker health      │  │
                          │  │ - review/approve queue│ │
                          │  │ - message templates  │  │
                          │  └────────────────────┘  │
                          │  ┌────────────────────┐  │
                          │  │ API routes          │  │
                          │  └─────────┬──────────┘  │
                          └────────────┼─────────────┘
                                       │ enqueue jobs
                          ┌────────────▼─────────────┐
                          │   Redis (Upstash)         │
                          │   BullMQ queues:           │
                          │   - scan-queue             │
                          │   - flag-queue             │
                          │   - scheduler (repeatable)  │
                          └────────────┬──────────────┘
                                       │
                ┌──────────────────────┼──────────────────────┐
                ▼                      ▼                      ▼
      ┌──────────────────┐  ┌──────────────────┐   ┌────────────────────┐
      │ Scanner Worker    │  │ Flagger Worker    │   │ Scheduler Worker    │
      │ - GitHub code     │  │ - pulls pending   │   │ - cron-like BullMQ  │
      │   search API       │  │   findings        │   │   repeatable jobs   │
      │ - regex/entropy    │  │ - picks a user     │   │ - re-enqueue scans  │
      │   match secrets    │  │   token (rotated)  │   │   every N minutes   │
      │ - writes Finding   │  │ - opens GitHub     │   └────────────────────┘
      │   rows to DB       │  │   issue w/ template│
      └─────────┬─────────┘  └─────────┬──────────┘
                │                       │
                ▼                       ▼
      ┌─────────────────────────────────────────┐
      │           PostgreSQL (Neon/Railway)       │
      │  users, github_tokens(encrypted), findings│
      │  flags, message_templates, scan_rules,    │
      │  audit_log, worker_jobs                   │
      └───────────────────────────────────────────┘
```

---

## 4. Core data model (Prisma schema, simplified)

```prisma
model User {
  id            String   @id @default(cuid())
  githubId      String   @unique
  username      String
  email         String?
  role          Role     @default(USER)
  tokens        GithubToken[]
  createdAt     DateTime @default(now())
}

model GithubToken {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  encrypted   String   // AES-256-GCM ciphertext
  scopes      String[] // e.g. ["public_repo"]
  lastUsedAt  DateTime?
  rateLimitRemaining Int?
  active      Boolean  @default(true)
  createdAt   DateTime @default(now())
}

model Finding {
  id           String   @id @default(cuid())
  repoFullName String
  filePath     String
  commitSha    String
  matchedRule  String   // which regex/rule matched
  redactedSnippet String // store REDACTED context, never raw secret
  status       FindingStatus @default(PENDING) // PENDING, APPROVED, FLAGGED, IGNORED, FAILED
  createdAt    DateTime @default(now())
  flag         Flag?
}

model Flag {
  id          String   @id @default(cuid())
  findingId   String   @unique
  finding     Finding  @relation(fields: [findingId], references: [id])
  issueUrl    String
  usedTokenId String
  templateId  String
  postedAt    DateTime @default(now())
}

model MessageTemplate {
  id      String @id @default(cuid())
  name    String
  body    String // supports {{repo}}, {{file}}, {{rule}} placeholders
  isDefault Boolean @default(false)
}

model ScanRule {
  id        String  @id @default(cuid())
  name      String  // e.g. "AWS Access Key", "Stripe Secret"
  pattern   String  // regex
  enabled   Boolean @default(true)
}

enum Role { USER ADMIN }
enum FindingStatus { PENDING APPROVED FLAGGED IGNORED FAILED }
```

Key safety design: raw secret value **never stored** — only a redacted snippet (first/last few chars masked) for admin review context. Reduces liability if DB leaks.

---

## 5. Worker scheduling design

- **BullMQ repeatable jobs** run scheduler queue every N minutes (configurable in admin panel) → enqueues scan jobs across GitHub code search query shards (split by secret-pattern type to spread rate limit use).
- **Scan queue**: concurrency limited (e.g. 2-3 concurrent) to respect GitHub Search API rate limit (30 req/min authed). Each job = one search query page, writes new `Finding` rows.
- **Flag queue**: separate concurrency, picks `PENDING` (or `APPROVED` if admin review required) findings, rotates through active user tokens (round robin, skips tokens near rate limit), posts issue via GitHub REST API (`POST /repos/{owner}/{repo}/issues`), writes `Flag` row.
- **Admin review gate** (toggle in admin panel): if ON, findings sit at `PENDING` until admin approves in dashboard before flag-queue picks them up. If OFF, auto-flag immediately (riskier, faster).
- **Retry/backoff**: BullMQ built-in exponential backoff on GitHub API 403/429s.
- **Dead-letter**: failed jobs after N retries marked `FAILED`, visible in admin panel for manual retry.

---

## 6. Folder structure

```
github-key-leak-reporter/
├── apps/
│   └── web/                        # Next.js app (marketing + dashboard + admin + API)
│       ├── app/
│       │   ├── (marketing)/
│       │   │   ├── page.tsx                # landing page
│       │   │   ├── pricing/page.tsx
│       │   │   └── how-it-works/page.tsx
│       │   ├── (dashboard)/
│       │   │   ├── dashboard/page.tsx
│       │   │   ├── tokens/page.tsx         # submit/manage GitHub token
│       │   │   └── flags/page.tsx          # history of flags raised
│       │   ├── (admin)/
│       │   │   ├── admin/page.tsx
│       │   │   ├── admin/users/page.tsx
│       │   │   ├── admin/rules/page.tsx
│       │   │   ├── admin/templates/page.tsx
│       │   │   ├── admin/review-queue/page.tsx
│       │   │   └── admin/workers/page.tsx  # BullMQ board embed / stats
│       │   └── api/
│       │       ├── auth/[...nextauth]/route.ts
│       │       ├── tokens/route.ts
│       │       ├── findings/route.ts
│       │       └── webhooks/github/route.ts
│       ├── lib/
│       │   ├── db.ts                       # Prisma client
│       │   ├── crypto.ts                   # AES encrypt/decrypt for tokens
│       │   ├── queue.ts                    # BullMQ queue defs (shared w/ worker)
│       │   └── github.ts                   # Octokit wrapper
│       ├── prisma/
│       │   ├── schema.prisma
│       │   └── migrations/
│       └── package.json
│
├── apps/
│   └── worker/                     # standalone Node worker process
│       ├── src/
│       │   ├── index.ts                    # boots all workers
│       │   ├── scanner.worker.ts
│       │   ├── flagger.worker.ts
│       │   ├── scheduler.ts
│       │   ├── rules/                      # regex secret patterns
│       │   │   ├── aws.ts
│       │   │   ├── stripe.ts
│       │   │   └── generic-entropy.ts
│       │   └── github-client.ts
│       └── package.json
│
├── packages/
│   └── shared/                     # shared types, Prisma client, queue names, template renderer
│       ├── types.ts
│       └── package.json
│
├── docker-compose.yml              # local dev: postgres + redis
├── .env.example
├── turbo.json                      # (optional) turborepo/pnpm workspace config
├── pnpm-workspace.yaml
└── architecture.md
```

Monorepo (pnpm workspaces, optionally Turborepo) keeps web + worker + shared types in one repo, one deploy pipeline, still deployable as 2 separate services (web, worker) on Railway.

---

## 7. Deployment plan (cheapest reliable)

| Service | Provider | Cost |
|---|---|---|
| Web app (Next.js) | Railway service, auto-deploy from GitHub | ~$0-5/mo (usage-based, low traffic) |
| Worker process | Railway service (same project, `apps/worker` start command) | ~$0-5/mo |
| Postgres | Neon free tier (or Railway Postgres plugin) | $0 (Neon free 0.5GB) |
| Redis | Upstash free tier | $0 (10k commands/day free) |
| Domain | Any registrar | ~$10/yr (not monthly) |

Total realistic: **$5-10/month**. Both web and worker live in same Railway project so they share env vars/secrets easily; scale worker replicas independently if scan volume grows.

Alternative if Railway free credits run out: single Hetzner CX22 VPS (~€4.5/mo) running `docker-compose up` with 4 containers (web, worker, postgres, redis) — flat cost regardless of usage, but you own OS patching/updates/uptime.

---

## 8. Security notes

- GitHub tokens encrypted at rest (AES-256-GCM), decrypted only in-memory inside worker when making API call.
- Prefer GitHub OAuth App flow (scoped, revocable) over asking users to paste raw PATs, if scope permits (`public_repo` scope is enough to open issues).
- Rate-limit-aware token rotation prevents any single user's token from being abused/exhausted.
- Admin review gate strongly recommended ON by default — auto-posting to strangers' repos unsupervised is reputational/abuse risk (GitHub can flag your app's OAuth client for spam).
- Add per-user daily flag cap + global daily flag cap (config in admin panel) to avoid GitHub abuse-rate-limiting your app entirely.
- Log every flag action to `audit_log` table (who/when/which token/which template) for accountability.

---

## 9. Build order (suggested)

1. Next.js app skeleton + GitHub OAuth login + Postgres/Prisma setup.
2. Token submit page + encryption.
3. Scanner worker: hard-code a few regex rules, GitHub code search, write Findings, no flagging yet.
4. Admin review-queue UI to eyeball findings.
5. Flagger worker + message templates + manual "approve → flag" button.
6. BullMQ scheduler for auto-recurring scans.
7. Admin panel: user mgmt, worker health/stats, rate limit dashboard.
8. Marketing site pages.
9. Deploy to Railway, wire domain.
