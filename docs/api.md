# API guide

All endpoints return JSON, except successful deletions and logout. Errors include `message`. The Vite development server forwards `/api` to Spring Boot, keeping browser requests on one origin.

Call `GET /api/auth/csrf` first. Send the returned `token` as `X-XSRF-TOKEN` on POST/PUT/DELETE, retain the session cookies, and refresh the token after logout. Login returns an account summary; passwords/hashes are never returned. Unauthenticated requests receive 401, authorization failures receive 403, validation failures 400 and optimistic save conflicts 409.

| Method and path                                            | Behavior                                                                                        |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `GET /api/health`                                          | Check the API and a real PostgreSQL query                                                       |
| `GET /api/programs`                                        | Public published program/year choices                                                           |
| `POST /api/auth/register`                                  | `{name,email,password,program,curriculumYear}`; always a student                                |
| `POST /api/auth/login`                                     | `{email,password}`; creates a server session                                                    |
| `GET /api/auth/me`                                         | Current account                                                                                 |
| `POST /api/auth/logout`                                    | Invalidate the session                                                                          |
| `GET /api/curriculum`                                      | Latest published curriculum for the account's program/year                                      |
| `GET /api/offerings`                                       | Actual availability and weekly timetable, independent of curriculum versions                    |
| `GET, POST /api/records`                                   | List or upsert one own attempt; approved is always false for student writes                     |
| `DELETE /api/records/{id}`                                 | Remove an own attempt                                                                           |
| `POST /api/records/import-preview`                         | `{format:"CSV" or "JSON",content}`; validates matches and returns rows/warnings without writing |
| `POST /api/records/import`                                 | `{rows:[...]}`; revalidates and atomically saves confirmed records                              |
| `GET /api/plans`                                           | Own paths; administrator can supply `?studentId=UUID`                                           |
| `POST /api/plans`                                          | `{name,curriculumId?,data?}`; omitted data creates an empty manual plan                         |
| `GET /api/plans/{id}`                                      | Plan, its curriculum, latest available version, evaluation, and student                         |
| `PUT /api/plans/{id}`                                      | `{name,revision,curriculumId?,data}`; owner only, optimistic revision check                     |
| `DELETE /api/plans/{id}`                                   | Delete an own path                                                                              |
| `POST /api/plans/{id}/preview`                             | `{curriculumId?,data}`; evaluates a temporary copy without persistence                          |
| `GET /api/plans/{id}/compare/{otherId}`                    | Fresh evaluations and data for two paths belonging to the same authorized student               |
| `GET /api/admin/students`                                  | List students for administrator transfer-credit approval                                        |
| `GET /api/admin/students/{id}/records`                     | Authorized student's academic attempts                                                          |
| `POST /api/admin/students/{id}/records/{recordId}/approve` | Approve authorized transfer credit                                                              |
| `GET /api/admin/curricula`                                 | All versions, including unpublished drafts                                                      |
| `POST /api/admin/curricula`                                | `{program,year,data}`; validate and save a new unpublished version                              |
| `POST /api/admin/curricula/import-preview`                 | `{format,content,baseCurriculumId?}`; JSON full data or CSV courses with base metadata          |
| `GET /api/admin/curricula/{id}/impact`                     | Affected-student count and publication behavior                                                 |
| `POST /api/admin/curricula/{id}/publish`                   | Publish a reviewed draft; old versions remain                                                   |
| `PUT /api/admin/offerings`                                 | Upsert `{courseCode,season,year,available,slots}`; year null means recurring                    |

## Values

Academic terms use `YYYY-SPRING`, `YYYY-SUMMER` and `YYYY-FALL`. Academic records use `PASSED`, `CURRENT`, `FAILED` or `TRANSFER`. CSV requires `courseCode,status,grade,term`; JSON uses an array of these objects with an optional `approved` value that cannot grant student approval.

Plan contents:

```json
{
  "semesters": {
    "2026-FALL": ["CSS 301"],
    "2027-SPRING": ["CSS 302"]
  },
  "electives": ["CSS 411", "MDE 301"],
  "target": "2028-SPRING",
  "failedCourses": []
}
```

`failedCourses` removes that course's earned credit/enrollment from the scenario, allowing a future retake to be explored. It never changes the record module. Selecting an elective is separate from scheduling it.

Offerings store weekly slots in minutes since midnight, for example `{"day":"MON","start":540,"end":630}`. Days use `MON` through `SUN`; terms use `FALL`, `SPRING`, `SUMMER` and an optional year. An explicit year's entry wins over the recurring one.

Curriculum CSV columns are `code,name,ects,suggestedSemester,required,electiveGroup,prerequisites`. Use lowercase `true`/`false`; separate prerequisites with `|`, and quote names containing commas. For full JSON structure, export the selected catalog data from the administrator editor. A new degree can be prepared by editing program/year and the full data object, then validating and saving it as a draft.
