# Academic Path Planner

A working academic planning portal built with **Java 21 / Spring Boot, React / TypeScript, and PostgreSQL 17**. The interface follows the supplied SDU student portal reference: university header, academic navigation, orange page headings, curriculum tables and course-status colors, with responsive layouts.

[Portal screenshot](docs/assets/portal-preview.png) · [Planner screenshot](docs/assets/planner-preview.png) · [Mobile layout](docs/assets/planner-mobile.png)

The backend follows the supplied **five-module modular monolith**. Planning orchestrates immutable curriculum and student-record snapshots; the academic engine contains no database calls. [Architecture and feature coverage](docs/architecture.md) · [API guide](docs/api.md).

## Run locally

Prerequisites: Node.js 22.12+ (tested with 24), Docker with Compose, a Java 21 JDK, Bash, Python 3, curl, tar, and either sha512sum or shasum (included with macOS). The Maven launcher downloads Maven 3.9.11 and verifies its SHA-512 checksum. On the Debian cloud image, setup can install a signed, checksum-verified JDK into the ignored `.tools` directory if only a JRE is available.

On macOS with Homebrew:

```bash
brew install node@24 openjdk@21 python
brew install --cask docker
export PATH="$(brew --prefix node@24)/bin:$PATH"
export JAVA_HOME="$(brew --prefix openjdk@21)/libexec/openjdk.jdk/Contents/Home"
export PATH="$JAVA_HOME/bin:$PATH"
```

Open Docker Desktop and wait until it is running before setup. No CPPFLAGS setting is needed for this Java application. Add these exports to `~/.zshrc` if you want them in new terminal sessions.

```bash
./scripts/setup.sh
./scripts/dev.sh
```

The frontend runs on **port 5173** and proxies `/api` to Spring Boot on **port 8080**. PostgreSQL binds to loopback on **port 5432**. Stop `dev.sh` with Ctrl+C; application logs are in `.local/frontend.log` and `.local/backend.log`. For backend live compilation, run `./mvnw -f backend/pom.xml spring-boot:run` instead of the packaged backend used by `dev.sh`.

Use the existing checkout in cloud tasks. Tasks are already isolated; do not create a Git worktree unless explicitly requested.

## Explore the portal

Choose **Student**, **Advisor**, or **Administrator** on the sign-in page. Manual demo logins are:

| Role          | Email                   | Password       |
| ------------- | ----------------------- | -------------- |
| Student       | `student@planner.local` | `Planner2026!` |
| Advisor       | `advisor@planner.local` | `Planner2026!` |
| Administrator | `admin@planner.local`   | `Planner2026!` |

These are local demonstration accounts. The sample student has **120 / 240 ECTS earned**, six current courses, and a valid path finishing in **Spring 2028**. The 52-course catalog, credits and class times are illustrative, not official SDU data. New students can register and choose a published program and curriculum year; registration never grants advisor or administrator privileges.

1. **Academic records:** add passed, failed, current and transfer attempts, or import CSV/JSON. Preview matches and replacement warnings before confirming. Advisors approve transfer credits.
2. **My curriculum:** browse suggested semesters, search courses, filter academic status, and inspect prerequisites and actual offerings.
3. **Semester planner:** choose electives and a target, suggest a starting path, drag courses between terms or use the Move buttons, and inspect the full-path checks. Add, drop, move or simulate failing a course without modifying the transcript.
4. **Compare paths:** save a what-if as a copy and compare courses, semester loads, academic errors and graduation estimates.
5. **Advisor review:** submit a saved plan. Assigned advisors can request changes or approve a valid, complete path. Changed academic inputs make earlier reviews outdated.
6. **Curriculum management:** manually edit courses or review CSV/JSON imports, validate the prerequisite graph and credit totals, save an immutable draft, inspect affected students and publish it. Existing plan versions and choices remain intact. Maintain recurring and year-specific offerings and weekly class slots separately.

Academic errors include missing or same-term prerequisites, unavailability, overlaps, overloaded semesters, duplicate scheduling, already-earned courses, invalid elective choices and backdated planned terms. Missing requirements prevent a confirmed finish date. Warnings such as low load, pending transfers and a graduation target delay remain distinct from errors.

**Forecasts are conditional:** future courses must be passed and remain available. The starting-path generator is a deterministic, constraint-aware heuristic; it does not claim a globally optimal fastest graduation date. Authorized live SDU synchronization and an exhaustive optimizer are future extensions identified in the supplied architecture. The app uses independent planner accounts and does not collect university credentials.

## Configuration and persistence

See [`.env.example`](.env.example) for supported variables. Spring reads exported variables; Docker Compose also reads a root `.env` file. To apply a local file to both, explicitly export it in your shell before starting:

```bash
set -a
source .env
set +a
./scripts/dev.sh
```

| Variable            | Default                                       | Purpose                                                                |
| ------------------- | --------------------------------------------- | ---------------------------------------------------------------------- |
| `DATABASE_URL`      | `jdbc:postgresql://127.0.0.1:5432/pathfinder` | Spring JDBC database URL                                               |
| `DATABASE_USER`     | `planner`                                     | Database role                                                          |
| `DATABASE_PASSWORD` | `planner_dev`                                 | Local development database password                                    |
| `DEMO_ENABLED`      | `true`                                        | Seed the sample catalog/accounts once on an empty application database |
| `PORT`              | `8080`                                        | Backend port; update `API_PROXY_TARGET` if changing it                 |
| `API_PROXY_TARGET`  | backend port 8080 on loopback                 | Vite API destination                                                   |
| `COOKIE_SECURE`     | `false`                                       | Set `true` when serving through HTTPS                                  |
| `PLANNER_DATE`      | `2026-10-15`                                  | Reproducible reference date for the current academic semester          |

PostgreSQL data lives in **`.local/postgres/`**, a workspace bind mount retained separately from source control. Docker manages this directory as its PostgreSQL user; use `docker exec` for access. Flyway applies versioned schema migrations on startup. Restarting the application preserves database data; in-memory HTTP sessions require signing in again.

Before using real student data, provision real accounts and reviewed curricula, disable demo seeding, remove the existing demonstration accounts from that database, configure database credentials and serve the SPA/API together behind HTTPS. `DEMO_ENABLED=false` prevents seeding; it does not delete existing demo accounts. No production deployment or live SDU connection is configured.

Back up the development database without changing source files:

```bash
mkdir -p .local/backups
docker exec academic-pathfinder-db pg_dump -U planner -d pathfinder -Fc > .local/backups/pathfinder.dump
```

Do not remove `.local/postgres` when refreshing dependencies. `docker compose down` stops the database without deleting this bind-mounted data.

## Validate

```bash
# Pure academic-engine and CSV tests; no database needed
./mvnw -f backend/pom.xml test

# Database-backed API, authentication and authorization tests
./scripts/test-api.sh

# Browser workflows against a separate database and isolated servers
./scripts/test-browser.sh

# TypeScript checking and production frontend build
npm run build --prefix frontend
```

Browser tests require Chromium. Set `CHROMIUM_PATH` if its executable is elsewhere; the cloud image supplies `/usr/bin/chromium`. API tests use `pathfinder_test`; browser tests use `pathfinder_browser_test`, API port 8081 and frontend port 5174. They never use the development application's database. Browser test traces and screenshots are written to ignored `frontend/test-results/`; each runner preserves failure exit codes. The scripts reuse their dedicated databases so repeated runs exercise persistence and startup repeatability.

## Project layout

```text
backend/src/main/java/kz/sdu/planner/
  accounts/       Registration, session authentication and access rules
  curriculum/     Versioned degree requirements and separate offerings
  records/        Academic attempts, reviewed imports and transfer approvals
  planning/       Saved paths, simulations, comparisons and advisor reviews
  engine/         Pure academic rules and suggested-path generation
  shared/         Immutable module values, JSON/CSV support and demo bootstrap
backend/src/main/resources/db/migration/  PostgreSQL migrations
frontend/src/                             React portal
frontend/e2e/                             Browser workflows
scripts/                                  Setup, startup and test runners
examples/                                 Import templates
docs/                                     Architecture and API notes
```
