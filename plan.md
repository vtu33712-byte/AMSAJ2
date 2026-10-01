# Nexora Academic Intelligence — Implementation Plan

## Goal

Build a private, extensible personal academic command center—not a clone or impersonation of a university portal. It combines authorized academic-data imports, attendance calculations and projections, alerts, marks/timetable/assignment tracking, database-grounded AI assistance, study-material retrieval, exam preparation, and a record-derived study plan. Imported/user-entered records are the source of truth; no academic values, successful synchronizations, exam dates, or official decisions are invented.

The initialized **Nexora Academic Intelligence** project lives in `/home/ubuntu/acadwise`, uses the existing React/Express/tRPC/Drizzle starter and managed server/database resources, and now contains the core application implementation. Continue this project rather than initializing another.

## Material implementation choices and boundaries

- **Data source:** No institution identity, authorized API, official export, or personal academic data was supplied. Support manual entry plus CSV/Excel/JSON imports and a clean `AcademicDataProvider` boundary for future authorized sources. The current provider reports live data unavailable; do not log into or scrape a university portal, bypass controls, or collect university credentials.
- **Data priority and truth:** Keep demo/sample academic data disabled. Show source provenance and explicit empty/missing-data states. On failed imports preserve last-good records, record the attempt, and never claim a live sync succeeded. Preserve the user-requested source priority when an authorized provider is later connected: live authorized data, latest successful synchronization, user-imported data, user-entered data, and demo data only when explicitly enabled; never mix demo and real records.
- **Privacy:** Use the initialized authenticated application session, account-scoped records, secure server-side storage, validated/size-limited inputs and uploads, and no passwords in source, academic data in public URLs, or sensitive record values in logs. The built-in session cookie is HTTPS Preview-compatible.
- **Stack trade-off:** The request calls React/Next.js, FastAPI, PostgreSQL and pgvector/Qdrant “preferred.” The initialized supported WebDev stack is React/TypeScript + Express/tRPC/Drizzle + managed MySQL-compatible database. Use it without changing project ownership or infrastructure. Keep provider and retrieval boundaries clear so future authorized integrations or alternatives can be connected.
- **AI grounding:** Deterministic services calculate counts, percentages, eligibility, projections, configured thresholds and alerts. Numerical assistant questions are resolved from database records before generative answers. Document assistance retrieves relevant passages and cites pages when available. Retrieval is keyword-ranked, not vector search; the UI discloses that, and scanned-image OCR is not configured. Generated study material is labeled as practice, not an exam prediction.
- **Delivery:** The verified product is available in Preview. Public deployment and auto-publication remain disabled because no public audience or authorized source was specified and the records are sensitive.

## Product implementation

### 1. Application foundation and data model

- Extend the existing React/TypeScript client, Express/tRPC server, Drizzle schema and managed MySQL-compatible database; keep business logic and secrets server-side.
- Use the initialized application authentication, not a custom university login or local university-password flow. Protect academic endpoints and scope persisted student, subject, attendance, extra-class, timetable, mark, result, credit, assignment, material/chunk, topic, notification and sync-log records to the signed-in user.
- Preserve provenance through import/source status and sync history. Store durable uploaded files through platform storage; keep file metadata and page-aware text chunks in the database.

### 2. Authorized data import and synchronization

- Validate and preview CSV/Excel/JSON files, normalize common field aliases, show sample rows/categories, enforce import-size limits, and report row-level rejection reasons. Apply valid rows transactionally; fatal database failures roll back, repeat attendance/timetable/extra-class/assignment/exam rows are handled idempotently, and rejected rows do not create orphan subjects.
- Define `AcademicDataProvider` methods for profile, attendance, timetable, marks, results, assignments, credits, exam dates and course materials. The configured live-provider placeholder explicitly reports that no authorized source is connected.
- Log import/sync start and completion/failure, added/updated/unchanged/rejected counts and safe error summaries. Display the last successful import separately from the latest failed attempt, retaining existing good records after failure.
- Expose protected endpoints for student profile, attendance/analysis/projection, timetable, marks/results/credits, assignments, subjects/extra classes, materials/upload/analysis, study topics/planning, AI chat, sync and sync status.

### 3. Attendance intelligence

- Per subject calculate total/present/absent counts, current percentage (`present / total × 100`), configurable required percentage, future scheduled classes when available, eligibility and risk.
- Provide an interactive calculator for present, absent, explicit current total, required percentage and expected remaining classes. Reject inconsistent totals; compute minimum additional consecutive attended classes and approximate missable classes with safe handling for invalid, impossible and insufficient data.
- Use only recorded timetable entries for future class estimates. If the timetable or attendance denominator is missing, suppress unsupported projections and show the requested missing-data guidance. Label every outcome as a mathematical projection rather than an official decision.
- Track extra classes by subject/date/faculty/status, and let the user specify whether each counts toward attendance and/or has a separate category. Never presume official counting; show ordinary attendance separately from projections using only future, eligible extra classes.
- Calculate end-of-semester scenarios for attending every remaining regular class, missing one class per week, missing two classes per week, and attending regular plus eligible extra classes; show a chart and its assumptions only when a current attendance denominator and suitable timetable data exist.
- Use user-configurable SAFE/WATCH/AT RISK/SHORTAGE bands; do not describe them as official university categories unless an authorized source supplies those rules.

### 4. Dashboard and alerts

- Provide cards for overall attendance, CGPA, credits, subjects, pending assignments and attendance risk, followed by attendance overview, subject risk, upcoming classes, assignments, recent marks and record-derived next steps.
- Show meaningful empty states and source/sync status instead of fabricated statistics. Assignment availability is distinct from a real zero-pending result.
- Derive below-threshold, eligibility-reached and upcoming-risk alert cards only from saved attendance, configured rules and actual timetable records. Let the user tune attendance/risk thresholds. No external push-delivery channel or notification read-state workflow is assumed in this iteration.

### 5. Study materials, retrieval and exam preparation

- Accept PDF, PPT/PPTX, DOC/DOCX, TXT and common image uploads with a 20 MB limit and private account ownership. Organize by subject, unit, topic and semester; store filename, upload date, page count, SHA-256 content hash, extraction status and page-aware chunks. Unsupported legacy Office files/images may be stored but are clearly labeled when text cannot be extracted; scanned OCR is not claimed.
- Extract supported text, chunk it and retrieve only relevant passages rather than resending whole documents. Use the documented keyword-ranked fallback, disclose the lack of vector embeddings, and cite file/page references where available.
- Generate chapter summaries, key topics/concepts, definitions, formulas, concise notes, 5/10-mark practice outlines, viva prompts, MCQs/flashcards and revision checklists. Distinguish extracted source material from generated practice suggestions; never promise exam appearance.
- Provide summary, key-topic, easy-language and document-question modes; record tracked topics, learned/remaining state, user-selected priority, user-entered quiz score and revision count. Weak-topic guidance uses saved progress rather than invented test results.

### 6. Academic assistant and study planner

- Provide a floating and dedicated assistant for questions about current/lowest attendance, classes to attend or miss, all-attended/missed-next-two projections, risk subjects, extra classes, CGPA and pending assignments.
- Resolve supported numeric questions from database records and deterministic calculations first. If needed data is absent, return: “I don't have enough data to calculate this. Please synchronize/upload your timetable or attendance data.” Do not infer missing values.
- Build a priority-ranked plan from saved assignments, exam dates, attendance risk, relative marks, topic progress, timetable, uploaded material and the user's topic priorities. Do not invent exams, study hours or time blocks; call out missing inputs.

### 7. Responsive interface and own branding

- **Design movement:** contemporary editorial modernism for a premium analytics workspace.
- **Core principles:** provenance before prediction; calm visibility for risk; dense information with deliberate hierarchy; progressive disclosure for advanced study tools.
- **Color philosophy:** ink/navy conveys focus, warm off-white supports long study sessions, restrained teal signals action/progress, and amber/red are reserved for risk. Support light and dark themes. **Signature brand color:** Nexora teal `#58C4AE`.
- **Layout paradigm:** a persistent desktop navigation rail with a broad dashboard canvas and contextual panels. On mobile use bottom navigation for Home, Attendance, Study, AI and Profile; adapt charts, tables and forms to small screens.
- **Signature elements:** the original N/compass mark; a compact source/sync ribbon; threshold-aware attendance tracks. Use subtle glasslike surfaces, not excessive gradients or decorative dashboard art.
- **Interaction and animation:** precise controls, clear import-validation feedback, accessible focus, loading/empty/error states and toast feedback. Keep transitions short and restrained, honor reduced motion, and never animate in a way that implies academic data is changing.
- **Typography:** Space Grotesk for display/section headings and Inter for interface/body text, with a consistent hierarchy and clear metric numerals.
- **Brand essence:** “A private command center that turns your own academic records into clear next steps.” Personality: precise, composed, encouraging.
- **Brand voice:** direct, supportive, explicit about uncertainty. Example lines: “Everything here begins with your records.” “Import your timetable to see what can be projected.”
- **Wordmark & logo:** a custom geometric N in a deep-ink rounded tile, accented by a teal compass direction; original Nexora SVG is used for the site and literal project-logo metadata. No university identity or assets.

## Project structure

- `client/src/App.tsx` and `client/src/pages/`: authenticated routes for dashboard, attendance, study studio, AI assistant and profile/settings. `client/src/features/` contains the same-origin API client and import normalizers/tests.
- `client/src/components/`: responsive Nexora shell/navigation, floating assistant and shared UI, charts, alerts, empty/loading/error states, toasts and theme controls.
- `server/_core/academicApi.ts`, mounted by `server/_core/index.ts`: authenticated REST endpoints for academic records, imports/sync, materials, AI and study planning.
- `server/services/academic.ts`, `attendance.ts`, `academicDataProvider.ts` and `documents.ts`: user-scoped persistence/imports; deterministic attendance formulas; authorized-provider boundary; bounded extraction, chunking and retrieval.
- `drizzle/schema.ts` and `drizzle/`: ownership-aware tables, indexes and additive migrations.
- `client/public/manus-routes.json`, `academic-import-template.csv` and `nexora-logo.svg`: declared page routes, import starter and site brand asset served by Vite.
- Root `app.config.ts` and initialized deployment/runtime files: literal project-logo metadata, managed server/database configuration, and unauthenticated health check.

## Assumptions and open risks

1. No institution/API identity, official attendance policy, timetable or personal academic data was provided. The app cannot claim live synchronization or official eligibility until an authorized source and policy are supplied; initial records come from imports/manual entry.
2. The supported managed database is MySQL-compatible rather than the preferred PostgreSQL. The implementation uses the initialized platform stack and preserves provider/retrieval boundaries for later alternatives.
3. “Production-ready” here means a real authenticated application with durable persistence, ownership checks, validations, migrations, calculations and Preview delivery—not an official university integration, institutional-policy certification or public launch.
4. “Nexora” is the working own-brand name and can be changed later.
