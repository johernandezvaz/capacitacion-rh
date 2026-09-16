# Capacitacion-RH — System Documentation

[![TypeScript](https://img.shields.io/badge/TypeScript-5.2-blue?style=flat-square)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16.2_(App_Router)-black?style=flat-square)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-18.2-61dafb?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-336791?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![pnpm](https://img.shields.io/badge/pnpm-11.13-orange?style=flat-square&logo=pnpm&logoColor=white)](https://pnpm.io/)

---

## Table of Contents

- [1. Project Overview](#1-project-overview)
- [2. Core Functionality](#2-core-functionality)
  - [Authentication & Plant Scoping](#authentication--plant-scoping)
  - [Annual Cycles & Course Administration](#annual-cycles--course-administration)
  - [Workforce Directory & Training History](#workforce-directory--training-history)
  - [Training Needs Assessment (DNC)](#training-needs-assessment-dnc)
  - [Enrollment & Attendance Sheets](#enrollment--attendance-sheets)
  - [Two-Phase Evaluation Questionnaires](#two-phase-evaluation-questionnaires)
  - [On-the-Job Training (OJT)](#on-the-job-training-ojt)
  - [Token-Based Public Access](#token-based-public-access)
  - [Analytics & Monthly Metrics](#analytics--monthly-metrics)
  - [PDF Document Generation](#pdf-document-generation)
- [3. Use Cases & Roles](#3-use-cases--roles)
- [4. Tech Stack](#4-tech-stack)
- [5. Architecture Summary](#5-architecture-summary)
- [6. Entry Points](#6-entry-points)
  - [Execution Scripts](#execution-scripts)
  - [Key Source Entry Points](#key-source-entry-points)

---

## 📖 1. Project Overview

Capacitacion-RH is an internal Human Resources web platform designed for multi-plant enterprise training administration. It automates the lifecycle of corporate training programs, including annual plan scheduling, training needs detection (DNC), On-the-Job Training (OJT) matrix tracking with digital signatures, two-phase participant evaluations (immediate "hot" reactions and delayed "cold" workplace application), and audit-ready PDF document generation. The system eliminates manual paperwork and fragmented spreadsheets by centralizing training records, compliance metrics, and certification evidence per plant.

---

## ⚙️ 2. Core Functionality

### Overview of Core Modules

| Module | Primary Routes | Description |
| :--- | :--- | :--- |
| **Authentication** | `/login`, `/change-password`, `/api/auth/*` | Credential validation, forced password reset, and stateful PostgreSQL session cookies. |
| **Training Years** | `/`, `/year/[id]`, `/api/training-years` | Annual training cycle planning and course organization by operating plant. |
| **Courses** | `/course/[id]`, `/api/courses` | Management of courses, instructors, dates, budgets, competencies, and statuses. |
| **Employees** | `/employees`, `/employees/[id]`, `/employees/[id]/dnc` | Personnel directory, active/inactive tracking, and individual employee training records. |
| **DNC & Detecciones** | `/detecciones`, `/dnc`, `/dnc/general` | Needs assessment matrix, annual calendar (Jan–Dec), and competency tracking. |
| **Attendance** | `/api/attendance-list/[id]`, `/api/course-participants` | Course participant rosters and printable sign-in sheet generation. |
| **Questionnaires** | `/questionnaire/hot/[id]`, `/questionnaire/cold/[id]` | Reaction surveys (hot) and delayed workplace application assessments (cold). |
| **On-the-Job Training** | `/ojt`, `/ojt/[id]`, `/api/ojt/*` | Task matrices, progress tracking, effectiveness grading, and digital signatures. |
| **Public Links** | `/public/questionnaire/[token]`, `/public/ojt/[token]` | Tokenized unauthenticated access for signatures and evaluations on shared devices. |
| **Reporting** | `/reports`, `/reportes/promedios-mensuales` | Plant KPI tracking, course completion audits, and monthly average dashboards. |

### Authentication & Plant Scoping

- **Credential Authentication**: Validates user credentials against hashed records using `bcrypt` (work factor 12).
- **Session Persistence**: Sessions are stored in the PostgreSQL `sessions` table and verified using HMAC-SHA256 signatures stored in HTTP-only `capacitacion_session` cookies.
- **Enforced Security Policies**: Users flagged with `force_password_change` are intercepted and restricted to `/change-password`.
- **Plant Data Scoping**: Multi-tenant data segregation associates user accounts with specific facilities (`plants`, `user_plants`), isolating courses, employees, and records by plant location while supporting administrator permissions.

> **Note**: Network traffic to protected pages and API endpoints is intercepted by `proxy.ts`, which validates session integrity and redirects unauthenticated requests.

### Annual Cycles & Course Administration

- **Cycle Structuring**: Groups training programs into annual operational plans scoped to specific plants (`training_years`).
- **Course Metadata**: Tracks instructors (internal/external), suggested training providers, budgeted costs, duration hours, and scheduled versus executed dates.
- **Competency Categorization**: Classifies training into personal development, soft skills, risk prevention, and technical skills.
- **Execution Lifecycle**: Manages course statuses across `programado` (scheduled), `en_proceso` (in progress), `completado` (completed), and `cancelado` (cancelled).

### Workforce Directory & Training History

- **Employee Profiles**: Maintains unique employee numbers, legal names, assigned areas/departments, job positions (`puesto`), and designated supervisors/evaluators.
- **Employment Status Tracking**: Differentiates between active workers and departed personnel (`es_baja`, `fecha_baja`), preventing departed employees from being enrolled in future courses while preserving historical training audits.
- **Unified Training Dossier**: Aggregates all courses, detected needs, and certifications completed by an employee into an exportable record (`/employees/[id]/dnc`).

### Training Needs Assessment (DNC)

- **Needs Detection Records**: Captures operational training requirements (`detecciones`) with estimated budgets, estimated delivery hours, and affected competencies.
- **Employee Assignment Matrix**: Maps requirements to specific workers across departments (`deteccion_empleados`), tracking individual fulfillment color-coding and statuses.
- **Annual Matrix Calendar (`/dnc`)**: Month-by-month grid (January to December) comparing scheduled vs actual delivery dates.
- **Consolidated Master View (`/dnc/general`)**: Departmental overview cross-referencing all requirements, participants, and completion percentages.

### Enrollment & Attendance Sheets

- **Course Roster Management**: Enrolls active plant employees into designated courses (`course_participants`).
- **Official Attendance Documents**: Generates standardized, printable attendance sheets (`/api/attendance-list/[id]`) with participant tables and physical signature blocks for compliance audits.

### Two-Phase Evaluation Questionnaires

The system implements a Kirkpatrick-aligned evaluation methodology:

- **Hot Evaluation (`hot`)**:
  - Immediate post-course survey completed by attendees.
  - Measures instructor competence, course relevance, material clarity, facility adequacy, and personal learning.
- **Cold Evaluation (`cold`)**:
  - Delayed evaluation gated by an availability date (`available_from`), preventing premature submission.
  - Completed by direct supervisors to evaluate practical knowledge transfer, on-the-job application, and performance improvement.
- **Automated Scoring**: Automatically computes weighted averages, records qualitative observations, and locks responses upon submission.

### On-the-Job Training (OJT)

- **Standardized Curricula**: Master templates (`ojt_records`, `ojt_sections`, `ojt_entries`) defining required technical knowledge, required skills, reference documentation, procedures, training duration, and evaluation criteria.
- **Individual Training Instances**: Dedicated training records (`ojt_instances`, `ojt_instance_entries`) assigned to specific workers, tracking item-by-item compliance, planned versus real completion dates, and effectiveness scores.
- **Specialized Roles**: Tracks certifications for emergency brigade members (`es_integrante_brigada`) and process pilot technicians (`es_piloto_proceso`).
- **Digital Signatures**: Canvas-based signing for the employee, direct supervisor, evaluator, and HR manager, saved as Base64 image data or secured files on disk.

### Token-Based Public Access

- **Passwordless Verification**: Token-based access paths (`/public/questionnaire/[token]`, `/public/ojt/[token]`) for mobile or shared floor tablets.
- **Restricted Access Scope**: URL tokens map to individual questionnaire or OJT instance records without granting access to administrative routes or general employee records.

### Analytics & Monthly Metrics

- **Course Performance Reports**: Consolidates hot and cold response metrics, participant completion ratios, and qualitative feedback into audit reports (`/reports`).
- **Plant Monthly Averages**: Plant-level dashboards (`/reportes/promedios-mensuales`) displaying average evaluation scores by month with compliance threshold indicators.

### PDF Document Generation

The application incorporates both client-side and server-side document rendering engines:

- **Programmatic Generation (`jspdf`, `jspdf-autotable`)**: Generates DNC annual calendars, employee training summaries, monthly performance averages, and OJT matrices directly in the browser.
- **Declarative Server Rendering (`@react-pdf/renderer`)**: Generates standardized attendance sheets, course completion certificates, and evaluation reports via API route handlers.

---

## 👥 3. Use Cases & Roles

| User Role | Access Scope | Key Activities & Workflows |
| :--- | :--- | :--- |
| **HR & Training Coordinators** | Plant-level or multi-plant administration | • Plan annual training calendars and budgets.<br>• Register employees and track department rosters.<br>• Administer DNC requirements and link them to courses.<br>• Enroll participants and generate official attendance sheets.<br>• Review completion rates and export audit documentation. |
| **Department Supervisors** | Subordinate employees within department | • Monitor assigned workers' training progress.<br>• Conduct delayed "cold" evaluations to measure skill application.<br>• Instruct, evaluate, and digitally sign practical OJT matrices. |
| **Plant Workers / Trainees** | Self-record or public token view | • Complete immediate "hot" reaction surveys following course completion.<br>• Undergo hands-on OJT instruction and sign off on completed competencies via portal or public links. |
| **Plant Leadership & Auditors** | Plant-wide read-only & reporting views | • Review monthly evaluation averages and compliance indicators.<br>• Audit training expenditure against programmed budgets.<br>• Validate compliance evidence for regulatory standards. |

---

## 💻 4. Tech Stack

| Category | Technology | Version / Citation | Purpose & Scope |
| :--- | :--- | :--- | :--- |
| **Frontend Framework** | React | `18.2.0` (`package.json`) | Core UI component rendering library. |
| | Next.js (App Router) | `16.2.4` (`package.json`) | Full-stack framework, routing, server/client components, and build system. |
| **Language & Typing** | TypeScript | `5.2.2` (`package.json`, `tsconfig.json`) | Static typing for components, database models, and API route handlers. |
| **UI Primitives** | Radix UI | Various (`package.json`) | Accessible primitives for dialogs, dropdowns, selects, tabs, radio groups, and popovers. |
| | Lucide React | `0.446.0` (`package.json`) | System iconography across navigation, cards, and buttons. |
| | Vaul | `0.9.9` (`package.json`) | Drawer primitive for mobile/touch modal views. |
| **Forms & Validation** | React Hook Form | `7.53.0` (`package.json`) | Client-side form state management. |
| | Zod | `3.23.8` (`package.json`) | Schema validation for forms and API requests. |
| | @hookform/resolvers | `3.9.0` (`package.json`) | Zod integration with React Hook Form. |
| **Data & Dates** | Date-fns | `3.6.0` (`package.json`) | Date parsing, arithmetic, and formatting utilities. |
| | React Day Picker | `8.10.1` (`package.json`) | Calendar date picker component. |
| | Recharts | `2.12.7` (`package.json`) | Charting library for performance metric visualizations. |
| | Sonner | `1.5.0` (`package.json`) | Toast notification system. |
| **PDF Generation** | @react-pdf/renderer | `4.3.2` (`package.json`) | Server-side declarative PDF rendering for attendance and course reports. |
| | jsPDF | `4.0.0` (`package.json`) | Programmatic PDF generation engine for calendars and dossiers. |
| | jsPDF-AutoTable | `5.0.7` (`package.json`) | Table formatting plugin for jsPDF documents. |
| **Backend & Database** | Node.js Runtime | `20.6.2` (`package.json`) | JavaScript execution environment. |
| | PostgreSQL | Database Engine (`lib/db.ts`) | Relational persistence for plants, courses, employees, OJT, and sessions. |
| | pg (node-postgres) | `8.23.0` (`package.json`) | Database client connection pooling (`pg.Pool`) and parameterized query execution. |
| | bcrypt | `6.0.0` (`package.json`) | Password hashing and verification. |
| | Web Crypto API | Native Node / Browser | HMAC-SHA256 signature signing and verification for session tokens (`lib/auth.ts`). |
| **Tooling & Build** | pnpm | `11.13.1` (`package.json`) | Deterministic package manager. |
| | ESLint | `8.49.0` (`package.json`) | Code quality and linting rules (`.eslintrc.json`). |
| | Netlify Next.js Plugin | `5.15.1` (`package.json`) | Serverless deployment integration. |

---

## 🏗️ 5. Architecture Summary

Capacitacion-RH is structured as a full-stack monolithic application utilizing the Next.js App Router architecture.

```
[ Browser / Public Device ]
            │
            ▼
   ┌─────────────────┐
   │    proxy.ts     │  ─── (Session verification, cookie inspection, public route bypass)
   └─────────────────┘
            │
            ▼
┌───────────────────────────────┐
│     Next.js App Router        │
├───────────────────────────────┤
│ • React 18 Client/Server UI   │  ─── (Routes: /year, /course, /employees, /ojt, /dnc, /reports)
│ • API Route Handlers          │  ─── (Endpoints: /api/courses, /api/ojt, /api/auth, data routes)
│ • PDF Generation Engines      │  ─── (@react-pdf/renderer & jspdf)
└───────────────────────────────┘
            │
            ▼
┌───────────────────────────────┐
│       Database Layer          │
├───────────────────────────────┤
│ • lib/db.ts (pg.Pool)         │
│ • PostgreSQL Database         │  ─── (Direct parameterized SQL queries, no ORM layer)
│ • File Storage (lib/firmas.ts)│  ─── (Path-sanitized signature assets & Base64 PNGs)
└───────────────────────────────┘
```

1. **Request Interception**: Incoming requests are evaluated by `proxy.ts`. Requests to `/public/*` and authentication endpoints are passed through, while protected paths require a valid session cookie. Unauthenticated requests are redirected to `/login`, and users requiring a password update are redirected to `/change-password`.
2. **Presentation Layer**: Built with React 18 components organized under feature folders in `app/`. Client components manage local interactions and dynamic forms, while UI styling is rendered using Tailwind CSS and Radix UI primitives.
3. **API & Data Access Layer**: Server routes (`app/api/*` and route-level `data/route.ts` handlers) execute business logic and validate inputs. Database queries connect directly to PostgreSQL using a connection pool (`pg.Pool` exported from `lib/db.ts`) executing parameterized SQL statements without an ORM layer.
4. **Digital Signature Pipeline**: Signatures captured on HTML5 canvas elements are serialized into Base64 PNGs and written to the database or saved to local disk via `lib/firmas.ts`, with path-traversal prevention (`getSafeFirmasPath`).
5. **Document Export Pipeline**: Printable PDFs are produced either client-side via `jspdf` and `jspdf-autotable` or streamed from server handlers using `@react-pdf/renderer`.

---

## 🚀 6. Entry Points

### Execution Scripts

Project execution commands defined in `package.json`:

```bash
# Install all dependencies using pnpm
pnpm install

# Start development server on port 4552 (using Webpack)
pnpm dev

# Compile production build
pnpm build

# Start production server on port 4552
pnpm start

# Build and start production server in one command
pnpm run serve

# Run TypeScript type validation without emitting files
pnpm run typecheck

# Run linter checks across the codebase
pnpm run lint
```

### Key Source Entry Points

| Component / Role | File Path | Responsibility |
| :--- | :--- | :--- |
| **Request Interceptor / Middleware** | `proxy.ts` | Intercepts all incoming requests, validates session cookies, and handles authentication routing. |
| **Root Layout** | `app/layout.tsx` | Declares HTML skeleton, typography, page metadata, and global toast containers. |
| **Client Application Shell** | `components/client-layout.tsx` | Conditionally mounts `AuthProvider`, `ProtectedRoute`, and the main navigation `Sidebar`. |
| **Default Home Dashboard** | `app/page.tsx` | Initial authenticated route displaying the training years dashboard and plant selection. |
| **Database Connection Singleton** | `lib/db.ts` | Initializes singleton `pg.Pool` connection and exports the core `query` execution helper. |
| **Authentication Module** | `lib/auth.ts` | Implements session generation, token signing/verification, and password validation helpers. |
