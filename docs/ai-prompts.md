# AI Prompts

The following prompts document the progression of AI-assisted engineering for the clinic scheduling system, grouped chronologically by development goal.

---

## 1. Domain Modeling and Schema Design (Goals 1 & 2)

### Prompt
> "Design a Prisma schema for a multi-provider clinic scheduling system. It needs Users (Front Desk and Provider roles), Providers, Patients, Appointments, Care Team supporting providers (many-to-many), Visit Notes, an immutable Appointment History audit log, and an unconfirmed alerts table. Appointments should support statuses: AVAILABLE, REQUESTED, CONFIRMED, CHECKED_IN, COMPLETED, NO_SHOW, CANCELLED."

### What you got
A comprehensive schema definition with foreign keys, enums, and timestamps for each entity.

### What you corrected
- Added a compound unique index `@@unique([appointmentId, providerId])` on the `AppointmentSupport` join table to prevent duplicate provider assignments on care teams.
- Added `archived: Boolean @default(false)` to `Appointment` so slots can be hidden from view without destructive deletions that would orphan audit history.

---

## 2. Business Logic and State Machine Enforcement (Goal 4)

### Prompt
> "Implement the appointment lifecycle endpoints in Express using Prisma transactions. We need: confirm, check-in, complete, mark no-show, and cancel with reason. Enforce that cancellations cannot happen after check-in, and no-shows can only be marked on confirmed appointments after the scheduled time has passed."

### What you got
Route handlers for `PATCH /:id/confirm`, `/:id/check-in`, `/:id/complete`, `/:id/no-show`, and `/:id/cancel`.

### What you corrected
- The generated `no-show` handler used a simple string comparison on ISO dates (`appointment.startTime <= now.toISOString()`). We changed this to JavaScript date object comparison `appointment.startTime <= new Date()` to handle timezone offsets accurately.
- Wrapped each status change and its corresponding `AppointmentHistory` creation inside an atomic `prisma.$transaction` block so history records can never fail while status updates succeed.

---

## 3. Bulk Availability and Collision Avoidance (Goal 7)

### Prompt
> "Write an endpoint `POST /api/appointments/bulk-availability` that generates recurring weekly appointment slots for a given provider between a start date and an end date. It receives a list of weekly slots with dayOfWeek, startTime, and duration. It should skip any slots that collide with existing uncancelled appointments and return a summary of created versus skipped slots."

### What you got
A route handler iterating through calendar days and inserting non-overlapping slots.

### What you corrected
- The generated code compared times using UTC day-of-week methods which caused date drift depending on server timezone. We normalized the date iteration to ensure day 0 = Sunday through day 6 = Saturday matched the clinic's local operating hours.
- Added conflict checks not only against existing database appointments but also within the newly generated batch itself in case the user specified overlapping blocks on the same day.

---

## 4. Appointment History Query (Goal 9) — PROMPT THAT PRODUCED AN ERROR

### Prompt
> "Write the `GET /api/appointments/:id/history` endpoint to return the complete audit trail for an appointment, ordered chronologically, including actor email and role, provider details, and visit note content."

### What you got
```javascript
const history = await prisma.appointmentHistory.findMany({
  where: { appointmentId },
  orderBy: { createdAt: "asc" },
  include: {
    actor: { select: { id: true, email: true, role: true } },
    provider: { select: { id: true, name: true } },
    visitNote: { select: { id: true, content: true, provider: true } }
  }
});
```

### What was wrong
The query immediately failed during test execution with:
`PrismaClientValidationError: Unknown field provider for include statement on model AppointmentHistory`.
Because `AppointmentHistory` in `schema.prisma` only stores scalar IDs (`providerId Int?`, `visitNoteId Int?`) and does not define explicit Prisma relation fields for `provider` or `visitNote`, Prisma threw a fatal query validation error.

### What you corrected
Rather than altering the live production database schema or risking migration desynchronization, we restructured the route handler:
1. Fetch `AppointmentHistory` including only the verified `actor` relation.
2. Collect distinct non-null `providerId` and `visitNoteId` values from the returned list.
3. Fetch the referenced providers and visit notes in parallel single queries (`prisma.provider.findMany`, `prisma.visitNote.findMany`).
4. Map the related entities into the final JSON payload in JavaScript before returning to the client. This restored full data richness with zero errors.

---

## 5. Visual Dashboard and Alert Engine (Goals 8 & 10)

### Prompt
> "Create the dashboard endpoint returning today's appointment count, currently checked-in count, weekly no-shows, upcoming confirmed visits, and an 8-week weekly no-show rate array. Also build the frontend SVG visualization for the 8-week trend."

### What you got
The backend aggregation logic and an SVG bar chart rendered in React.

### What you corrected
- The initial weekly no-show calculation divided no-shows by total appointments including unbooked `AVAILABLE` slots, artificially depressing the rate. We filtered the denominator to count only scheduled/attended visits (`CONFIRMED`, `CHECKED_IN`, `COMPLETED`, `NO_SHOW`).
- Enhanced the SVG chart with dynamic Y-axis scale markers, percentage tooltips, and responsive coordinate mapping.
