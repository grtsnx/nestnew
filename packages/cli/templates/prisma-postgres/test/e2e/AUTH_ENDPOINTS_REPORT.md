# Auth endpoint report

Generated: 2026-08-18T02:54:36.701Z

| Result | Method | Path | Status | Auth | Note |
| --- | --- | --- | --- | --- | --- |
| PASS | GET | `/health` | 200 | public | liveness ok |
| PASS | GET | `/v1/auth/ok` | 200 | auth | auth handler alive (hidden from Swagger Auth tag) |
| PASS | GET | `/v1/user/check/username` | 200 | public | {"statusCode":200,"statusType":"OK","message":"Username checked","data":{"available":true}} |
| PASS | GET | `/v1/user/check/telephone` | 200 | public | {"statusCode":200,"statusType":"OK","message":"Telephone checked","data":{"available":true}} |
| PASS | GET | `/v1/user/me (anon)` | 401 | session | correctly rejected |
| PASS | POST | `/v1/auth/signup/email` | 200 | auth | user created id=ylahkzl8g2o8yw9k3mh0v7wq |
| PASS | DB | `user.emailVerified=true` | 200 | auth | email verified for e2e (sendVerificationEmail is stubbed) |
| PASS | POST | `/v1/auth/signin/email` | 200 | auth | signed in + session cookie |
| PASS | GET | `/v1/user/me` | 200 | session | profile returned |
| PASS | PATCH | `/v1/user/onboarding` | 200 | session | onboarding updated |
| FAIL | POST | `/v1/organisation` | 500 | session | {"statusCode":500,"statusType":"INTERNAL_SERVER_ERROR","message":"Request failed"} |
| PASS | GET | `/v1/organisation` | 200 | session | listed orgs |
| PASS | POST | `/v1/organisation/active` | 200 | session | active org set |
| FAIL | GET | `/v1/organisation/member` | 400 | session | {"statusCode":400,"statusType":"BAD_REQUEST","message":"No active organization","data":{"code":"NO_ACTIVE_ORGANIZATION"}} |
| FAIL | POST | `/v1/organisation/member/invite` | 400 | session | {"statusCode":400,"statusType":"BAD_REQUEST","message":"Organization not found","data":{"code":"ORGANIZATION_NOT_FOUND"}} |
| FAIL | PATCH | `/v1/organisation/member/:memberId/role` | 0 | session | skipped — no orgId |
| FAIL | POST | `/v1/organisation/team` | 400 | session | {"statusCode":400,"statusType":"BAD_REQUEST","message":"No active organization","data":{"code":"NO_ACTIVE_ORGANIZATION"}} |
| FAIL | GET | `/v1/organisation/team` | 400 | session | {"statusCode":400,"statusType":"BAD_REQUEST","message":"No active organization","data":{"code":"NO_ACTIVE_ORGANIZATION"}} |
| FAIL | POST | `/v1/organisation/team/:teamId/members` | 0 | session | skipped — missing teamId/userId |
| FAIL | DELETE | `/v1/organisation/team/members` | 0 | session | skipped — missing teamId/userId |
| PASS | POST | `/v1/user/2fa/enable` | 200 | session | 2FA enable started |
| PASS | POST | `/v1/user/2fa/disable` | 200 | session | 2FA disabled |
| PASS | GET | `/v1/user/accounts` | 200 | session | credential account has issuer |
| PASS | DELETE | `/v1/user/accounts/:provider (unknown)` | 404 | session | account not found |
| PASS | DELETE | `/v1/user/accounts/:provider (last credential)` | 400 | session | last account protected |
| PASS | GET | `/v1/user/sessions` | 200 | session | sessions listed |
| PASS | DELETE | `/v1/user/sessions?mode=others` | 200 | session | other sessions ended |
| PASS | POST | `/v1/billing/customer` | 503 | session | billing unavailable or error: {"statusCode":503,"statusType":"SERVICE_UNAVAILABLE","message":"Billing is not configured"} |
| PASS | GET | `/v1/admin/users (non-admin)` | 403 | admin | correctly blocked |
| PASS | GET | `/v1/admin/plans (non-admin)` | 403 | admin | correctly blocked |
| PASS | GET | `/v1/admin/roles (non-admin)` | 403 | admin | correctly blocked |
| PASS | POST | `/v1/auth/signin/email (as admin)` | 200 | auth | admin session acquired |
| PASS | GET | `/v1/admin/users` | 200 | admin | users listed |
| PASS | GET | `/v1/admin/plans` | 200 | admin | plans listed |
| PASS | GET | `/v1/admin/roles` | 200 | admin | roles listed |
| PASS | POST | `/v1/admin/roles` | 201 | admin | {"statusCode":201,"statusType":"CREATED","message":"Role created","data":{"id":"cmsy2jgwc00011d8ou4llqt7a","name":"custom_1787021576909","description":"e2e role","statements":{"use |
| PASS | POST | `/v1/admin/plans` | 201 | admin | {"statusCode":201,"statusType":"CREATED","message":"Plan created","data":{"id":"cmsy2jhgd00021d8o6393z05e","name":"E2E Plan 1787021576909","slug":"e2e-1787021576909","description": |
| PASS | POST | `/v1/admin/staff/invite` | 201 | admin | {"statusCode":201,"statusType":"CREATED","message":"Staff user created","data":{"user":{"name":"Staff E2E","email":"staff_1787021576909@example.com","emailVerified":false,"image":" |
| PASS | PATCH | `/v1/admin/settings/multi-session` | 200 | admin | setting updated |
| PASS | GET | `/v1/admin/users/:id` | 200 | admin | user loaded |
| PASS | PATCH | `/v1/admin/users/:id` | 200 | admin | user updated |
| PASS | PATCH | `/v1/admin/users/:id/password` | 200 | admin | password updated |
| PASS | GET | `/v1/admin/users/:id/sessions` | 200 | admin | sessions listed |
| PASS | DELETE | `/v1/admin/users/:id/sessions/:sessionId` | 200 | admin | session ended |
| PASS | POST | `/v1/admin/users/:id/impersonate` | 200 | admin | impersonation started |
| PASS | POST | `/v1/admin/impersonate/stop` | 200 | admin | impersonation stopped |
| PASS | POST | `/v1/admin/organisations` | 201 | admin | org created id=mkbe4jzojiqdot78wemold2u |
| PASS | GET | `/v1/admin/organisations/:id` | 200 | admin | org loaded |
| PASS | PATCH | `/v1/admin/organisations/:id` | 200 | admin | org updated |
| PASS | POST | `/v1/admin/teams` | 201 | admin | team created id=wdkpbmmm5zn1hpo252h7vlmw |
| PASS | GET | `/v1/admin/teams/:id` | 200 | admin | team loaded |
| PASS | PATCH | `/v1/admin/teams/:id` | 200 | admin | team updated |
| FAIL | POST | `/v1/admin/organisations/:id/members` | 0 | admin | skipped — missing org/user |
| PASS | GET | `/v1/admin/organisations/:id/members` | 200 | admin | members listed |
| FAIL | PATCH | `/v1/admin/organisations/:id/members/:memberId` | 0 | admin | skipped — missing member |
| PASS | POST | `/v1/admin/organisations/:id/invitations` | 201 | admin | invitation sent |
| PASS | GET | `/v1/admin/organisations/:id/invitations` | 200 | admin | invitations listed |
| PASS | DELETE | `/v1/admin/organisations/:id/invitations/:invitationId` | 200 | admin | invitation canceled |
| FAIL | POST | `/v1/admin/teams/:id/members` | 0 | admin | skipped — missing team/user |
| PASS | GET | `/v1/admin/teams/:id/members` | 200 | admin | team members listed |
| FAIL | DELETE | `/v1/admin/teams/:id/members/:userId` | 0 | admin | skipped — missing team/user |
| FAIL | DELETE | `/v1/admin/organisations/:id/members/:memberId` | 0 | admin | skipped — missing member |
| PASS | DELETE | `/v1/admin/teams/:id` | 200 | admin | team deleted |
| PASS | DELETE | `/v1/admin/organisations/:id` | 200 | admin | org deleted |
| FAIL | DELETE | `/v1/organisation/member/:memberId` | 0 | session | skipped — no memberId/orgId |
| PASS | POST | `/v1/user/2fa/verify` | 400 | session | {"statusCode":400,"statusType":"BAD_REQUEST","message":"TOTP not enabled","data":{"code":"TOTP_NOT_ENABLED"}} |
| PASS | POST | `/v1/user/sign/out` | 200 | session | signed out |

**Summary:** 53 passed, 14 failed
