import { useEffect, useState } from "react";
import {
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Download,
  MessageSquareText,
  Send,
  Users,
} from "lucide-react";
import { api, download, termLabel, termOrder } from "./api";
import type { AcademicRecord, Detail, Plan, Review, User } from "./types";
import { Badge, Button, Empty, EvaluationSummary, Issues } from "./components";
export default function AdvisorPage({
  user,
  detail,
  notify,
  reload,
}: {
  user: User;
  detail: Detail | null;
  notify: (m: string) => void;
  reload: () => Promise<void>;
}) {
  const [students, setStudents] = useState<User[]>([]),
    [studentId, setStudentId] = useState(""),
    [plans, setPlans] = useState<Plan[]>([]),
    [selected, setSelected] = useState<Detail | null>(null),
    [records, setRecords] = useState<AcademicRecord[]>([]);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [decision, setDecision] = useState("CHANGES_REQUESTED"),
    [comment, setComment] = useState("");
  const advisor = user.role !== "STUDENT";
  useEffect(() => {
    if (advisor)
      api<User[]>("/advisor/students")
        .then((s) => {
          setStudents(s);
          setStudentId(s[0]?.id || "");
        })
        .catch((e) => setError(e.message));
  }, [advisor]);
  async function loadStudent(id: string) {
    const [p, r] = await Promise.all([
      api<Plan[]>(`/plans?studentId=${id}`),
      api<AcademicRecord[]>(`/advisor/students/${id}/records`),
    ]);
    setPlans(p);
    setRecords(r);
    setSelected(p.length ? await api<Detail>(`/plans/${p[0].id}`) : null);
  }
  useEffect(() => {
    if (studentId) loadStudent(studentId).catch((e) => setError(e.message));
  }, [studentId]);
  const shown = advisor ? selected : detail;
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">PLAN TOGETHER</span>
          <h1>{advisor ? "Advisor workspace" : "Advisor review"}</h1>
          <p>
            {advisor
              ? "Help students turn their plans into feasible academic paths."
              : "A second perspective on your next steps."}
          </p>
        </div>
        <Badge tone="blue">
          {advisor ? (
            <>
              <Users size={14} />
              {students.length} assigned students
            </>
          ) : (
            <>
              <ClipboardCheck size={14} />
              Academic advising
            </>
          )}
        </Badge>
      </div>
      {error && (
        <div role="alert" className="form-error">
          {error}
        </div>
      )}
      {advisor && (
        <section className="panel advisor-selectors">
          <label>
            Student
            <select
              aria-label="Student"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
            >
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {s.email}
                </option>
              ))}
            </select>
          </label>
          <label>
            Study path
            <select
              aria-label="Study path"
              value={selected?.plan.id || ""}
              onChange={async (e) => {
                try {
                  setSelected(await api<Detail>(`/plans/${e.target.value}`));
                  setComment("");
                  setError("");
                } catch (err) {
                  setError((err as Error).message);
                }
              }}
            >
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.submitted ? " · Submitted" : ""}
                </option>
              ))}
            </select>
          </label>
        </section>
      )}
      {advisor &&
        records.some((r) => r.status === "TRANSFER" && !r.approved) && (
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Transfer credits to review</h2>
                <p>Approve only after confirming equivalent academic credit.</p>
              </div>
              <Badge tone="amber">Approval required</Badge>
            </div>
            <div className="panel-body">
              {records
                .filter((r) => r.status === "TRANSFER" && !r.approved)
                .map((r) => (
                  <div className="transfer-review" key={r.id}>
                    <div>
                      <strong>{r.courseCode}</strong>
                      <p>
                        {termLabel(r.term)} · Grade {r.grade || "not specified"}
                      </p>
                    </div>
                    <Button
                      busy={busy}
                      variant="secondary"
                      onClick={async () => {
                        setBusy(true);
                        try {
                          await api(
                            `/advisor/students/${studentId}/records/${r.id}/approve`,
                            "POST",
                          );
                          await loadStudent(studentId);
                          notify(
                            "Transfer credit approved. Student plans have been rechecked.",
                          );
                        } catch (e) {
                          setError((e as Error).message);
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      Approve credit
                    </Button>
                  </div>
                ))}
            </div>
          </section>
        )}
      {shown ? (
        <>
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>{shown.plan.name}</h2>
                <p>
                  {shown.student.name} · {shown.curriculum.program} · Revision{" "}
                  {shown.plan.revision}
                </p>
              </div>
              <div className="button-row">
                <Badge tone={shown.plan.submitted ? "blue" : "neutral"}>
                  {shown.plan.submitted
                    ? "Submitted for review"
                    : "Not submitted"}
                </Badge>
                <button
                  className="text-button"
                  onClick={() =>
                    download(
                      "advisor-plan-review.json",
                      JSON.stringify(shown, null, 2),
                      "application/json",
                    )
                  }
                >
                  <Download size={15} />
                  Export
                </button>
              </div>
            </div>
            <EvaluationSummary evaluation={shown.evaluation} />
          </section>
          <div className="advisor-columns">
            <div>
              <section className="panel">
                <div className="panel-heading">
                  <h2>Proposed academic path</h2>
                  <Badge>{shown.curriculum.data.maxEcts} ECTS maximum</Badge>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>SEMESTER</th>
                        <th>COURSES</th>
                        <th>ECTS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(shown.plan.data.semesters)
                        .sort(([a], [b]) => termOrder(a, b))
                        .map(([term, codes]) => (
                          <tr key={term}>
                            <td className="nowrap font-medium">
                              {termLabel(term)}
                            </td>
                            <td>
                              <div className="review-course-list">
                                {codes.map((c) => (
                                  <span key={c}>
                                    <b>{c}</b>
                                    {
                                      shown.curriculum.data.courses.find(
                                        (x) => x.code === c,
                                      )?.name
                                    }
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="font-medium">
                              {codes.reduce(
                                (s, c) =>
                                  s +
                                  (shown.curriculum.data.courses.find(
                                    (x) => x.code === c,
                                  )?.ects || 0),
                                0,
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </section>
              <section className="panel">
                <div className="panel-heading">
                  <h2>Validation details</h2>
                </div>
                <div className="panel-body">
                  <Issues issues={shown.evaluation.issues} />
                </div>
              </section>
            </div>
            <div>
              {advisor ? (
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Review this revision</h2>
                      <p>Reviews are tied to the plan and its academic data.</p>
                    </div>
                    <MessageSquareText size={20} />
                  </div>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setBusy(true);
                      setError("");
                      try {
                        setSelected(
                          await api<Detail>(
                            `/plans/${shown.plan.id}/reviews`,
                            "POST",
                            {
                              decision,
                              comment,
                              revision: shown.plan.revision,
                            },
                          ),
                        );
                        setComment("");
                        notify("Advisor review saved.");
                      } catch (err) {
                        setError((err as Error).message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <div className="panel-body">
                      <label>
                        Decision
                        <select
                          value={decision}
                          onChange={(e) => setDecision(e.target.value)}
                        >
                          <option value="CHANGES_REQUESTED">
                            Request changes
                          </option>
                          <option value="APPROVED">
                            Approve academic path
                          </option>
                        </select>
                      </label>
                      <label>
                        Comments
                        <textarea
                          rows={6}
                          required
                          maxLength={3000}
                          value={comment}
                          onChange={(e) => setComment(e.target.value)}
                          placeholder="Explain the recommended changes or confirm the path…"
                        />
                      </label>
                      {!shown.plan.submitted && (
                        <p className="callout amber">
                          The student needs to submit this path before you can
                          record a review.
                        </p>
                      )}
                      <Button
                        type="submit"
                        busy={busy}
                        disabled={!shown.plan.submitted}
                      >
                        <ClipboardCheck size={15} />
                        Save review
                      </Button>
                    </div>
                  </form>
                </section>
              ) : (
                <section className="panel">
                  <div className="panel-heading">
                    <h2>Ask for feedback</h2>
                    <Send size={19} />
                  </div>
                  <div className="panel-body">
                    <p className="muted">
                      Submit your saved academic path to your assigned advisor.
                      Any later plan or academic-data change will make previous
                      feedback outdated.
                    </p>
                    {!user.advisorId && (
                      <p className="callout amber">
                        An advisor has not been assigned to your account yet.
                      </p>
                    )}
                    <Button
                      disabled={shown.plan.submitted || !user.advisorId}
                      busy={busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          await api(`/plans/${shown.plan.id}/submit`, "POST");
                          await reload();
                          notify("Plan sent for advisor review.");
                        } catch (e) {
                          setError((e as Error).message);
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      {shown.plan.submitted ? (
                        <>
                          <CheckCircle2 size={16} />
                          Submitted
                        </>
                      ) : (
                        <>
                          <Send size={16} />
                          Request review
                        </>
                      )}
                    </Button>
                  </div>
                </section>
              )}
              <ReviewHistory reviews={shown.reviews} />
            </div>
          </div>
        </>
      ) : (
        <section className="panel">
          <Empty
            title={
              advisor ? "No student path selected" : "No plan to review yet"
            }
            description={
              advisor
                ? "Select an assigned student with a saved study path."
                : "Create a path in the semester planner, then submit it for feedback."
            }
          />
        </section>
      )}
    </>
  );
}
function ReviewHistory({ reviews }: { reviews: Review[] }) {
  return (
    <section className="panel review-history">
      <div className="panel-heading">
        <h2>Review history</h2>
        <Clock3 size={18} />
      </div>
      {reviews.length ? (
        <div className="panel-body">
          {reviews.map((r, i) => (
            <article className="review-entry" key={r.id}>
              <div>
                <Badge
                  tone={
                    !r.current
                      ? "neutral"
                      : r.decision === "APPROVED"
                        ? "green"
                        : "amber"
                  }
                >
                  {!r.current
                    ? "Outdated"
                    : r.decision === "APPROVED"
                      ? "Approved"
                      : "Changes requested"}
                </Badge>
                <span>
                  v{r.revision}
                  {i === 0 ? " · Latest" : ""}
                </span>
              </div>
              <p>{r.comment}</p>
              <small>
                {r.advisor} ·{" "}
                {new Date(r.createdAt).toLocaleDateString("en-GB", {
                  timeZone: "Asia/Almaty",
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </small>
              {!r.current && (
                <small className="muted">
                  Plan or academic data has changed since this review.
                </small>
              )}
            </article>
          ))}
        </div>
      ) : (
        <div className="panel-body no-reviews">
          <MessageSquareText size={26} />
          <p>No reviews yet. Feedback will appear here.</p>
        </div>
      )}
    </section>
  );
}
