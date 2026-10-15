import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Flag,
  Layers3,
} from "lucide-react";
import { Badge, Button, Empty, Issues, Progress } from "./components";
import { termLabel, termOrder } from "./api";
import type { AcademicRecord, Curriculum, Detail, User } from "./types";

export default function Dashboard({
  user,
  detail,
  curriculum,
  records,
  navigate,
  create,
}: {
  user: User;
  detail: Detail | null;
  curriculum: Curriculum;
  records: AcademicRecord[];
  navigate: (v: string) => void;
  create: () => void;
}) {
  const evaluation = detail?.evaluation;
  const completed = curriculum.data.courses.filter((c) =>
    records.some(
      (r) =>
        r.courseCode === c.code &&
        (r.status === "PASSED" || (r.status === "TRANSFER" && r.approved)),
    ),
  );
  const coreEarned = completed
    .filter((c) => c.required)
    .reduce((sum, c) => sum + c.ects, 0);
  const groupEarned = (group: string) =>
    completed
      .filter((c) => c.electiveGroup === group)
      .reduce((sum, c) => sum + c.ects, 0);
  // Transcript progress stays factual when the selected path contains failure assumptions.
  const earned =
    coreEarned +
    curriculum.data.electiveGroups.reduce(
      (sum, g) => sum + Math.min(g.ectsRequired, groupEarned(g.id)),
      0,
    );
  const current = records.filter((r) => r.status === "CURRENT");
  const course = (code: string) =>
    curriculum.data.courses.find((c) => c.code === code);
  const semesters = detail
    ? Object.entries(detail.plan.data.semesters).sort(([a], [b]) =>
        termOrder(a, b),
      )
    : [];
  const errors = evaluation?.issues.filter((i) => i.severity === "ERROR") || [];
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR ACADEMIC OVERVIEW</span>
          <h1>My academic path</h1>
        </div>
        <Badge tone="blue">
          {curriculum.year} · {curriculum.program}
        </Badge>
      </div>
      <section className="welcome-card">
        <div>
          <span className="eyebrow">
            HELLO, {user.name.split(" ")[0].toUpperCase()}
          </span>
          <h2>{user.name}</h2>
          <p>
            You’ve earned{" "}
            <strong>
              {earned} of {curriculum.data.totalEcts} ECTS
            </strong>
          </p>
          <Button onClick={() => (detail ? navigate("planner") : create())}>
            {detail ? "Open semester planner" : "Create my first path"}
            <ArrowRight size={16} />
          </Button>
        </div>
        <div
          className="degree-ring"
          style={
            {
              "--progress": `${Math.round((earned / curriculum.data.totalEcts) * 100)}%`,
            } as React.CSSProperties
          }
        >
          <div>
            <GraduationIcon />
            <strong>
              {Math.round((earned / curriculum.data.totalEcts) * 100)}
              <span>%</span>
            </strong>
            <small>degree completed</small>
          </div>
        </div>
      </section>
      <div className="stats-grid">
        <Stat
          icon={<BookOpen size={19} />}
          label="Credits earned"
          value={
            <>
              {earned}
              <small> / {curriculum.data.totalEcts}</small>
            </>
          }
          sub="ECTS completed"
          tone="blue"
        />
        <Stat
          icon={<Layers3 size={19} />}
          label="Credits remaining"
          value={curriculum.data.totalEcts - earned}
          sub="ECTS to your degree"
          tone="orange"
        />
        <Stat
          icon={<CalendarDays size={19} />}
          label="Estimated graduation"
          value={termLabel(evaluation?.graduation)}
          sub={
            evaluation?.graduation
              ? "Based on your saved path"
              : "Complete a valid path to confirm"
          }
          tone="green"
        />
        <Stat
          icon={<Flag size={19} />}
          label="Graduation target"
          value={
            detail?.plan.data.target
              ? termLabel(detail.plan.data.target)
              : "Set your goal"
          }
          sub={
            evaluation?.targetStatus === "ON_TRACK"
              ? "Your saved path is on track"
              : evaluation?.targetStatus === "AFTER_TARGET"
                ? "Your path finishes after this target"
                : "Choose a target in the planner"
          }
          tone="purple"
        />
      </div>
      <div className="dashboard-columns">
        <div>
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>The road ahead</h2>
                <p>
                  {detail?.plan.name || "Your saved semester-by-semester path"}
                </p>
              </div>
              <button
                className="text-button"
                onClick={() => navigate("planner")}
              >
                View planner
                <ArrowUpRight size={15} />
              </button>
            </div>
            {semesters.length ? (
              <div className="roadmap">
                {semesters.map(([term, codes]) => (
                  <div className="roadmap-row" key={term}>
                    <div
                      className={`timeline-dot ${term === detail?.currentTerm ? "active" : ""}`}
                    >
                      <span />
                    </div>
                    <div className="roadmap-term">
                      <strong>{termLabel(term)}</strong>
                      <small>
                        {term === detail?.currentTerm
                          ? "Current semester"
                          : `${codes.length} planned courses`}
                      </small>
                    </div>
                    <div className="roadmap-load">
                      <div>
                        {codes.map((code, j) => (
                          <span
                            key={code}
                            style={{
                              background: j % 2 ? "#b8c9e5" : "#8cabc9",
                            }}
                          />
                        ))}
                      </div>
                      <strong>
                        {codes.reduce(
                          (s, code) => s + (course(code)?.ects || 0),
                          0,
                        )}{" "}
                        <small>ECTS</small>
                      </strong>
                    </div>
                    <Badge
                      tone={term === detail?.currentTerm ? "blue" : "neutral"}
                    >
                      {term === detail?.currentTerm ? "In progress" : "Planned"}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <Empty title="No saved plan" description="">
                <Button onClick={create}>Create a path</Button>
              </Empty>
            )}
            <div className="panel-footer">
              <Clock3 size={15} />
              <span>
                Estimates assume future courses are passed and available.
              </span>
            </div>
          </section>
          <section className="panel current-courses">
            <div className="panel-heading">
              <div>
                <h2>This semester</h2>
                <p>
                  {current.length} courses in progress ·{" "}
                  {current.reduce(
                    (s, r) => s + (course(r.courseCode)?.ects || 0),
                    0,
                  )}{" "}
                  ECTS
                </p>
              </div>
              <button
                className="text-button"
                onClick={() => navigate("records")}
              >
                My records
                <ArrowUpRight size={15} />
              </button>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>COURSE</th>
                    <th>NAME</th>
                    <th>ECTS</th>
                    <th>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {current.map((r) => (
                    <tr key={r.id}>
                      <td className="course-code">{r.courseCode}</td>
                      <td>{course(r.courseCode)?.name || r.courseCode}</td>
                      <td>{course(r.courseCode)?.ects}</td>
                      <td>
                        <Badge tone="blue">In progress</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!current.length && (
                <div className="table-empty">
                  No current courses. Add enrollment in Academic records.
                </div>
              )}
            </div>
          </section>
        </div>
        <div>
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Degree requirements</h2>
                <p>Earned credits toward your curriculum</p>
              </div>
              <BookOpen size={19} className="muted" />
            </div>
            <div className="requirements">
              {(
                evaluation?.requirements.map((r) => ({
                  ...r,
                  earned: r.id === "CORE" ? coreEarned : groupEarned(r.id),
                })) || [
                  {
                    id: "CORE",
                    name: "Degree credits",
                    required: curriculum.data.totalEcts,
                    earned,
                    planned: 0,
                  },
                ]
              ).map((r) => (
                <div className="requirement" key={r.id}>
                  <div>
                    <strong>{r.name}</strong>
                    <span>
                      {r.earned}
                      <small> / {r.required}</small>
                    </span>
                  </div>
                  <Progress value={r.earned} max={r.required} />
                  <small>
                    {Math.max(0, r.required - r.earned)} ECTS remaining
                  </small>
                </div>
              ))}
            </div>
            <button
              className="panel-link"
              onClick={() => navigate("curriculum")}
            >
              Explore my curriculum
              <ArrowRight size={16} />
            </button>
          </section>
          <section className="panel check-panel">
            <div className="panel-heading">
              <div>
                <h2>Plan health</h2>
                <p>Every decision, checked</p>
              </div>
              <CheckCircle2
                size={20}
                color={errors.length ? "#c16426" : "#29835b"}
              />
            </div>
            {evaluation ? (
              <>
                <div className="check-status">
                  <span
                    className={`status-orb ${errors.length ? "amber" : "green"}`}
                  />
                  <strong>
                    {errors.length
                      ? `${errors.length} issue${errors.length === 1 ? "" : "s"} to resolve`
                      : evaluation.complete
                        ? "Your path looks good"
                        : "Your path needs a few choices"}
                  </strong>
                </div>
                <Issues issues={evaluation.issues.slice(0, 2)} compact />
                <button
                  className="panel-link"
                  onClick={() => navigate("planner")}
                >
                  Review academic checks
                  <ArrowRight size={16} />
                </button>
              </>
            ) : (
              <div className="panel-body muted">
                Create a path to check prerequisites and course availability.
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
function GraduationIcon() {
  return (
    <svg
      width="30"
      height="24"
      viewBox="0 0 30 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="m2 8 13-6 13 6-13 6L2 8Zm6 4v6c5 4 9 4 14 0v-6M28 8v11"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function Stat({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub: string;
  tone: string;
}) {
  return (
    <section className="stat">
      <div className="stat-top">
        <span>{label}</span>
        <div className={`stat-icon ${tone}`}>{icon}</div>
      </div>
      <strong>{value}</strong>
      <p>{sub}</p>
    </section>
  );
}
