# create-nest-boilerplate

Create a production-ready NestJS API with an interactive command:

```bash
bunx create-nest-boilerplate@latest my-api
```

Choose either Prisma with PostgreSQL or a database-free template. The generator
can configure Docker or hosted PostgreSQL, optional Redis, SMTP or Resend email,
and local, Cloudflare R2, or S3-compatible file storage.

## Direct commands

```bash
bunx create-nest-boilerplate@latest my-api --prisma --db=docker
bunx create-nest-boilerplate@latest my-api --no-database --redis=skip
```

Run `bunx create-nest-boilerplate@latest --help` for all options.

## Development

```bash
bun install
bun test
```

The two templates are bundled with the npm package, so project creation does
not depend on GitHub being available.
