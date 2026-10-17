# NestJS API scaffold

Secured NestJS API scaffold (`builderbackend`). Branding and URLs come from env (`PLATFORM_NAME`, etc.). Includes production-oriented middleware, standardized API responses, [evlog](https://evlog.dev) wide-event logging, environment validation, and CI checks.

## Requirements

- [Bun](https://bun.sh) >= 1.0.0

## Getting started

```bash
bun install
cp env.sample .env
bun run start:dev
```

Server defaults to `http://localhost:3000`. With `REDIS_URL` set and `PROCESS_ROLE=all` (default), the same process consumes the email queue. Use `PROCESS_ROLE=api` plus `bun run start:worker` for a split deploy.

## Environment variables

Copy [`env.sample`](env.sample) to `.env` and adjust.

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No (default: `3000`) | HTTP port |
| `NODE_ENV` | No (default: `development`) | `development`, `production`, or `test` |
| `SENTINEL_FREE_TRIAL_ABUSE` | No | `true`/`false`; defaults on in production, off otherwise. Curl/Swagger signup needs this off. |
| `PRODUCTION_URL` | Yes in production | Public production API URL |
| `DEVELOPMENT_URL` | Yes in production | Public development/staging API URL |
| `PLATFORM_URL` | Yes in production | Frontend / platform URL for CORS and CSP |
| `PLATFORM_NAME` | Yes in production | Platform name for docs, logs, and email copy |
| `ENABLE_API_DOCS` | No | `true`/`false`; defaults on in dev, off in production |
| `LOG_LEVEL` | No (default: `info`) | `fatal`, `error`, `warn`, `info`, `debug`, `trace` (mapped onto evlog `minLevel`) |
| `CORS_ORIGINS` | No | Comma-separated extra allowed origins |
| `REDIS_URL` | Yes in production | Redis for BullMQ email queue and cache |
| `DATABASE_URL` | Yes in production | Postgres URL for Prisma (`postgres://` / `postgresql://`) |
| `DICEBEAR_STYLE` | No (default: animated `loops`) | DiceBear style slug for Gravatar `d=` fallback |
| `PROCESS_ROLE` | No (default: `all`) | `all` (API + worker), `api`, or `worker` |
| `EMAIL_PROVIDER` | No (default: `test`) | `test`, `google`, `smtp`, or `resend`; must not be `test` in production |
| `PLATFORM_SUPPORT` | Yes | From address for transactional email |
| `PLATFORM_LOGO_URL` | No | Logo URL in email templates |
| `COLOR_CODE` | No (default: `#635BFF`) | Brand accent in emails |
| `TIMEZONE` | No (default: `Africa/Lagos`) | IANA timezone for email/calendar dates |
| `RATE_LIMIT_TTL` | No (default: `60000`) | Rate limit window (ms) |
| `RATE_LIMIT_MAX` | No (default: `30`) | Max requests per IP per window |
| `EMAIL_ADDRESS`, `EMAIL_PASSWORD` | When `EMAIL_PROVIDER=google` | Gmail credentials |
| `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` | When `EMAIL_PROVIDER=smtp` | SMTP credentials |
| `RESEND_API_KEY` | When `EMAIL_PROVIDER=resend` | Resend API key |
| `FILES_PROVIDER` | Yes in production (`s3` or `r2`) | `fs` (default in development/test), `s3`, or `r2` |
| `FILES_FS_ROOT` | No (default: `.uploads`) | Local root when `FILES_PROVIDER=fs` |
| `FILES_S3_BUCKET`, `FILES_S3_REGION`, `FILES_S3_ACCESS_KEY_ID`, `FILES_S3_SECRET_ACCESS_KEY` | When `FILES_PROVIDER=s3` | S3 credentials |
| `FILES_S3_ENDPOINT` | No | Optional S3-compatible endpoint (MinIO / Spaces) |
| `FILES_R2_ACCOUNT_ID`, `FILES_R2_BUCKET`, `FILES_R2_ACCESS_KEY_ID`, `FILES_R2_SECRET_ACCESS_KEY` | When `FILES_PROVIDER=r2` | Cloudflare R2 credentials |
| `AXIOM_API_KEY`, `AXIOM_DATASET` | No | Optional [Axiom](https://axiom.co) drain; **both** required to enable ingest |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | No | Google OAuth; both required when ID is set |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | No | GitHub OAuth; both required when ID is set |

### OAuth redirect URIs (local)

Better Auth base path is `/v1/auth`. Register these **authorized redirect URIs** in Google Cloud Console and GitHub OAuth app settings for local development:

| Provider | Redirect URI |
|----------|--------------|
| Google | `http://localhost:3000/v1/auth/callback/google` |
| GitHub | `http://localhost:3000/v1/auth/callback/github` |

If `PORT` is not `3000`, use `http://localhost:<PORT>/v1/auth/callback/{google|github}` instead. For deployed environments, swap `localhost` for your public API origin (`BETTER_AUTH_URL`).

OAuth/API errors redirect to the **frontend** error page (`BETTER_AUTH_ERROR_URL`, default `{PLATFORM_URL}/auth/error`), e.g. `http://localhost:3000/auth/error` locally.

Production example:

```env
NODE_ENV=production
PORT=3000
PRODUCTION_URL=https://api.example.com
DEVELOPMENT_URL=https://api-dev.example.com
PLATFORM_URL=https://app.example.com
PLATFORM_NAME=your-platform
ENABLE_API_DOCS=false
LOG_LEVEL=info
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.example.com
SMTP_USER=apikey
SMTP_PASS=secret
PLATFORM_SUPPORT=noreply@example.com
REDIS_URL=redis://redis.example.com:6379
DATABASE_URL=postgresql://user:pass@db.example.com:5432/dbname
FILES_PROVIDER=s3
FILES_S3_BUCKET=uploads
FILES_S3_REGION=us-east-1
FILES_S3_ACCESS_KEY_ID=your-access-key
FILES_S3_SECRET_ACCESS_KEY=your-secret-key
# Optional remote logs:
# AXIOM_API_KEY=xaat-...
# AXIOM_DATASET=your-dataset
```

## Logging (evlog)

This app uses [evlog](https://evlog.dev) wide events: one structured event per HTTP request or worker job (method, path, status, duration, context). HTTP responses still use the `handleResponse` envelope — clients never see evlog error JSON.

### Where logs go

| Drain | When | Destination |
|-------|------|-------------|
| **Filesystem** | Always when `NODE_ENV` is not `test` | `.evlog/logs/YYYY-MM-DD.jsonl` (NDJSON, 14-day retention, gitignored) |
| **Axiom** | Only if **both** `AXIOM_API_KEY` and `AXIOM_DATASET` are set | Axiom dataset (batched + retried via drain pipeline) |
| **Console** | Non-production | Pretty output in the terminal |

Outside `test`, the filesystem drain is always on so local and server disks get a copy even without Axiom. When Axiom keys are set, events fan out to both sinks (`Promise.allSettled`). Missing Axiom keys is fine in production — you only get FS + console until you add keys.

### Levels and sampling

- **Server faults only.** Head sampling rates are `0` for info/warn/error/debug. Events are kept only when status ≥ 500 (`keep: [{ status: 500 }]`), i.e. server-induced failures — not successful requests or 4xx client errors.
- HTTP middleware uses the same keep rule; process crashes, worker job failures, and readiness failures call `emitServerFault()` (forces `status: 500`) so they still drain.
- `LOG_LEVEL` still sets evlog `minLevel` for the global log API (`fatal` → `error`, `trace` → `debug`). HTTP info/warn lines are sampled out of drains. `logStartup()` force-keeps a few boot lines so `nest start --watch` shows that the process is listening (Nest’s logger stays error/warn/fatal).
- Health and noise paths are excluded from HTTP wide events: `/`, `/health`, `/health/ready`, `/favicon.ico`, `/json`, `/json/**`.

### Local files vs Axiom

- **Local `.evlog/logs/`** — expected in development. Inspect with an editor or the analyze-logs skill; do not commit these files.
- **Axiom** — optional remote store. Set both env vars in `.env` (or deploy secrets) after creating a dataset. Until then, nothing is sent to Axiom.
- **`NODE_ENV=test`** — no FS drain, no Axiom, silent logger (Jest stays clean).

### Conventions

- HTTP handlers: `useLogger()` from `evlog/nestjs`, then `log.set({ ... })`.
- Worker jobs: `createRequestLogger()` + `emit()` in `finally`.
- Email context: `{ email: { template, toCount } }` only — never recipient addresses.
- Files context: `{ files: { provider, operation, keyCount } }` only — never file bodies or secret-like keys.
- Unexpected / server faults: `emitServerFault(error)` (or request-scoped `useLogger().error` on 5xx). Prefer `createError({ message, status, why, fix })` over bare `throw new Error(...)`.
- Service name: `PLATFORM_NAME` when set, else `api`.

Wiring lives in `src/middleware/config/evlog.factory.ts`.

## Email

Transactional email via [@opencoredev/email-sdk](https://email-sdk.dev) with Handlebars templates and optional BullMQ async delivery.

### Providers

| Provider | Use case | Required vars |
|----------|----------|---------------|
| `test` | Local/CI (memory adapter, no network) | `PLATFORM_SUPPORT` |
| `google` | Gmail SMTP (dev / low volume only) | `EMAIL_ADDRESS`, `EMAIL_PASSWORD` |
| `smtp` | Custom SMTP | `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` |
| `resend` | Resend API | `RESEND_API_KEY` |

Shared branding: `PLATFORM_NAME`, `PLATFORM_SUPPORT`, `PLATFORM_URL`, `PLATFORM_LOGO_URL`, `COLOR_CODE`. Dates in email templates use `TIMEZONE` (default `Africa/Lagos`).

### Deliverability

Before production: use `resend` or real SMTP (not Gmail), a From address on a domain you control, SPF/DKIM/DMARC at the ESP, then verify with mail-tester / Postmaster. Welcome mail is transactional; List-Unsubscribe and bounce webhooks are out of scope for this scaffold.

### Sync send

```typescript
import { SendMailsService } from 'src/lib';

await sendMailsService.sendWelcomeEmail('user@example.com', {
  firstName: 'Alex',
  ctaUrl: 'https://app.example.com/dashboard',
});
```

### Async send (BullMQ)

Requires `REDIS_URL`. The API enqueues on the `email` queue. By default (`PROCESS_ROLE=all`) **the same process** consumes jobs via `EmailProcessor`. For a split deploy, run the API with `PROCESS_ROLE=api` and a separate `bun run start:worker`. Jobs use 3 attempts with exponential backoff from 5s, and retain the last 100 completed / 500 failed jobs.

```typescript
await sendMailsService.sendEmailAsync(
  'user@example.com',
  'Welcome to your-platform',
  'welcome',
  { firstName: 'Alex' },
);
```

### Templates

Templates live in `src/lib/email/templates/` (copied to `dist` on build). `welcome.hbs` merges platform branding from env plus `firstName` / optional `ctaUrl`. Sample data: `test/fixtures/`.

## Files

Opt-in object storage via [files-sdk](https://files-sdk.dev). Feature modules `imports: [FilesModule]` and inject `FilesService`. `FilesModule` is not registered on `AppModule` or `LibModule`, and v1 does not mount an HTTP files gateway. `FilesService` maps `FilesError` codes to HTTP exceptions (`NotFound`→404, `Unauthorized`→401, `Conflict`→409, `ReadOnly`→403, timeouts→504); other failures stay 500 without leaking provider details.

| `FILES_PROVIDER` | Use case | Required vars |
|------------------|----------|---------------|
| `fs` | Local/dev (default). Not allowed in production | `FILES_FS_ROOT` (default `.uploads`) |
| `s3` | AWS S3 or S3-compatible (MinIO, Spaces) | `FILES_S3_BUCKET`, `FILES_S3_REGION`, `FILES_S3_ACCESS_KEY_ID`, `FILES_S3_SECRET_ACCESS_KEY`; optional `FILES_S3_ENDPOINT` |
| `r2` | Cloudflare R2 (fetch client, no AWS SDK) | `FILES_R2_ACCOUNT_ID`, `FILES_R2_BUCKET`, `FILES_R2_ACCESS_KEY_ID`, `FILES_R2_SECRET_ACCESS_KEY` |

When using `s3`, install the AWS peers: `bun add @aws-sdk/client-s3 @aws-sdk/s3-presigned-post @aws-sdk/s3-request-presigner`.

```typescript
import { FilesModule, FilesService } from 'src/lib';

@Module({
  imports: [FilesModule],
  providers: [AvatarsService],
})
export class AvatarsModule {}
```

## Queue

`QueueModule` enqueues (`QueueService`) and can consume (`EmailProcessor`) BullMQ email jobs. Role is controlled by `PROCESS_ROLE`:

| `PROCESS_ROLE` | Behavior |
|----------------|----------|
| `all` (default) | API HTTP + in-process email worker |
| `api` | API HTTP only (enqueue); worker must run elsewhere |
| `worker` | No HTTP; email consumer only (`bun run start:worker`) |

```bash
# Combined (default)
bun run start:prod

# Split
PROCESS_ROLE=api bun run start:prod
bun run start:worker
```

The worker is skipped when `REDIS_URL` is unset, `NODE_ENV=test`, or `PROCESS_ROLE=api`.

## Health checks

| Endpoint | Type | Description |
|----------|------|-------------|
| `GET /health` | Liveness | Process up; no dependency checks |
| `GET /health/ready` | Readiness | Redis + queue; for `all`/`worker` also requires local email worker; **503** when unhealthy |

Both skip rate limiting for load balancer probes.

## Scripts

| Command | Description |
|---------|-------------|
| `bun run start:dev` | API with hot reload (`PROCESS_ROLE=all` unless set) |
| `bun run start:prod` | Compiled API (same) |
| `bun run start:api` | Compiled API with `PROCESS_ROLE=api` |
| `bun run start:worker` | Compiled email worker process |
| `bun run start:worker:dev` | Worker with hot reload |
| `bun run build` | Compile TypeScript (`prisma generate` + Nest build) |
| `bun run prisma:generate` | Generate Prisma Client into `src/lib/prisma/generated` |
| `bun run prisma:migrate:dev -- --name <name>` | Create and apply a migration (local/dev) |
| `bun run prisma:migrate:deploy` | Apply existing migrations (CI/production) |
| `bun run lint` | ESLint |
| `bun run typecheck` | TypeScript check (no emit) |
| `bun run test` | All unit tests |
| `bun run test:app` / `test:lib` / `test:middleware` | Layer unit tests |
| `bun run test:cov` | Unit tests with coverage gates |
| `bun run test:e2e` | End-to-end tests (Redis happy-path when `REDIS_URL` is set) |
| `bun run check` | Full CI pipeline locally |

## API response format

All endpoints return the `handleResponse` envelope:

```json
{
  "statusCode": 200,
  "statusType": "OK",
  "message": "OK",
  "data": {}
}
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Root message |
| `GET` | `/health` | Liveness |
| `GET` | `/health/ready` | Readiness (Redis + queue) |
| `GET` | `/v1/docs` | Swagger UI (when docs enabled) |
| `GET` | `/v1/api-reference` | Scalar API reference (when docs enabled) |

## Project structure

```
builderbackend/
├── .github/workflows/ci.yml
├── env.sample
├── src/
│   ├── main.ts                 # HTTP API entry; initLogger
│   ├── worker.ts               # Email worker entry (PROCESS_ROLE=worker)
│   ├── app/                    # Routes + AppModule (import via src/app)
│   ├── lib/                    # Email, Redis, gravatar, Prisma (import via src/lib only)
│   │   ├── email/              # SendMailsService + Handlebars templates
│   │   ├── redis/
│   │   ├── gravatar/
│   │   ├── files/
│   │   └── prisma/
│   ├── generated/prisma/       # Prisma Client (generated; do not edit)
│   └── middleware/             # Infra (import via src/middleware)
│       ├── config/             # Env, CORS/Helmet, email/files/evlog factories
│       ├── common/             # Platform context, Redis connection helpers
│       ├── filters/            # handleResponse + global exceptions
│       ├── health/             # Terminus indicators + readiness helpers
│       └── queue/              # BullMQ enqueue + in-process EmailProcessor
└── test/                       # Mirrors src/ (app, lib, middleware, e2e, fixtures)
```

Imports: absolute barrels only — `src/app`, `src/lib`, `src/middleware`. Lib subfolders have no `index.ts`. Domain email/gravatar types live next to their services and export via `src/lib`.

## Testing

Unit tests mirror `src/` under `test/`. Shared edge-case data lives in `test/fixtures/`. Coverage gates: 80% lines/statements/functions, 70% branches (`main.ts` and `setup-api-docs.ts` excluded).

```bash
bun run test:cov
bun run test:e2e
```

## Security

- Helmet with CSP
- Env-driven CORS allowlist (`PRODUCTION_URL`, `DEVELOPMENT_URL`, `PLATFORM_URL`, optional `CORS_ORIGINS`)
- Global rate limiting (default 30 req / 60s per IP)
- Request body size limit (10kb)
- Validation pipe with whitelist
- Global exception filter (no stack traces in production)
- API docs disabled in production unless `ENABLE_API_DOCS=true`

## CI

GitHub Actions on push/PR to `main` and `master` (parallel):

1. format (Prettier)
2. lint
3. typecheck
4. build (verifies `dist/main.js`)
5. test-unit matrix (`app` / `lib` / `middleware`)
6. test-cov (coverage gates)
7. test-e2e

```bash
bun run check
```

## License

UNLICENSED — private project.
