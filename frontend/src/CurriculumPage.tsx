import { useMemo, useState } from "react";
import {
  Search,
  BookOpen,
  CheckCircle2,
  Circle,
  Clock3,
  Filter,
  ArrowUpRight,
  AlertCircle,
} from "lucide-react";
import type { AcademicRecord, Course, Curriculum, Offering } from "./types";
import { Badge, Button, Modal } from "./components";
export default function CurriculumPage({
  curriculum,
  records,
  offerings,
}: {
  curriculum: Curriculum;
  records: AcademicRecord[];
  offerings: Offering[];
}) {
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState("ALL"),
    [selected, setSelected] = useState<Course | null>(null);
  const status = (code: string) => {
    const rs = records.filter((r) => r.courseCode === code);
    return rs.some(
      (r) => r.status === "PASSED" || (r.status === "TRANSFER" && r.approved),
    )
      ? "PASSED"
      : rs.some((r) => r.status === "CURRENT")
        ? "CURRENT"
        : rs.some((r) => r.status === "FAILED")
          ? "FAILED"
          : "NOT_TAKEN";
  };
  const courses = useMemo(
    () =>
      curriculum.data.courses.filter((c) =>
        (c.code + " " + c.name).toLowerCase().includes(search.toLowerCase()),
      ),
    [curriculum, search],
  );
  const semesters = Array.from(
    new Set(courses.map((c) => c.suggestedSemester)),
  ).sort((a, b) => a - b);
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ACADEMIC OPERATIONS</span>
          <h1>My curriculum</h1>
        </div>
        <Badge tone="blue">Main track · Version {curriculum.version}</Badge>
      </div>
      <div className="curriculum-banner">
        <div className="banner-icon">
          <BookOpen size={25} />
        </div>
        <div>
          <h2>
            {curriculum.year} — {curriculum.program}
          </h2>
          <p>
            {curriculum.data.totalEcts} ECTS required ·{" "}
            {curriculum.data.courses.length} available courses ·{" "}
            {curriculum.data.maxEcts} ECTS per semester
          </p>
        </div>
      </div>
      <div className="toolbar">
        <label className="search-box">
          <Search size={17} />
          <input
            aria-label="Search courses"
            placeholder="Search by course code or name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <div
          className="filter-tabs"
          role="group"
          aria-label="Filter course status"
        >
          {[
            ["ALL", "All courses"],
            ["PASSED", "Passed"],
            ["CURRENT", "In progress"],
            ["NOT_TAKEN", "Not taken"],
            ["FAILED", "Failed"],
          ].map(([value, label]) => (
            <button
              key={value}
              className={filter === value ? "selected" : ""}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <Filter size={17} className="muted" />
      </div>
      <div className="legend">
        <span>
          <i className="legend-dot green" />
          Passed / approved transfer
        </span>
        <span>
          <i className="legend-dot blue" />
          In progress
        </span>
        <span>
          <i className="legend-dot gray" />
          Not taken
        </span>
        <span>
          <i className="legend-dot red" />
          Failed
        </span>
      </div>
      {semesters.map((sem) => {
        const rows = courses.filter(
          (c) =>
            c.suggestedSemester === sem &&
            (filter === "ALL" || status(c.code) === filter),
        );
        if (!rows.length) return null;
        return (
          <section className="panel curriculum-semester" key={sem}>
            <div className="semester-heading">
              <div className="semester-number">{sem}</div>
              <div>
                <h2>
                  Semester {sem}
                  <span>
                    Year {Math.ceil(sem / 2)} · {sem % 2 ? "Fall" : "Spring"}
                  </span>
                </h2>
              </div>
              <Badge>
                {rows.filter((c) => c.required).reduce((s, c) => s + c.ects, 0)}{" "}
                core ECTS
              </Badge>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th className="row-number">№</th>
                    <th>COURSE CODE</th>
                    <th>COURSE NAME</th>
                    <th>TYPE</th>
                    <th>ECTS</th>
                    <th>GRADE</th>
                    <th>PREREQUISITES</th>
                    <th>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c, i) => {
                    const state = status(c.code),
                      r = records.find(
                        (x) =>
                          x.courseCode === c.code &&
                          (x.status === "PASSED" ||
                            (x.status === "TRANSFER" && x.approved)),
                      );
                    return (
                      <tr
                        key={c.code}
                        className={`curriculum-row ${state.toLowerCase()}`}
                      >
                        <td className="muted">{i + 1}</td>
                        <td>
                          <button
                            className="course-link"
                            onClick={() => setSelected(c)}
                          >
                            {c.code}
                          </button>
                        </td>
                        <td>
                          <button
                            className="name-link"
                            onClick={() => setSelected(c)}
                          >
                            {c.name}
                            <ArrowUpRight size={12} />
                          </button>
                        </td>
                        <td>
                          <span className="course-type">
                            {c.required
                              ? "Core"
                              : curriculum.data.electiveGroups.find(
                                  (g) => g.id === c.electiveGroup,
                                )?.name}
                          </span>
                        </td>
                        <td className="font-medium">{c.ects}</td>
                        <td>{r?.grade || "—"}</td>
                        <td className="prereq-text">
                          {c.prerequisites.join(", ") || "—"}
                        </td>
                        <td>
                          <Status state={state} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
      {!courses.some((c) => filter === "ALL" || status(c.code) === filter) && (
        <div className="empty">
          <h3>No matching courses</h3>
          <p>Try another search or status filter.</p>
        </div>
      )}

      {selected && (
        <Modal title={selected.code} onClose={() => setSelected(null)}>
          <div className="modal-body course-detail">
            <h3>{selected.name}</h3>
            <div className="detail-tags">
              <Badge tone="blue">{selected.ects} ECTS</Badge>
              <Badge>Suggested semester {selected.suggestedSemester}</Badge>
              <Status state={status(selected.code)} />
            </div>
            <h4>Prerequisites</h4>
            {selected.prerequisites.length ? (
              <ul>
                {selected.prerequisites.map((p) => (
                  <li key={p}>
                    {p} —{" "}
                    {curriculum.data.courses.find((c) => c.code === p)?.name}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No prerequisites required.</p>
            )}
            <h4>Course offerings</h4>
            {offerings
              .filter((o) => o.courseCode === selected.code)
              .map((o) => (
                <div className="offering-row" key={o.id}>
                  <strong>
                    {o.season[0] + o.season.slice(1).toLowerCase()}{" "}
                    {o.year || "· recurring"}
                  </strong>
                  <Badge tone={o.available ? "green" : "red"}>
                    {o.available ? "Available" : "Unavailable"}
                  </Badge>
                  <p>
                    {o.slots
                      .map((s) => `${s.day} ${time(s.start)}–${time(s.end)}`)
                      .join(", ") || "Timetable not specified"}
                  </p>
                </div>
              ))}
            <p className="muted">
              Availability is maintained separately from curriculum
              requirements.
            </p>
          </div>
          <div className="modal-actions">
            <Button onClick={() => setSelected(null)}>Done</Button>
          </div>
        </Modal>
      )}
    </>
  );
}
function time(m: number) {
  return `${Math.floor(m / 60)
    .toString()
    .padStart(2, "0")}:${(m % 60).toString().padStart(2, "0")}`;
}
function Status({ state }: { state: string }) {
  return state === "PASSED" ? (
    <Badge tone="green">
      <CheckCircle2 size={12} />
      Passed
    </Badge>
  ) : state === "CURRENT" ? (
    <Badge tone="blue">
      <Clock3 size={12} />
      In progress
    </Badge>
  ) : state === "FAILED" ? (
    <Badge tone="red">
      <AlertCircle size={12} />
      Failed
    </Badge>
  ) : (
    <Badge>
      <Circle size={11} />
      Not taken
    </Badge>
  );
}
