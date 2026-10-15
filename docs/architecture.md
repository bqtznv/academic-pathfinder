# Architecture

Java 21 / Spring Boot, React / TypeScript and PostgreSQL 17. The backend retains five modules in one application. Advisor review and automatic path generation have been removed. Planning is manual.

| Module          | Responsibility                                                                                                         |
| --------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Accounts        | Student registration, session login/logout, ownership and administrator access                                         |
| Curriculum      | Immutable curriculum versions, imports/edits, publication, separate offerings and class times                          |
| Student records | Academic attempts, import preview/confirmation and administrator approval of transfer credits                          |
| Planning        | Empty manual plans, semester/course edits, elective choices, targets, what-if copies, comparisons and optimistic saves |
| Academic engine | Prerequisites, ECTS, electives, availability, timetable conflicts and conditional graduation; no database calls        |

Planning gathers immutable curriculum and record snapshots and calls the engine directly through Java methods. Repositories use parameterized Spring JDBC queries against one PostgreSQL database. Flyway manages schema migrations.

New plans contain no automatically scheduled courses. Students add semesters, select electives and place courses using drag-and-drop or Move/Add buttons. The engine evaluates the full path after edits without changing academic records. Failure assumptions belong to a scenario, not the transcript.

A prerequisite must be completed in an earlier semester. Approved transfers and repeated passes count once. Pending transfers do not earn credit. Regular credit limits come from the curriculum; summer is capped at 15 ECTS. Year-specific offerings override recurring offerings. Overlapping weekly slots and backdated planned terms are errors; adjacent classes are allowed.

Incomplete or invalid plans may be saved but receive no confirmed graduation date. Forecasts assume future courses are passed and remain available. A graduation target provides a comparison, not a rule override.

Student writes are restricted to the authenticated owner. Administrators manage curricula, offerings and transfer-credit approval. Mutations require CSRF protection; sessions use HTTP-only same-site cookies. The visible Logout button invalidates the session. Unsaved plan changes require an explicit discard before leaving.

Saving checks the plan revision and returns HTTP 409 for concurrent changes. Published curriculum versions remain immutable. Students explicitly preview and save upgrades to newer versions. Evaluations are recomputed using current records and offerings.

The original Flyway migration is unchanged for compatibility. Historical review tables and columns in older databases are unused; review, submission and generation endpoints no longer exist. No academic records or saved plans are removed by the update.
