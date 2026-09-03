# Schema

## Table by Table: Columns, Types, and Defaults

### `User`
Stores credentials and access permissions for clinic staff.
- `id`: `Int`, Primary Key, auto-incrementing (`@id @default(autoincrement())`).
- `email`: `String`, Unique (`@unique`), indexed. Staff login email.
- `passwordHash`: `String`. Bcrypt hash with salt rounds = 10.
- `role`: `Role` enum (`FRONT_DESK`, `PROVIDER`).
- `createdAt`: `DateTime`, default `now()`.
- `updatedAt`: `DateTime`, automatic timestamp update.

### `Provider`
Stores healthcare provider profiles linked 1:1 to a User with `PROVIDER` role.
- `id`: `Int`, Primary Key, auto-incrementing.
- `userId`: `Int`, Unique foreign key referencing `User(id)`.
- `name`: `String`. Display name (e.g. "Dr. Priya Sharma").
- `createdAt`: `DateTime`, default `now()`.
- `updatedAt`: `DateTime`.

### `Patient`
Stores patient demographic and contact information.
- `id`: `Int`, Primary Key, auto-incrementing.
- `name`: `String`. Full patient name.
- `email`: `String?`, Optional contact email.
- `phone`: `String?`, Optional contact phone.
- `createdAt`: `DateTime`, default `now()`.
- `updatedAt`: `DateTime`.

### `Appointment`
Unified entity representing both unbooked availability slots and booked clinical visits.
- `id`: `Int`, Primary Key, auto-incrementing.
- `providerId`: `Int`, Foreign Key referencing primary scheduling `Provider(id)`.
- `patientId`: `Int?`, Foreign Key referencing `Patient(id)`, nullable when slot is `AVAILABLE`.
- `startTime`: `DateTime`. Start timestamp of the appointment.
- `duration`: `Int`. Duration in minutes (e.g., 30, 45, 60).
- `status`: `AppointmentStatus` enum (`AVAILABLE`, `REQUESTED`, `CONFIRMED`, `CHECKED_IN`, `COMPLETED`, `NO_SHOW`, `CANCELLED`), default `AVAILABLE`.
- `archived`: `Boolean`, default `false`. When true, slot is removed from regular view without purging history.
- `createdAt`: `DateTime`, default `now()`.
- `updatedAt`: `DateTime`.

### `AppointmentSupport`
Join table modeling the care team (many-to-many relation between Appointments and Supporting Providers).
- `id`: `Int`, Primary Key, auto-incrementing.
- `appointmentId`: `Int`, Foreign Key referencing `Appointment(id)` with `onDelete: Cascade`.
- `providerId`: `Int`, Foreign Key referencing `Provider(id)` with `onDelete: Cascade`.
- `createdAt`: `DateTime`, default `now()`.
- Compound unique index: `@@unique([appointmentId, providerId])` prevents assigning the same supporting provider multiple times.

### `VisitNote`
Clinical observations recorded during or following an appointment.
- `id`: `Int`, Primary Key, auto-incrementing.
- `appointmentId`: `Int`, Foreign Key referencing `Appointment(id)`.
- `providerId`: `Int`, Foreign Key referencing authoring `Provider(id)`.
- `content`: `String` (Text). Clinical observation text.
- `createdAt`: `DateTime`, default `now()`.
- `updatedAt`: `DateTime`.

### `AppointmentHistory`
Append-only, immutable audit log for appointment lifecycle events.
- `id`: `Int`, Primary Key, auto-incrementing.
- `appointmentId`: `Int`, Foreign Key referencing `Appointment(id)`.
- `actorUserId`: `Int`, Foreign Key referencing `User(id)` who initiated the action.
- `type`: `AppointmentHistoryType` enum (`STATUS_CHANGE`, `SUPPORTING_PROVIDER_ADDED`, `SUPPORTING_PROVIDER_REMOVED`, `CANCELLATION`, `VISIT_NOTE_ADDED`).
- `oldStatus`: `AppointmentStatus?`, Previous status (for status changes / cancellations).
- `newStatus`: `AppointmentStatus?`, New status.
- `providerId`: `Int?`, Referenced provider ID (for care team events).
- `visitNoteId`: `Int?`, Referenced note ID (for visit note events).
- `reason`: `String?`, Mandatory cancellation reason or note excerpt.
- `createdAt`: `DateTime`, default `now()`.
- Compound index: `@@index([appointmentId, createdAt])` optimizes chronological audit retrieval.

### `AppointmentAlert`
Tracking record for unconfirmed appointment alerts.
- `id`: `Int`, Primary Key, auto-incrementing.
- `appointmentId`: `Int`, Unique Foreign Key referencing `Appointment(id)` with `onDelete: Cascade`.
- `dismissedAt`: `DateTime?`, Nullable timestamp of when front-desk dismissed the alert.
- `createdAt`: `DateTime`, default `now()`.
- `updatedAt`: `DateTime`.
- Index: `@@index([dismissedAt])`.

---

## One-to-Many vs Many-to-Many Relationships

- **One-to-One**:
  - `User ↔ Provider`: Each provider has exactly one user login, and each user login has at most one provider profile.
  - `Appointment ↔ AppointmentAlert`: Each appointment has at most one alert tracking entity.
- **One-to-Many**:
  - `Provider → Appointment`: A primary provider schedules many appointments.
  - `Patient → Appointment`: A patient can book multiple appointments.
  - `Appointment → VisitNote`: An appointment contains multiple sequential visit notes.
  - `Appointment → AppointmentHistory`: An appointment possesses an append-only sequence of historical audit events.
  - `User → AppointmentHistory`: A staff member authors multiple audit entries across appointments.
- **Many-to-Many**:
  - `Appointment ↔ Provider (Care Team)`: An appointment can include multiple supporting providers, and a provider can participate in multiple appointments. This is explicitly normalized through the `AppointmentSupport` join table with a compound unique key `(appointmentId, providerId)`.

---

## Database vs Application Constraints

| Constraint | Enforcement Layer | Rationale |
|---|---|---|
| Referential integrity (FKs) | **Database** | Guarantees orphaned notes, alerts, or history records cannot exist. |
| Unique staff emails | **Database** | Unique index prevents duplicate accounts at the storage level. |
| Duplicate Care Team assignments | **Database** | Unique compound index `(appointmentId, providerId)` prevents race conditions when multiple staff assign supporting providers simultaneously. |
| Status transition state machine | **Application Code** | Legal moves (`Requested → Confirmed → Checked In → Completed`) require rich contextual validation and domain-specific rejection messages returned over HTTP. |
| No-Show temporal lock | **Application Code** | Verifying whether the appointment's scheduled time has already passed requires evaluating against `new Date()`. Wall-clock comparisons belong in application logic. |
| Post-Check-In cancellation ban | **Application Code** | Enforced in route handlers before executing database transactions to prevent legal cancellations once a patient is in clinical care. |
| Slot collision prevention | **Application Code** | Overlapping time intervals are validated before record creation, returning specific slot conflict diagnostics for front-desk scheduling. |

---

## Deliberate Denormalisation

1. **Normalized Entity Separation**: We deliberately did **not** denormalize provider names or patient details into the `Appointment` table. Storing foreign keys (`providerId`, `patientId`) ensures changes to patient contact details or doctor credentials propagate immediately without risk of data drift.
2. **Scalar Snapshot References in `AppointmentHistory`**: In `AppointmentHistory`, we deliberately stored raw IDs (`providerId`, `visitNoteId`) and text snapshot values (`reason`, `oldStatus`, `newStatus`) rather than hard foreign-key cascades. If a supporting provider is later removed from an appointment or a patient is archived, the audit log preserves what actually occurred at that moment in time without breaking foreign key cascades.

---

## What Would Break First at 100x the Data?

1. **Patient Search Performance**:
   - Current query uses Prisma's `contains: searchText, mode: 'insensitive'` (`ILIKE %search%`).
   - At 100x data (e.g. 500,000+ patients), leading-wildcard queries bypass B-tree indexes, forcing costly sequential table scans.
   - **Fix**: Introduce a PostgreSQL `pg_trgm` GIN/GiST index on `Patient(name)`.
2. **Dashboard No-Show Rate Aggregation**:
   - The current implementation fetches all non-available visits across the past 8 weeks into memory and filters them into week buckets in Node.js.
   - At 100x volume (hundreds of thousands of visits), this would cause memory exhaustion and slow response times.
   - **Fix**: Offload computation directly to PostgreSQL using `date_trunc('week', start_time)` with `FILTER (WHERE status = 'NO_SHOW')` in a single SQL aggregation query.
3. **Slot Collision Detection Under Concurrent Writes**:
   - Collision detection currently selects active appointments for a provider and evaluates overlap in application memory.
   - Under heavy concurrent booking by multiple front-desk terminals, two requests could check concurrently and both insert, causing double bookings.
   - **Fix**: Implement PostgreSQL exclusion constraints using GiST and range types:
     ```sql
     ALTER TABLE "Appointment" ADD CONSTRAINT no_overlapping_slots
     EXCLUDE USING gist (provider_id WITH =, tsrange(start_time, start_time + duration * interval '1 minute') WITH &&)
     WHERE (archived = false AND status != 'CANCELLED');
     ```
