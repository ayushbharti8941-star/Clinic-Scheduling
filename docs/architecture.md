# Architecture

## What are the moving pieces, and how do they talk to each other?

The system is structured as a decoupled client-server architecture with three primary components:

1. **Frontend (Browser SPA)**: A single-page application built with React and Vite. It maintains minimal client state, acting primarily as a responsive view layer over server data. All data mutations and state queries communicate with the backend via a lightweight asynchronous API client using standard HTTP JSON REST requests (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`).
2. **Backend API (Express / Node.js)**: A stateless REST service responsible for business logic execution, authentication, role authorization, domain validation, and schedule coordination. Incoming requests pass through security middleware (`cors`, `express.json`, `authenticateToken`, `requireRole`) before reaching route controllers.
3. **Database (PostgreSQL + Prisma ORM)**: A relational database running PostgreSQL accessed through Prisma Client. Prisma provides type safety, relational query abstraction, foreign key integrity, and atomic transactions (`prisma.$transaction`) for multi-step operations like status changes and audit log insertion.

Authentication is handled statelessly using JSON Web Tokens (JWT). When a user logs in, the server signs an 8-hour token containing `userId` and `role`. The client caches this token in `localStorage` and includes it in the `Authorization: Bearer <token>` header on subsequent requests.

## Where does each piece run?

- **Browser / Client**: Executes entirely in the user's browser, deployed and served as optimized static assets via **Vercel's Global Edge CDN**.
- **Backend API**: Runs as a long-lived Node.js runtime container on **Render** (free tier web service).
- **Database**: Hosted on **Neon Serverless PostgreSQL** (AWS `us-east-2`), maintaining high-availability managed connection pooling.

## What is the request path for one representative user action, end to end?

**Representative Action: Front-desk staff confirms an unconfirmed appointment (`PATCH /api/appointments/:id/confirm`)**

1. **User Action**: A front-desk staff member clicks the "Confirm Appointment" button on a requested appointment card in the UI.
2. **Client Dispatch**: The React event handler calls `api('/api/appointments/4/confirm', { method: 'PATCH' })`. The `api` helper reads the JWT from `localStorage` and issues a `PATCH` request to the backend with `Authorization: Bearer <token>`.
3. **Authentication Middleware**: `authenticateToken` extracts the Bearer token, verifies its signature using `JWT_SECRET`, checks expiration, and attaches the decoded payload `{ id: 1, role: 'FRONT_DESK' }` to `req.user`.
4. **Authorization & Domain Validation**:
   - The route handler checks `req.user.role`. Because the role is `FRONT_DESK`, it permits action across any provider's schedule (if it were a `PROVIDER`, it would verify that the provider is on the appointment's care team).
   - It queries PostgreSQL via Prisma to ensure appointment `4` exists and verifies that `appointment.status === 'REQUESTED'`. If the appointment is already confirmed, checked in, or cancelled, it rejects the move with an HTTP 400 status and an explanatory error message.
5. **Atomic Database Transaction**:
   - The handler opens `prisma.$transaction(async (tx) => { ... })`.
   - Update 1: Updates `Appointment` record `4`, setting `status: 'CONFIRMED'`.
   - Update 2: Appends an immutable audit event to `AppointmentHistory` with `appointmentId: 4`, `actorUserId: 1`, `type: 'STATUS_CHANGE'`, `oldStatus: 'REQUESTED'`, `newStatus: 'CONFIRMED'`.
6. **Response**: The server responds with HTTP 200 and the updated appointment JSON payload.
7. **Client Re-render**: The client receives the response, shows a success toast, refreshes the appointment detail state, re-fetches the active alerts count (which removes the appointment from the unconfirmed alert queue), and updates the status badge to `CONFIRMED`. The action toolbar dynamically updates to display "Check In Patient" and "Mark No-Show".

## What did you decide *not* to build, and why?

1. **WebSockets / Persistent Server-Sent Events (SSE)**: We considered adding WebSocket connections for live alert badges and schedule updates. We rejected this because free-tier serverless and hobby hosting providers (such as Render) idle after inactivity and terminate persistent TCP sockets. Relying on clean, deterministic HTTP REST endpoints with request-driven cache invalidation is significantly more resilient on cloud free tiers.
2. **Heavy Global State Library (Redux / MobX)**: We deliberately rejected Redux or Zustand. The source of truth for a medical schedule belongs on the server, not in client memory. Complex client-side caches easily drift out of sync when multiple front-desk staff operate simultaneously. Using localized component state with server-driven re-fetching guarantees freshness.
3. **Soft-Deletion across all tables**: We rejected generic soft deletion for Patients and Providers. Instead, soft archiving was strictly scoped to appointment slots (`Appointment.archived`), ensuring that historical records, patient profiles, and medical visit notes can never be accidentally orphaned or purged.
