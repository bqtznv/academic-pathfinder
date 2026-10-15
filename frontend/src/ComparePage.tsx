import { useEffect, useState } from "react";
import { ArrowRightLeft, Copy, GitCompareArrows } from "lucide-react";
import { api, termLabel, termOrder } from "./api";
import type { Detail, Plan } from "./types";
import { Badge, Button, Empty, EvaluationSummary } from "./components";
export default function ComparePage({
  plans,
  navigate,
}: {
  plans: Plan[];
  navigate: () => void;
}) {
  const [left, setLeft] = useState(plans[0]?.id || ""),
    [right, setRight] = useState(plans[1]?.id || ""),
    [comparison, setComparison] = useState<{
      left: Detail;
      right: Detail;
    } | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    if (left && right)
      api<{ left: Detail; right: Detail }>(`/plans/${left}/compare/${right}`)
        .then((r) => {
          if (active) {
            setComparison(r);
            setError("");
          }
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
    };
  }, [left, right]);
  const allTerms = comparison
    ? Array.from(
        new Set([
          ...Object.keys(comparison.left.plan.data.semesters),
          ...Object.keys(comparison.right.plan.data.semesters),
        ]),
      ).sort(termOrder)
    : [];
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">EXPLORE YOUR OPTIONS</span>
          <h1>Compare paths</h1>
          <p>Different choices. A clearer view of the consequences.</p>
        </div>
        <Badge tone="blue">
          <GitCompareArrows size={14} />
          What-if comparison
        </Badge>
      </div>
      {plans.length < 2 ? (
        <section className="panel">
          <Empty
            title="Two paths, one decision"
            description="Open the planner, make a change, and use Save as copy to keep an alternative alongside your original path."
          >
            <Button onClick={navigate}>
              <Copy size={16} />
              Open planner
            </Button>
          </Empty>
        </section>
      ) : (
        <>
          <section className="panel comparison-selectors">
            <label>
              Original path
              <select
                aria-label="Original comparison path"
                value={left}
                onChange={(e) => setLeft(e.target.value)}
              >
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <ArrowRightLeft size={22} />
            <label>
              Alternative path
              <select
                aria-label="Alternative comparison path"
                value={right}
                onChange={(e) => setRight(e.target.value)}
              >
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          </section>
          {error && (
            <div role="alert" className="form-error">
              {error}
            </div>
          )}
          {comparison && (
            <>
              <div className="comparison-grid">
                {[comparison.left, comparison.right].map((d, i) => (
                  <section className="panel" key={i}>
                    <div className="panel-heading">
                      <div>
                        <span className="eyebrow">
                          {i ? "ALTERNATIVE" : "ORIGINAL"}
                        </span>
                        <h2>{d.plan.name}</h2>
                      </div>
                      <Badge>Revision {d.plan.revision}</Badge>
                    </div>
                    <EvaluationSummary evaluation={d.evaluation} />
                    <div className="comparison-metrics">
                      <div>
                        <strong>
                          {d.evaluation.earnedEcts + d.evaluation.plannedEcts}
                        </strong>
                        <span>ECTS covered</span>
                      </div>
                      <div>
                        <strong>
                          {
                            d.evaluation.issues.filter(
                              (i) => i.severity === "ERROR",
                            ).length
                          }
                        </strong>
                        <span>Academic errors</span>
                      </div>
                      <div>
                        <strong>{d.evaluation.missingCourses.length}</strong>
                        <span>Missing core courses</span>
                      </div>
                    </div>
                    <div className="panel-body">
                      <span className="label">
                        Target: {termLabel(d.plan.data.target)}
                      </span>
                      <p className="muted">
                        {d.plan.data.failedCourses.length
                          ? `Failure assumptions: ${d.plan.data.failedCourses.join(", ")}`
                          : "No failure assumptions"}
                      </p>
                    </div>
                  </section>
                ))}
              </div>
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Semester-by-semester difference</h2>
                    <p>
                      Courses highlighted in blue appear only in that path’s
                      semester.
                    </p>
                  </div>
                </div>
                <div className="table-wrap">
                  <table className="comparison-table">
                    <thead>
                      <tr>
                        <th>SEMESTER</th>
                        <th>{comparison.left.plan.name}</th>
                        <th>{comparison.right.plan.name}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allTerms.map((term) => (
                        <tr key={term}>
                          <td>
                            <strong>{termLabel(term)}</strong>
                          </td>
                          {[comparison.left, comparison.right].map((d, i) => {
                            const codes = d.plan.data.semesters[term] || [],
                              other =
                                (i ? comparison.left : comparison.right).plan
                                  .data.semesters[term] || [];
                            return (
                              <td key={i}>
                                <div className="comparison-codes">
                                  {codes.map((code) => (
                                    <Badge
                                      key={code}
                                      tone={
                                        other.includes(code)
                                          ? "neutral"
                                          : "blue"
                                      }
                                    >
                                      {code}
                                    </Badge>
                                  ))}
                                  {!codes.length && (
                                    <span className="muted">No courses</span>
                                  )}
                                </div>
                                <small>
                                  {codes.reduce(
                                    (s, c) =>
                                      s +
                                      (d.curriculum.data.courses.find(
                                        (x) => x.code === c,
                                      )?.ects || 0),
                                    0,
                                  )}{" "}
                                  ECTS
                                </small>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </>
      )}
    </>
  );
}
