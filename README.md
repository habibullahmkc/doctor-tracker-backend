# Doctor Tracker — Backend API

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
├── utils/         # AppError, pagination, search helpers
├── scripts/       # seed script
├── routes.ts      # mounts module routers under /api
├── app.ts         # express app (no listen — testable)
└── server.ts      # db connect + listen + graceful shutdown
```

## API

| Method | Endpoint        | Description                          |
| ------ | --------------- | ------------------------------------ |
| GET    | `/api/health`   | Liveness + database connectivity     |

_More endpoints are documented as modules are added._

### Response format

```json
{ "success": true, "data": {}, "pagination": { "page": 1, "limit": 10, "total": 100, "totalPages": 10 } }
```

```json
{ "success": false, "message": "Validation failed", "errors": [{ "field": "email", "message": "Invalid email" }] }
```

## Deployment (Render)

This repo includes a `render.yaml` blueprint. Build command: `npm ci --include=dev && npm run build`,
start command: `npm start`, health check: `/api/health`.

> Hosted on Render's free tier — the first request after inactivity may take ~50 seconds.
