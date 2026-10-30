# Doctor Tracker — Backend API

[![CI](https://github.com/habibullahmkc/doctor-tracker-backend/actions/workflows/ci.yml/badge.svg)](https://github.com/habibullahmkc/doctor-tracker-backend/actions/workflows/ci.yml)

REST API for **Doctor Tracker**, a secure admin portal for managing doctors and their patients.
**Live API:** https://doctor-tracker-api-evvz.onrender.com/api/health · **Frontend:** https://doctor-tracker-psi.vercel.app

Built with **Node.js, Express 5, TypeScript, MongoDB (Mongoose) and Zod**.

> The full project documentation (architecture, technical decisions, screenshots) lives in the
> [frontend repository README](https://github.com/habibullahmkc/doctor-tracker-frontend).

## Tech Stack

| Concern        | Choice                                   |
| -------------- | ---------------------------------------- |
| Runtime        | Node.js 22, TypeScript                   |
| Framework      | Express 5 (native async error handling)  |
| Database       | MongoDB Atlas + Mongoose                 |
| Validation     | Zod (env, body, params, query)           |
| Auth           | JWT in HttpOnly cookie, bcrypt hashing   |
| Security       | helmet, CORS allow-list, rate limiting   |

## Setup Guide

```bash
git clone https://github.com/habibullahmkc/doctor-tracker-backend.git
cd doctor-tracker-backend
npm install
cp .env.example .env      # then fill in the values
npm run dev               # http://localhost:5000/api/health
```

### Scripts

| Script              | Description                          |
| ------------------- | ------------------------------------ |
| `npm run dev`       | Start dev server with hot reload     |
| `npm run build`     | Compile TypeScript to `dist/`        |
| `npm start`         | Run the compiled server              |
| `npm run seed`      | Reset DB with demo admin + data      |
| `npm run typecheck` | Type-check without emitting          |
| `npm run lint`      | Biome lint + format check            |
| `npm test`          | 31 unit tests (`node:test`, no DB needed) |
| `npm run test:e2e`  | 70-check end-to-end suite against a running API (`BASE_URL`, default `http://localhost:5000`) |

CI (GitHub Actions) runs lint, typecheck, unit tests and the build on every push.

### Environment Variables

| Variable          | Description                                              |
| ----------------- | -------------------------------------------------------- |
| `NODE_ENV`        | `development` or `production`                            |
| `PORT`            | Port to listen on (default `5000`)                       |
| `MONGODB_URI`     | MongoDB connection string incl. database name            |
| `JWT_SECRET`      | Min 32 chars. Must match the frontend's `JWT_SECRET`     |
| `JWT_EXPIRES_IN`  | Token lifetime, e.g. `1d`                                |
| `CLIENT_URL`      | Allowed frontend origin(s), comma-separated              |

All variables are validated at startup; the server refuses to boot with a clear message if any are missing.

## Project Structure

```
src/
├── config/        # env validation, database connection
├── constants/     # shared enums (specializations, conditions, ...)
├── middleware/    # auth, validation, error handling, 404
├── modules/       # feature modules: auth, doctors, patients, dashboard
├── utils/         # AppError, pagination, search tokens, Dhaka dates, TTL cache, fast counts
├── scripts/       # seed script
├── routes.ts      # mounts module routers under /api
├── app.ts         # express app (no listen — testable)
└── server.ts      # db connect + listen + graceful shutdown
test/
├── unit/          # node:test unit tests (no database)
└── e2e/           # end-to-end API suite (needs a running API)
```

## API

All endpoints except `/api/health` and `/api/auth/login` require the `token` HttpOnly cookie.

| Method | Endpoint                     | Description                                              |
| ------ | ---------------------------- | -------------------------------------------------------- |
| GET    | `/api/health`                | Liveness + database connectivity                         |
| POST   | `/api/auth/login`            | Sign in, sets HttpOnly cookie (10 failed attempts / 15 min per IP + email) |
| POST   | `/api/auth/logout`           | Clear the session cookie                                 |
| GET    | `/api/auth/me`               | Current admin                                            |
| GET    | `/api/doctors`               | List doctors (search, filter, sort, paginate) + patient counts |
| POST   | `/api/doctors`               | Create doctor                                            |
| GET    | `/api/doctors/filters`       | Specializations + hospitals for filter dropdowns         |
| GET    | `/api/doctors/options`       | Lightweight doctor list for select inputs                |
| GET    | `/api/doctors/:id`           | Doctor details + patient count by status                 |
| PATCH  | `/api/doctors/:id`           | Update doctor                                            |
| DELETE | `/api/doctors/:id`           | Delete doctor **and their patients** (transaction)       |
| GET    | `/api/doctors/:id/patients`  | The doctor's patients (same query params as patients)    |
| POST   | `/api/doctors/:id/patients`  | Add a patient under the doctor                           |
| GET    | `/api/patients`              | List patients (search, filter, sort, paginate)           |
| POST   | `/api/patients`              | Create patient (`doctor` in body)                        |
| GET    | `/api/patients/:id`          | Patient details                                          |
| PATCH  | `/api/patients/:id`          | Update patient (incl. reassigning doctor)                |
| DELETE | `/api/patients/:id`          | Delete patient                                           |
| GET    | `/api/dashboard/stats`       | Totals, admissions trend (`?range=7d\|30d\|12m`), status / condition / specialization breakdowns, top doctors, recent admissions, 8-month trends |

### Query parameters

| Endpoint         | Params                                                                                         |
| ---------------- | ---------------------------------------------------------------------------------------------- |
| `GET /doctors`   | `page`, `limit` (≤100), `search`, `specialization`, `hospital`, `from`, `to` (joined, `YYYY-MM-DD`), `sort` = `newest\|oldest\|name` |
| `GET /patients`  | `page`, `limit` (≤100), `search` (name/phone/email), `condition`, `status`, `gender`, `doctor`, `from`, `to` (admission date), `sort` = `newest\|oldest\|name` |

Dates are interpreted in Bangladesh time (Asia/Dhaka); `to` is inclusive.

### Response format

```json
{ "success": true, "data": {}, "pagination": { "page": 1, "limit": 10, "total": 100, "totalPages": 10 } }
```

```json
{ "success": false, "message": "Validation failed", "errors": [{ "field": "email", "message": "Invalid email" }] }
```

## Data Model & Indexes

`doctors` and `patients` are separate collections; each patient references its doctor by `doctor: ObjectId`
(no embedded arrays to keep in sync). Compound indexes follow the **Equality → Sort → Range** rule.

| Collection | Index                              | Serves                                          |
| ---------- | ---------------------------------- | ----------------------------------------------- |
| admins     | `email` (unique)                   | login lookup                                    |
| doctors    | `email` (unique)                   | duplicate protection                            |
| doctors    | `searchTokens`                     | prefix search on name / hospital / specialization / email |
| doctors    | `createdAt`                        | default sort, joined-date filter                |
| doctors    | `specialization, createdAt`        | specialization filter + sort                    |
| doctors    | `hospital, createdAt`              | hospital filter + sort, `distinct("hospital")`  |
| patients   | `doctor, admissionDate`            | a doctor's patients, per-doctor counts          |
| patients   | `condition, admissionDate`         | condition filter + sort                         |
| patients   | `status, admissionDate`            | status filter + sort                            |
| patients   | `admissionDate`                    | default sort, date filter, admissions trend     |
| patients   | `searchTokens`                     | prefix search on name / phone / email           |

**Search.** Unanchored `/term/i` regexes scan the whole collection, and `$text` only matches whole words
("sar" ≠ "Sarah"). Each document stores lower-cased `searchTokens`; anchored prefix regexes (`^sar`) on that
multikey index give search-as-you-type on any word while still using the index. User input is regex-escaped.

**Explain-plan evidence** (seeded data):

```
doctors search 'sar'          IXSCAN(searchTokens_1)                    docsExamined=1  returned=1
doctors specialization+sort   IXSCAN(specialization_1_createdAt_-1)     docsExamined=4  returned=4
patients condition+sort       IXSCAN(condition_1_admissionDate_-1)      docsExamined=10 returned=10
patients of doctor+sort       IXSCAN(doctor_1_admissionDate_-1)         docsExamined=7  returned=7
```

**Caching.** Dashboard stats (per range) and filter options are held in an in-process TTL cache (60 s / 5 min).
Concurrent requests share one in-flight computation, and every doctor or patient write invalidates the cache, so the
numbers are never stale. With several API instances this moves to Redis behind the same interface. Unfiltered list
totals use `estimatedDocumentCount()`, and responses are gzip-compressed.

**Other query patterns:** `find` + `countDocuments` run in parallel with `.lean()`; patient counts for a page of
doctors come from one `$in` + `$group` query (no N+1); the dashboard runs its aggregations concurrently and uses
`estimatedDocumentCount()` for totals.

## Seed Data

`npm run seed` wipes the database and creates a demo admin (`admin@doctortracker.com` / `Admin@123`),
25 doctors across 10 specializations and 9 Bangladeshi hospitals, and 450 patients. Patient conditions match
their doctor's specialization and admissions trend upward over 12 months, so the dashboard is meaningful.
The generator is deterministic (seeded PRNG).

## Security

- Passwords hashed with bcrypt. Unknown emails still run a bcrypt compare, so response time doesn't reveal which accounts exist.
- JWT stored in an **HttpOnly, Secure, SameSite=Lax** cookie. The frontend proxies `/api/*` on its own origin, so the cookie is first-party.
- `helmet` security headers, a CORS allow-list (`CLIENT_URL`), and `trust proxy` for correct client IPs behind Render.
- Login rate limit counts only **failed** attempts, so users sharing the proxy's IP are never locked out by successful sign-ins.
- Every input (body, params, query, env) is validated with Zod, and all errors go through one central handler that returns the same JSON shape.

## Deployment (Render)

This repo includes a `render.yaml` blueprint. Build command: `npm ci --include=dev && npm run build`,
start command: `npm start`, health check: `/api/health`.

> Hosted on Render's free tier — the first request after inactivity may take ~50 seconds.
