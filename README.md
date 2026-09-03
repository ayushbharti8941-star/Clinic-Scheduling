# Clinic Scheduling System

A full-stack clinic appointment scheduling system built as a take-home assignment. The application supports role-based access for front-desk staff and healthcare providers, appointment scheduling and lifecycle management, visit notes, care-team collaboration, search, recurring availability, CSV export, alerts, appointment history, and a dashboard.

## Tech Stack

### Frontend

* React
* Vite
* CSS
* JavaScript

### Backend

* Node.js
* Express.js
* JWT Authentication
* bcryptjs

### Database

* PostgreSQL
* Prisma ORM

---

# Features

## 1. Authentication and Role-Based Authorization

The system supports two roles:

* **FRONT_DESK**
* **PROVIDER**

Authentication is handled using JWT tokens. Authorization is enforced server-side so that users can only perform actions allowed for their role.

Examples:

* Providers can manage their own appointment slots.
* Front-desk staff can request appointments and check in patients.
* Providers can only access appointments on their own schedule or care team where applicable.

---

## 2. Appointment Slot Management

Providers can:

* Create appointment slots.
* Edit unbooked appointment slots.
* Archive appointment slots.
* Restore archived appointment slots.

Each appointment slot contains:

* Provider
* Start time
* Duration
* Status
* Archive status

Available slots use the `AVAILABLE` status.

---

## 3. Appointment Requests

Front-desk staff can request an available appointment for a patient.

When an appointment is requested:

```text
AVAILABLE → REQUESTED
```

The patient is associated with the appointment, and the event is recorded in appointment history.

---

## 4. Appointment Status Workflow

Appointments follow a controlled lifecycle:

```text
AVAILABLE
    ↓
REQUESTED
    ↓
CONFIRMED
    ↓
CHECKED_IN
    ↓
COMPLETED
```

Additional outcomes include:

* `NO_SHOW`
* `CANCELLED`

Supported actions:

* Request appointment
* Confirm appointment
* Check in patient
* Complete appointment
* Mark appointment as no-show
* Cancel appointment

Invalid status transitions are rejected by the backend.

Cancellation requires a reason and is not allowed after check-in.

---

## 5. Visit Notes

Providers can create visit notes for appointments on their schedule.

Features include:

* Create a visit note.
* View appointment notes chronologically.
* Edit notes.
* Only the provider who created a note can edit it.

Creating a visit note also creates an immutable appointment history event.

---

## 6. Care Team / Supporting Providers

Appointments have a primary scheduling provider and can also include supporting providers.

Authorized users can:

* Add supporting providers.
* Remove supporting providers.
* View appointments involving their care team.

The scheduling provider cannot be added as a supporting provider, and duplicate supporting-provider assignments are prevented.

---

## 7. Search, Filtering, Sorting and Pagination

Appointments can be searched and filtered using query parameters.

Supported filters include:

* Patient name
* Provider
* Appointment status
* Date range

Supported sorting includes:

* Date
* Provider
* Status

Pagination is also supported with configurable page and page size parameters.

Example:

```text
GET /appointments/search?q=john&status=CONFIRMED&page=1&pageSize=10
```

---

## 8. Recurring Availability and CSV Export

### Bulk Recurring Availability

Front-desk staff can generate provider availability over a date range using weekly recurring time blocks.

The system:

* Validates dates and time blocks.
* Generates matching appointment slots.
* Detects overlapping appointments or slots.
* Skips collisions.
* Returns a summary of created and skipped slots.

### CSV Export

Front-desk staff can export the clinic schedule for a selected day as a CSV file.

The export includes:

* When
* Patient
* Scheduling Provider
* Supporting Providers
* Status
* Duration

---

## 9. Appointment History / Timeline

Important appointment events are stored in an immutable history timeline.

Tracked events include:

* Status changes
* Appointment cancellation
* Supporting provider added
* Supporting provider removed
* Visit note added

Each history event records relevant information such as:

* Appointment
* Actor
* Event type
* Previous status
* New status
* Cancellation reason where applicable
* Timestamp

History is returned in chronological order.

---

## 10. Appointment Alerts

The system provides alerts for appointments that require attention.

For example, unconfirmed appointments can be identified and returned through the alerts functionality.

This helps front-desk staff monitor appointments that have not yet been confirmed.

---

# Database Models

The application uses PostgreSQL with Prisma and includes the following main models:

* `User`
* `Provider`
* `Patient`
* `Appointment`
* `AppointmentSupport`
* `VisitNote`
* `AppointmentHistory`

Important relationships include:

```text
User
 └── Provider

Provider
 ├── Appointments
 ├── Supporting Appointments
 └── Visit Notes

Patient
 └── Appointments

Appointment
 ├── Provider
 ├── Patient
 ├── Visit Notes
 ├── Supporting Providers
 └── Appointment History
```

---

# Project Structure

```text
Clinic-Scheduling/
│
├── client/
│   ├── src/
│   │   ├── api.js
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── index.css
│   │   └── main.jsx
│   │
│   ├── package.json
│   └── vite.config.js
│
├── server/
│   ├── lib/
│   │   ├── access.js
│   │   ├── appointmentHistory.js
│   │   └── prisma.js
│   │
│   ├── middleware/
│   │   ├── auth.js
│   │   └── role.js
│   │
│   ├── prisma/
│   │   ├── migrations/
│   │   ├── schema.prisma
│   │   └── seed.js
│   │
│   ├── routes/
│   │   ├── alerts.js
│   │   ├── appointments.js
│   │   ├── auth.js
│   │   ├── dashboard.js
│   │   ├── notes.js
│   │   └── providers.js
│   │
│   ├── index.js
│   ├── package.json
│   └── prisma7.config.ts
│
├── .gitignore
└── README.md
```

---

# Getting Started

## Prerequisites

Make sure the following are installed:

* Node.js
* npm
* PostgreSQL

---

## 1. Clone the Repository

```bash
git clone <repository-url>
cd Clinic-Scheduling
```

---

## 2. Set Up the Server

Navigate to the server directory:

```bash
cd server
```

Install dependencies:

```bash
npm install
```

Create a `.env` file using `.env.example` as a reference.

Configure the required environment variables, including your PostgreSQL database connection and JWT secret.

Run Prisma migrations:

```bash
npx prisma migrate dev
```

Generate the Prisma client:

```bash
npx prisma generate
```

Optionally seed the database:

```bash
npx prisma db seed
```

Start the backend server:

```bash
npm run dev
```

The backend runs on:

```text
http://localhost:5000
```

---

## 3. Set Up the Client

Open another terminal and navigate to the client directory:

```bash
cd client
```

Install dependencies:

```bash
npm install
```

Create a `.env` file using `.env.example` as a reference and configure the backend API URL if required.

Start the frontend:

```bash
npm run dev
```

Vite will provide the local URL for the frontend application.

---

# API Overview

## Authentication

```text
POST /auth/register
POST /auth/login
```

## Appointments

```text
POST   /appointments
GET    /appointments
GET    /appointments/search
GET    /appointments/schedule
GET    /appointments/export
GET    /appointments/:id
GET    /appointments/:id/history

PUT    /appointments/:id

POST   /appointments/:id/request
POST   /appointments/bulk-availability

PATCH  /appointments/:id/archive
PATCH  /appointments/:id/restore
PATCH  /appointments/:id/confirm
PATCH  /appointments/:id/check-in
PATCH  /appointments/:id/complete
PATCH  /appointments/:id/no-show
PATCH  /appointments/:id/cancel

POST   /appointments/:id/supporting-providers
DELETE /appointments/:id/supporting-providers/:providerId
```

## Visit Notes

```text
POST /notes/appointments/:id/notes
GET  /notes/appointments/:id/notes
PUT  /notes/notes/:id
```

Additional routes are available for providers, dashboard functionality, and appointment alerts.

---

# Security

The project does not commit environment files containing secrets.

The `.gitignore` excludes:

```text
.env
.env.*
node_modules/
dist/
.vite/
generated/
```

Sensitive values such as database credentials and JWT secrets should always be provided through environment variables.

---

# Deployment

The project has been deployed and configured as a full-stack application with separate frontend, backend, and database services.

Before deployment, ensure that:

* Environment variables are configured on the deployment platform.
* The production PostgreSQL database URL is correctly set.
* Prisma migrations are applied to the production database.
* The frontend API URL points to the deployed backend.
* CORS is configured to allow requests from the deployed frontend.

---

# Key Design Decisions

* **PostgreSQL** was chosen because the application contains strongly related entities such as users, providers, patients, appointments, notes, supporting providers, and history events.
* **Prisma ORM** provides schema management, migrations, relations, and type-safe database access.
* **JWT authentication** is used to authenticate API requests.
* **Server-side authorization** ensures that permissions are not dependent only on the frontend.
* **Transactions** are used when an appointment action and its history event must be created together.
* **Immutable history events** provide an audit trail of important appointment activity.
* **Pagination and filtering** improve scalability when working with larger appointment datasets.

---

# Assignment Goals

The project implements the 10 required goals of the Clinic Scheduling System take-home assignment:

1. Accounts and roles
2. Appointment slots
3. Visit notes
4. Appointment status flow
5. Care team / supporting providers
6. Search, filters, sorting, and pagination
7. Recurring availability and schedule export
8. Dashboard functionality
9. Appointment history / timeline
10. Appointment alerts

---

# Author

Built as a BUSY Clinic Scheduling System take-home assignment.
