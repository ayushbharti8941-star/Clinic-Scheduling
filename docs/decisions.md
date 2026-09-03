# Decisions

Log of key engineering decisions that shaped the clinic scheduling architecture, weighing trade-offs and alternatives.

---

## Decision 1: Unified Appointment Entity vs. Separate Slot and Booking Tables

- **Chose:** Modeling unbooked availability slots and booked visits in a single `Appointment` table with a state column (`status: AVAILABLE`, `REQUESTED`, `CONFIRMED`, etc.) and a nullable `patientId`.
- **Rejected:** Creating two distinct tables: a `Slot` table for doctor availability and an `Appointment` table for patient bookings.
- **Why:** In clinic operations, availability and bookings are different states of the exact same resource (a doctor's time block). When an appointment is cancelled, it can revert or be archived without moving records across tables. Having a single table drastically simplifies collision detection, foreign keys for notes, care teams, and calendar search, eliminating synchronization bugs between two tables.

---

## Decision 2: Application-Managed Audit Log vs. Database Triggers

- **Chose:** Writing audit events to `AppointmentHistory` explicitly within Prisma transactions (`prisma.$transaction`) in application code.
- **Rejected:** PostgreSQL database-level `AFTER INSERT OR UPDATE` triggers with `pg_audit` or PL/pgSQL.
- **Why:** Database triggers lack application context: they cannot easily capture who the logged-in user was (the JWT actor), the user's business intent (e.g., distinguishing an automated system transition from a manual cancellation with a specific reason string), or return rich validation error messages directly back to the API client. Explicit transactional writes ensure the actor, metadata, and reason are recorded atomically with zero magic.

---

## Decision 3: Server-Side Query Execution vs. Client-Side In-Memory Filtering

- **Chose:** Executing search query filtering, provider/status filters, date ranges, multi-column sorting, and pagination entirely inside PostgreSQL via Prisma queries (`/api/appointments/search`).
- **Rejected:** Fetching all clinic appointments on page load and filtering/sorting them in browser memory using JavaScript array methods.
- **Why:** While in-memory client filtering is easier for a few dozen test records, real clinics generate hundreds of appointments every week. Client-side filtering causes severe performance degradation on mobile devices, consumes unnecessary bandwidth, and fails completely once the dataset exceeds a single page. Server-side pagination ensures constant-time response regardless of total clinic history.

---

## Decision 4: Lightweight Inline SVG Visualizations vs. Heavy External Charting Libraries

- **Chose:** Rendering the 8-week weekly no-show rate bar chart as a responsive, server-driven SVG element directly in React.
- **Rejected:** Pulling in heavy client charting dependencies such as `Chart.js`, `Recharts`, or `D3.js`.
- **Why:** The 8-week weekly no-show chart has a specific, well-defined operational purpose: visualizing the percentage trend of no-shows over the last 8 weeks. Adding large charting libraries adds 150KB–400KB to the JavaScript bundle, introduces dependency vulnerabilities, and complicates styling. An inline SVG with dynamic `<rect>` and `<text>` elements takes under 60 lines of code, loads instantly, matches the application's color tokens perfectly, and renders with zero dependencies.

---

## Decision 5: Front-Desk Appointment Confirmation Permission

- **Chose:** Allowing both `FRONT_DESK` staff and the appointment's providers to confirm requested appointments.
- **Rejected:** Restricting appointment confirmation exclusively to healthcare providers (`requireRole("PROVIDER")`).
- **Why:** We initially hypothesized that doctors should review and approve visits before they are locked into the schedule.
- **Later reversed:** When reviewing Goal 1 and Goal 4 requirements ("front-desk staff manage availability and bookings" and "confirming appointments drifting toward no-shows"), we realized that in small medical practices, patients confirm appointments by calling or texting the front desk. Forcing front-desk staff to wait for a doctor between patient consultations creates an administrative bottleneck and leaves slots in limbo. We reversed the initial `requireRole("PROVIDER")` constraint to permit both `FRONT_DESK` and assigned providers to execute confirmation.
