import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowRightLeft,
  Check,
  ChevronDown,
  Copy,
  Download,
  GripVertical,
  Plus,
  RotateCcw,
  Save,
  Search,
  Send,
  Sparkles,
  Trash2,
  X,
  AlertTriangle,
} from "lucide-react";
import { api, download, termLabel, termOrder, terms } from "./api";
import type {
  AcademicRecord,
  Course,
  Detail,
  Evaluation,
  Plan,
  PlanData,
} from "./types";
import {
  Badge,
  Button,
  EvaluationSummary,
  Issues,
  Modal,
  Progress,
} from "./components";
type Props = {
  detail: Detail;
  plans: Plan[];
  records: AcademicRecord[];
  select: (id: string) => void;
  onSaved: (d: Detail) => Promise<void>;
  create: () => void;
  notify: (m: string) => void;
  onDirty: (v: boolean) => void;
};
export default function PlannerPage({
  detail,
  plans,
  records,
  select,
  onSaved,
  create,
  notify,
  onDirty,
}: Props) {
  const [data, setData] = useState<PlanData>(structuredClone(detail.plan.data)),
    [name, setName] = useState(detail.plan.name),
    [curriculum, setCurriculum] = useState(detail.curriculum);
  const [evaluation, setEvaluation] = useState(detail.evaluation),
    [checking, setChecking] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [search, setSearch] = useState(""),
    [tab, setTab] = useState("courses"),
    [move, setMove] = useState<Course | null>(null),
    [destination, setDestination] = useState(detail.currentTerm);
  const [addTerm, setAddTerm] = useState(false),
    [newTerm, setNewTerm] = useState("2028-FALL"),
    [confirmGenerate, setConfirmGenerate] = useState(false),
    [deletePlan, setDeletePlan] = useState(false);
  const [scenario, setScenario] = useState({
      action: "move",
      courseCode: detail.curriculum.data.courses[0]?.code || "",
      term: "2027-SPRING",
    }),
    [showScenario, setShowScenario] = useState(false);
  const seq = useRef(0);
  const dirty =
    JSON.stringify(data) !== JSON.stringify(detail.plan.data) ||
    name !== detail.plan.name ||
    curriculum.id !== detail.plan.curriculumId;
  const courses = curriculum.data.courses;
  const course = (code: string) => courses.find((c) => c.code === code);
  const passed = (code: string) =>
    !data.failedCourses.includes(code) &&
    records.some(
      (r) =>
        r.courseCode === code &&
        (r.status === "PASSED" || (r.status === "TRANSFER" && r.approved)),
    );
  const scheduled = new Set(Object.values(data.semesters).flat());
  const available = courses.filter(
    (c) =>
      !passed(c.code) &&
      !scheduled.has(c.code) &&
      (c.required || data.electives.includes(c.code)) &&
      (c.code + " " + c.name).toLowerCase().includes(search.toLowerCase()),
  );
  useEffect(() => {
    onDirty(dirty);
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty, onDirty]);
  useEffect(() => {
    const n = ++seq.current;
    setChecking(true);
    const timer = setTimeout(() => {
      api<Evaluation>(`/plans/${detail.plan.id}/preview`, "POST", {
        data,
        curriculumId: curriculum.id,
      })
        .then((e) => {
          if (n === seq.current) {
            setEvaluation(e);
            setError("");
          }
        })
        .catch((e) => {
          if (n === seq.current) setError(e.message);
        })
        .finally(() => {
          if (n === seq.current) setChecking(false);
        });
    }, 300);
    return () => clearTimeout(timer);
  }, [data, curriculum.id, detail.plan.id, detail.evaluation]);
  function moveCourse(code: string, term: string | null) {
    setData((old) => {
      const next = structuredClone(old);
      for (const t of Object.keys(next.semesters))
        next.semesters[t] = next.semesters[t].filter((c) => c !== code);
      if (term) {
        next.semesters[term] = [...(next.semesters[term] || []), code];
        const c = course(code);
        if (c && !c.required && !next.electives.includes(code))
          next.electives.push(code);
      }
      return next;
    });
    setMove(null);
  }
  async function save(asCopy = false) {
    setBusy(true);
    setError("");
    try {
      const d = await api<Detail>(
        asCopy ? "/plans" : `/plans/${detail.plan.id}`,
        asCopy ? "POST" : "PUT",
        {
          name: asCopy ? `${name.slice(0, 85)} (what-if)` : name,
          curriculumId: curriculum.id,
          data,
          ...(asCopy ? {} : { revision: detail.plan.revision }),
        },
      );
      onDirty(false);
      await onSaved(d);
      notify(
        asCopy
          ? "What-if saved as a separate plan."
          : "Plan saved. Academic checks refreshed.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function generate() {
    setBusy(true);
    setError("");
    try {
      const r = await api<{ data: PlanData; evaluation: Evaluation }>(
        `/plans/${detail.plan.id}/generate`,
        "POST",
        { curriculumId: curriculum.id, data },
      );
      setData(r.data);
      setEvaluation(r.evaluation);
      setConfirmGenerate(false);
      notify(
        "A suggested path is ready to review. Save when you’re happy with it.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function reset() {
    setData(structuredClone(detail.plan.data));
    setName(detail.plan.name);
    setCurriculum(detail.curriculum);
    setEvaluation(detail.evaluation);
    setError("");
  }
  function applyScenario() {
    const { action, courseCode, term } = scenario;
    setData((old) => {
      const next = structuredClone(old);
      for (const t of Object.keys(next.semesters))
        next.semesters[t] = next.semesters[t].filter((c) => c !== courseCode);
      if (action === "fail") {
        if (!next.failedCourses.includes(courseCode))
          next.failedCourses.push(courseCode);
      } else if (action === "move" || action === "add") {
        next.semesters[term] = [...(next.semesters[term] || []), courseCode];
        const c = course(courseCode);
        if (c && !c.required && !next.electives.includes(courseCode))
          next.electives.push(courseCode);
      }
      return next;
    });
    notify("What-if applied to your draft. Your saved plan is unchanged.");
  }
  const errors = evaluation.issues.filter((i) => i.severity === "ERROR");
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ACADEMIC OPERATIONS</span>
          <h1>Semester planner</h1>
          <p>Build a path. Try a change. Know what it means.</p>
        </div>
        <Button variant="secondary" onClick={create}>
          <Plus size={16} />
          New path
        </Button>
      </div>
      <div className="planner-topbar">
        <div className="plan-selector">
          <label className="sr-only" htmlFor="active-plan">
            Active plan
          </label>
          <select
            id="active-plan"
            value={detail.plan.id}
            onChange={(e) => select(e.target.value)}
          >
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <Badge tone={dirty ? "amber" : "green"}>
            {dirty ? "Unsaved changes" : "Saved"}
          </Badge>
        </div>
        <div className="button-row">
          <Button variant="ghost" onClick={() => save(true)} disabled={busy}>
            <Copy size={15} />
            Save as copy
          </Button>
          <Button variant="secondary" disabled={!dirty || busy} onClick={reset}>
            <RotateCcw size={15} />
            Reset
          </Button>
          <Button
            disabled={!dirty || checking}
            busy={busy}
            onClick={() => save()}
          >
            <Save size={16} />
            Save changes
          </Button>
        </div>
      </div>
      {error && (
        <div role="alert" className="form-error">
          {error}
        </div>
      )}
      {detail.latestCurriculum.id !== curriculum.id && (
        <div className="callout blue update-notice">
          <div>
            <strong>
              Curriculum version {detail.latestCurriculum.version} is available.
            </strong>
            <p>
              Your current version and choices are preserved. Preview the
              updated requirements before saving.
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={() => setCurriculum(detail.latestCurriculum)}
          >
            Preview update
          </Button>
        </div>
      )}
      <section className="panel planner-settings">
        <label>
          Plan name
          <input
            aria-label="Plan name"
            value={name}
            maxLength={100}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          Graduation target
          <select
            aria-label="Graduation target"
            value={data.target || ""}
            onChange={(e) =>
              setData({ ...data, target: e.target.value || null })
            }
          >
            <option value="">No target yet</option>
            {terms(2026, 2035).map((t) => (
              <option value={t} key={t}>
                {termLabel(t)}
              </option>
            ))}
          </select>
        </label>
        <div className="settings-action">
          <Button variant="secondary" onClick={() => setConfirmGenerate(true)}>
            <Sparkles size={16} />
            Suggest a path
          </Button>
          <small>Reviewable draft · {curriculum.data.maxEcts} ECTS limit</small>
        </div>
      </section>
      <div className="planner-layout">
        <div className="planner-main">
          <section className="panel">
            <EvaluationSummary
              evaluation={evaluation}
              baseline={dirty ? detail.evaluation : undefined}
            />
            <div className="evaluation-foot">
              <span
                className={`status-orb ${checking ? "amber" : evaluation.valid ? "green" : "red"}`}
              />
              {checking
                ? "Checking your changes…"
                : `${evaluation.valid ? "Academic checks passed" : "Academic issues found"} · ${evaluation.earnedEcts} earned + ${evaluation.plannedEcts} planned / ${evaluation.totalEcts} ECTS`}
              <Badge>
                {curriculum.program} · v{curriculum.version}
              </Badge>
            </div>
          </section>
          <div className="scenario-toggle">
            <button
              className="text-button"
              onClick={() => setShowScenario(!showScenario)}
            >
              <ArrowRightLeft size={16} />
              {showScenario
                ? "Close what-if tools"
                : "What if I change a course?"}
              <ChevronDown size={15} />
            </button>
            <span>Changes are previews until you save.</span>
          </div>
          {showScenario && (
            <section className="scenario-box">
              <div>
                <span className="eyebrow">WHAT-IF SIMULATION</span>
                <h3>See the effect of your next move</h3>
              </div>
              <div className="scenario-fields">
                <label>
                  Action
                  <select
                    aria-label="What-if action"
                    value={scenario.action}
                    onChange={(e) =>
                      setScenario({ ...scenario, action: e.target.value })
                    }
                  >
                    <option value="move">Move a course</option>
                    <option value="add">Add / retake a course</option>
                    <option value="drop">Drop a course</option>
                    <option value="fail">Simulate failing a course</option>
                  </select>
                </label>
                <label>
                  Course
                  <select
                    aria-label="What-if course"
                    value={scenario.courseCode}
                    onChange={(e) =>
                      setScenario({ ...scenario, courseCode: e.target.value })
                    }
                  >
                    {courses.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} — {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                {["move", "add"].includes(scenario.action) && (
                  <label>
                    To semester
                    <select
                      aria-label="What-if semester"
                      value={scenario.term}
                      onChange={(e) =>
                        setScenario({ ...scenario, term: e.target.value })
                      }
                    >
                      {terms(2026, 2035).map((t) => (
                        <option value={t} key={t}>
                          {termLabel(t)}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <Button onClick={applyScenario}>
                  Preview change
                  <ArrowRight size={15} />
                </Button>
              </div>
              <p>
                Failing removes credit from this scenario and unschedules the
                course. Add a retake to explore a recovery path.
              </p>
            </section>
          )}
          {data.failedCourses.length > 0 && (
            <div className="assumptions">
              <strong>What-if assumptions</strong>
              {data.failedCourses.map((c) => (
                <Badge tone="amber" key={c}>
                  Failed: {c}
                  <button
                    aria-label={`Remove failure assumption ${c}`}
                    onClick={() =>
                      setData({
                        ...data,
                        failedCourses: data.failedCourses.filter(
                          (x) => x !== c,
                        ),
                      })
                    }
                  >
                    <X size={12} />
                  </button>
                </Badge>
              ))}
            </div>
          )}
          <div className="section-heading">
            <h2>
              Your semesters <span>{Object.keys(data.semesters).length}</span>
            </h2>
            <div>
              <button
                className="text-button"
                onClick={() =>
                  download(
                    `${name.replaceAll(" ", "-")}.json`,
                    JSON.stringify(
                      { name, curriculumId: curriculum.id, data, evaluation },
                      null,
                      2,
                    ),
                    "application/json",
                  )
                }
              >
                <Download size={14} />
                Export
              </button>
              <button className="text-button" onClick={() => setAddTerm(true)}>
                <Plus size={15} />
                Add semester
              </button>
            </div>
          </div>
          <div className="semester-grid">
            {Object.entries(data.semesters)
              .sort(([a], [b]) => termOrder(a, b))
              .map(([term, codes]) => {
                const load = codes.reduce(
                    (s, c) => s + (course(c)?.ects || 0),
                    0,
                  ),
                  termIssues = errors.filter((i) => i.term === term),
                  limit = term.includes("SUMMER")
                    ? Math.min(15, curriculum.data.maxEcts)
                    : curriculum.data.maxEcts;
                return (
                  <section
                    key={term}
                    className={`semester-card ${termIssues.length ? "has-error" : ""}`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const code = e.dataTransfer.getData("text/plain");
                      if (course(code)) moveCourse(code, term);
                    }}
                  >
                    <div className="semester-card-heading">
                      <div>
                        <span className="eyebrow">
                          {term === detail.currentTerm
                            ? "CURRENT SEMESTER"
                            : "PLANNED SEMESTER"}
                        </span>
                        <h3>{termLabel(term)}</h3>
                      </div>
                      <div>
                        <strong className={load > limit ? "danger-text" : ""}>
                          {load}
                          <small> / {limit} ECTS</small>
                        </strong>
                        {!codes.length && (
                          <button
                            className="icon-button"
                            aria-label={`Remove empty ${termLabel(term)}`}
                            onClick={() =>
                              setData((old) => {
                                const next = structuredClone(old);
                                delete next.semesters[term];
                                return next;
                              })
                            }
                          >
                            <X size={15} />
                          </button>
                        )}
                      </div>
                    </div>
                    <Progress value={load} max={limit} />
                    <div className="semester-courses">
                      {codes.map((code) => {
                        const c = course(code),
                          issue = termIssues.some((i) => i.courseCode === code);
                        return (
                          <div
                            className={`planned-course ${issue ? "course-error" : ""}`}
                            draggable
                            onDragStart={(e) =>
                              e.dataTransfer.setData("text/plain", code)
                            }
                            key={code}
                          >
                            <GripVertical size={14} className="drag-handle" />
                            <div className="planned-course-name">
                              <span>
                                {code}
                                {c && !c.required && <i>Elective</i>}
                              </span>
                              <strong>
                                {c?.name || "Not in this curriculum"}
                              </strong>
                              {issue && (
                                <small>
                                  <AlertTriangle size={11} />
                                  Needs attention
                                </small>
                              )}
                            </div>
                            <span className="course-ects">
                              {c?.ects || "?"}
                              <small>ECTS</small>
                            </span>
                            <div className="course-actions">
                              <button
                                className="icon-button"
                                aria-label={`Move ${code}`}
                                onClick={() => {
                                  setMove(c || null);
                                  setDestination(term);
                                }}
                              >
                                <ArrowRightLeft size={14} />
                              </button>
                              <button
                                className="icon-button"
                                aria-label={`Un schedule ${code}`}
                                title="Remove from draft"
                                onClick={() => moveCourse(code, null)}
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      {!codes.length && (
                        <div className="drop-zone">
                          Drop a course here or add one from the course list.
                        </div>
                      )}
                    </div>
                    <button
                      className="semester-add"
                      onClick={() => {
                        setDestination(term);
                        setTab("courses");
                        document.getElementById("course-search")?.focus();
                      }}
                    >
                      <Plus size={14} />
                      Add a course
                    </button>
                    {termIssues.length > 0 && (
                      <div className="semester-warning">
                        <AlertTriangle size={13} />
                        {termIssues.length} academic issue
                        {termIssues.length === 1 ? "" : "s"}
                      </div>
                    )}
                  </section>
                );
              })}
          </div>
          {Object.keys(data.semesters).length === 0 && (
            <div className="empty">
              <h3>A blank path, full of possibilities</h3>
              <p>Suggest a path or add a semester to begin.</p>
              <Button onClick={() => setConfirmGenerate(true)}>
                Suggest a path
              </Button>
            </div>
          )}
          <section className="panel validation-panel">
            <div className="panel-heading">
              <div>
                <h2>Academic checks</h2>
                <p>
                  Full-path validation, including effects on later semesters
                </p>
              </div>
              <Badge tone={errors.length ? "red" : "green"}>
                {errors.length} errors
              </Badge>
            </div>
            <div className="panel-body">
              <Issues issues={evaluation.issues} />
            </div>
          </section>
          <section className="panel review-submit">
            <div>
              <Send size={21} />
              <div>
                <h3>Ready for a second opinion?</h3>
                <p>
                  {dirty
                    ? "Save your changes before sending your path to your advisor."
                    : detail.plan.submitted
                      ? "This saved revision has been sent to your advisor."
                      : "Send your saved plan to your assigned advisor for review."}
                </p>
              </div>
            </div>
            <Button
              variant="secondary"
              disabled={dirty || busy || detail.plan.submitted}
              onClick={async () => {
                setBusy(true);
                try {
                  const d = await api<Detail>(
                    `/plans/${detail.plan.id}/submit`,
                    "POST",
                  );
                  await onSaved(d);
                  notify("Plan submitted to your advisor.");
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {detail.plan.submitted ? (
                <>
                  <Check size={15} />
                  Submitted
                </>
              ) : (
                <>
                  <Send size={15} />
                  Request review
                </>
              )}
            </Button>
          </section>
          <button
            className="text-button danger-text delete-plan-link"
            onClick={() => setDeletePlan(true)}
          >
            <Trash2 size={14} />
            Delete this plan
          </button>
        </div>
        <aside className="planner-sidebar">
          <section className="panel course-library">
            <div className="library-tabs">
              <button
                className={tab === "courses" ? "active" : ""}
                onClick={() => setTab("courses")}
              >
                Unscheduled<Badge>{available.length}</Badge>
              </button>
              <button
                className={tab === "electives" ? "active" : ""}
                onClick={() => setTab("electives")}
              >
                Electives
              </button>
            </div>
            {tab === "courses" ? (
              <>
                <label className="search-box">
                  <Search size={15} />
                  <input
                    id="course-search"
                    placeholder="Find a course…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                <p className="library-note">
                  Drag into a semester, or use + to choose a term.
                </p>
                <div className="library-list">
                  {available.map((c) => (
                    <div
                      className="library-course"
                      key={c.code}
                      draggable
                      onDragStart={(e) =>
                        e.dataTransfer.setData("text/plain", c.code)
                      }
                    >
                      <div>
                        <span>
                          {c.code} <small>{c.ects} ECTS</small>
                        </span>
                        <strong>{c.name}</strong>
                        {c.prerequisites.length > 0 && (
                          <small>Requires {c.prerequisites.join(", ")}</small>
                        )}
                      </div>
                      <button
                        className="add-course-button"
                        aria-label={`Add ${c.code}`}
                        onClick={() => setMove(c)}
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  ))}
                  {!available.length && (
                    <div className="library-empty">
                      <Check size={22} />
                      <strong>
                        {search
                          ? "No matching courses"
                          : "Everything has a place"}
                      </strong>
                      <p>
                        {search
                          ? "Try a different code or name."
                          : "Your chosen courses are scheduled. Choose more electives in the next tab."}
                      </p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="elective-groups">
                {curriculum.data.electiveGroups.map((g) => (
                  <div key={g.id}>
                    <h3>
                      {g.name}
                      <Badge>{g.ectsRequired} ECTS</Badge>
                    </h3>
                    <p>Choose courses to meet this requirement.</p>
                    {courses
                      .filter((c) => c.electiveGroup === g.id)
                      .map((c) => (
                        <label className="elective-option" key={c.code}>
                          <input
                            type="checkbox"
                            checked={
                              data.electives.includes(c.code) || passed(c.code)
                            }
                            disabled={passed(c.code)}
                            onChange={(e) => {
                              setData((old) => {
                                const next = structuredClone(old);
                                if (e.target.checked)
                                  next.electives.push(c.code);
                                else {
                                  next.electives = next.electives.filter(
                                    (x) => x !== c.code,
                                  );
                                  for (const term of Object.keys(
                                    next.semesters,
                                  ))
                                    next.semesters[term] = next.semesters[
                                      term
                                    ].filter((x) => x !== c.code);
                                }
                                return next;
                              });
                            }}
                          />
                          <span>
                            <strong>{c.name}</strong>
                            <small>
                              {c.code} · {c.ects} ECTS
                              {passed(c.code) ? " · Completed" : ""}
                            </small>
                          </span>
                        </label>
                      ))}
                  </div>
                ))}
              </div>
            )}
          </section>
          <div className="tip-card">
            <span className="eyebrow">PLAN WITH PERSPECTIVE</span>
            <h3>One move can change the path.</h3>
            <p>
              A prerequisite must be completed before the next course begins.
              Watch the academic checks as you move courses.
            </p>
            <small>
              Draft generation is a constraint-aware starting point, not a
              guaranteed fastest path.
            </small>
          </div>
        </aside>
      </div>
      {move && (
        <Modal title={`Place ${move.code}`} onClose={() => setMove(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              moveCourse(move.code, destination);
            }}
          >
            <div className="modal-body">
              <h3>{move.name}</h3>
              <p>
                {move.ects} ECTS ·{" "}
                {move.prerequisites.length
                  ? "Requires " + move.prerequisites.join(", ")
                  : "No prerequisites"}
              </p>
              <label>
                Semester
                <select
                  aria-label="Destination semester"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                >
                  {terms(2026, 2035).map((t) => (
                    <option key={t} value={t}>
                      {termLabel(t)}
                    </option>
                  ))}
                </select>
              </label>
              <p className="muted">
                The planner will check availability, prerequisites, ECTS and
                timetable conflicts after this change.
              </p>
            </div>
            <div className="modal-actions">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setMove(null)}
              >
                Cancel
              </Button>
              <Button type="submit">Place course</Button>
            </div>
          </form>
        </Modal>
      )}
      {addTerm && (
        <Modal title="Add a semester" onClose={() => setAddTerm(false)}>
          <div className="modal-body">
            <label>
              Semester
              <select
                value={newTerm}
                onChange={(e) => setNewTerm(e.target.value)}
              >
                {terms(2026, 2035)
                  .filter((t) => !data.semesters[t])
                  .map((t) => (
                    <option key={t} value={t}>
                      {termLabel(t)}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setAddTerm(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setData({
                  ...data,
                  semesters: { ...data.semesters, [newTerm]: [] },
                });
                setAddTerm(false);
              }}
            >
              Add semester
            </Button>
          </div>
        </Modal>
      )}
      {confirmGenerate && (
        <Modal
          title="Suggest a starting path?"
          onClose={() => setConfirmGenerate(false)}
        >
          <div className="modal-body">
            <p>
              The planner will arrange remaining core courses and elective
              choices using prerequisites, offerings, class times and ECTS
              limits.
            </p>
            <p className="muted">
              This replaces the semester arrangement in your draft. Your saved
              plan stays available until you save. A valid finish is an
              estimate, not a guarantee of the earliest possible graduation.
            </p>
            {error && <div className="form-error">{error}</div>}
          </div>
          <div className="modal-actions">
            <Button
              variant="secondary"
              onClick={() => setConfirmGenerate(false)}
            >
              Keep draft
            </Button>
            <Button busy={busy} onClick={generate}>
              <Sparkles size={15} />
              Suggest path
            </Button>
          </div>
        </Modal>
      )}
      {deletePlan && (
        <Modal
          title="Delete this saved plan?"
          onClose={() => setDeletePlan(false)}
        >
          <div className="modal-body">
            <p>
              “{detail.plan.name}” and its advisor reviews will be removed. Your
              academic records and other plans are retained.
            </p>
            {error && <div className="form-error">{error}</div>}
          </div>
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setDeletePlan(false)}>
              Keep plan
            </Button>
            <Button
              variant="danger"
              busy={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await api(`/plans/${detail.plan.id}`, "DELETE");
                  onDirty(false);
                  window.location.hash = "overview";
                  window.location.reload();
                } catch (e) {
                  setError((e as Error).message);
                  setBusy(false);
                }
              }}
            >
              Delete plan
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
