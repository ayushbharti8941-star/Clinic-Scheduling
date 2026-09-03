# Submission

## Links

- **GitHub repository:** https://github.com/ayushbharti8941-star/Clinic-Scheduling
- **Live application:** https://clinic-scheduling-sigma.vercel.app

*(Note: If your live URL differs, replace the link above with your active Vercel deployment URL).*

## Notes for the reviewer

- **Cold Starts on Free Tier**: The backend is deployed on Render's free tier web service. When idle, the container enters sleep mode. Please allow **45–60 seconds** on the very first login or request for the container to wake up. Subsequent requests will be fast and responsive.
- **Pre-Seeded Data**: The PostgreSQL database on Neon has been seeded with realistic providers, patients, upcoming visits, past visits, and historical visit notes. Quick-login buttons on the sign-in card allow one-click switching between Front Desk, Dr. Priya, and Dr. Arjun.

## Demo credentials

| Role | Email | Password |
|------|-------|----------|
| Front Desk | `frontdesk@clinic.com` | `password123` |
| Primary Provider (Dr. Priya Sharma) | `provider@clinic.com` | `password123` |
| Supporting Provider (Dr. Arjun Mehta) | `provider2@clinic.com` | `password123` |

## Stack

| Layer | What you used | Why |
|-------|---------------|-----|
| Frontend | React 19 + Vite | Instant HMR development, lean production bundle (< 70KB gzip), clean component structure without framework bloat. |
| Backend | Node.js + Express 5 | Lightweight, highly predictable REST middleware architecture with JWT stateless session handling and expressive validation error responses. |
| Database | PostgreSQL (Neon) + Prisma ORM 7 | Strong ACID compliance, relational referential integrity for care teams and audit logs, type-safe queries, and atomic transaction primitives (`$transaction`). |
| Hosting | Vercel (Client) + Render (Server) | Free-tier compatible setup with static Edge CDN caching for the client and automated GitHub CI/CD container deployments for the API. |

## Goal checklist

| # | Goal | Status | Notes |
|---|------|--------|-------|
| 1 | Accounts and roles | Done | Front-desk staff manage clinic-wide schedules, confirm appointments, and reassign appointments between providers. Providers only manage their own appointments. Providers are strictly blocked from reassigning appointments away from themselves (HTTP 403). |
| 2 | Appointment slots | Done | Supports single slot creation, unbooked slot editing (duration & start time), soft archiving and restoring without record loss, and requesting slots for existing or new patients. |
| 3 | Visit notes | Done | Both primary scheduling providers and supporting providers on the care team can author visit notes. Only the authoring provider is permitted to edit their own note (HTTP 403 for others). |
| 4 | Appointment status | Done | Complete server-enforced lifecycle (`AVAILABLE → REQUESTED → CONFIRMED → CHECKED_IN → COMPLETED`, `NO_SHOW`, `CANCELLED`). Cancellations are locked once checked in; no-shows can only be marked on confirmed visits after the scheduled time has passed. |
| 5 | Care team | Done | Primary provider can add/remove supporting providers. Supporting providers cannot be added twice. Providers have a combined schedule view showing visits where they are primary or supporting. |
| 6 | Finding appointments | Done | Server-side text search on patient name, filters for provider, status, and date range (`from`/`to`), sorting by date, status, or provider, and page-based pagination. |
| 7 | Bulk availability and export | Done | Weekly pattern generation over date ranges skipping time conflicts with summary reporting. RFC 4180 compliant single-day CSV export of clinic schedule. |
| 8 | Dashboard | Done | Headline counters (today's appointments, currently checked-in, weekly no-shows, upcoming confirmed), breakdowns by provider and status, and a responsive SVG bar chart visualizing the 8-week weekly no-show rate. |
| 9 | History you cannot rewrite | Done | Append-only immutable `AppointmentHistory` audit log recording actor email, role, event type, status transitions, and cancellation reasons. Visible in the interactive appointment timeline. |
| 10 | Unconfirmed appointments | Done | Alerts banner and header badge for requested visits within 24 hours of scheduled time. Front-desk dismiss action hides the alert until the final 1 hour before appointment time. Includes quick confirm action. |

## How much time did you actually spend?

Approximately **14 hours** across 5 focused engineering sessions (including database schema design, state machine business rules, bulk tools, UI dashboard visualization, automated end-to-end test verification, and documentation).

## What would you do next, with another 12 hours?

1. **Real-Time Multi-Terminal Sync (WebSockets / SSE)**: Implement live event broadcasting so when a front-desk coordinator checks in a patient or confirms a slot, the provider's screen and alert count update instantly without manual refreshing.
2. **Automated Patient Notifications (Twilio / SendGrid)**: Send automated SMS/email confirmation links to patients 24 hours before their visit, allowing patients to confirm or cancel directly via an authenticated token link.
3. **Database-Level Exclusion Constraints (`tsrange`)**: Replace application-level collision checks with PostgreSQL GiST exclusion constraints to guarantee zero double-bookings under extreme concurrent write loads.
4. **Patient Waitlist Engine**: Allow front-desk staff to queue patients for popular time slots; when a cancellation occurs, the system automatically surfaces waitlisted patients.

## What are you least happy with in this codebase, and why?

1. **In-memory slot collision checking**: In `bulk-availability` and single slot creation, overlapping appointments are verified by fetching existing bookings for the provider into memory and comparing intervals. While completely effective for standard traffic, under heavy concurrent front-desk booking, two transactions could theoretically pass the select check simultaneously. A database-level exclusion constraint (`tsrange` with GiST) would provide ironclad concurrency safety.
2. **Single-file React components**: All frontend components (`Dashboard`, `AppointmentDetail`, `AlertsBanner`, modals) currently reside in `client/src/App.jsx`. While convenient for rapid prototyping and state sharing, a production application should separate them into dedicated files under `client/src/components/` with custom hooks for API calls.
