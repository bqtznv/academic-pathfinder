import { useState } from "react";
import {
  Download,
  FileUp,
  Plus,
  Trash2,
  Upload,
  CheckCircle2,
} from "lucide-react";
import { api, download, termLabel, terms } from "./api";
import type { AcademicRecord, Curriculum } from "./types";
import { Badge, Button, Empty, Modal } from "./components";
export default function RecordsPage({
  records,
  curriculum,
  reload,
  notify,
}: {
  records: AcademicRecord[];
  curriculum: Curriculum;
  reload: () => Promise<void>;
  notify: (m: string) => void;
}) {
  const [modal, setModal] = useState<"add" | "import" | null>(null),
    [removing, setRemoving] = useState<AcademicRecord | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [entry, setEntry] = useState<AcademicRecord>({
    courseCode: curriculum.data.courses[0]?.code || "",
    status: "PASSED",
    grade: "B",
    term: "2026-SPRING",
    approved: false,
  });
  const [format, setFormat] = useState("CSV"),
    [content, setContent] = useState(""),
    [preview, setPreview] = useState<{
      rows: AcademicRecord[];
      warnings: string[];
    } | null>(null);
  const [filter, setFilter] = useState("ALL");
  const course = (code: string) =>
    curriculum.data.courses.find((c) => c.code === code);
  async function act(fn: () => Promise<unknown>, message: string) {
    setBusy(true);
    setError("");
    try {
      await fn();
      await reload();
      notify(message);
      setModal(null);
      setRemoving(null);
      setPreview(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function exportRecords() {
    download(
      "academic-records.csv",
      "courseCode,status,grade,term\n" +
        records
          .map((r) => [r.courseCode, r.status, r.grade || "", r.term].join(","))
          .join("\n"),
      "text/csv",
    );
  }
  async function readFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 1_000_000) {
      setError("Choose a file smaller than 1 MB.");
      return;
    }
    setContent(await file.text());
    setFormat(file.name.endsWith(".json") ? "JSON" : "CSV");
    setPreview(null);
    setError("");
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ACADEMIC OPERATIONS</span>
          <h1>Academic records</h1>
          <p>
            Bring your progress into the planner. Every attempt stays part of
            your story.
          </p>
        </div>
        <div className="button-row">
          <Button variant="secondary" onClick={exportRecords}>
            <Download size={16} />
            Export CSV
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setModal("import");
              setError("");
              setPreview(null);
            }}
          >
            <FileUp size={16} />
            Import records
          </Button>
          <Button
            onClick={() => {
              setModal("add");
              setError("");
            }}
          >
            <Plus size={16} />
            Add a record
          </Button>
        </div>
      </div>
      <div className="records-info">
        <CheckCircle2 size={20} />
        <div>
          <strong>Your transcript stays yours</strong>
          <p>
            Imports are previewed before saving. Transfer credits count only
            after advisor approval. Failed attempts are retained; a later pass
            earns credit once.
          </p>
        </div>
      </div>
      <div className="record-stat-row">
        {[
          ["PASSED", "Passed", "green"],
          ["CURRENT", "In progress", "blue"],
          ["FAILED", "Failed", "red"],
          ["TRANSFER", "Transfer credits", "purple"],
        ].map(([key, label, tone]) => (
          <button
            key={key}
            onClick={() => setFilter(filter === key ? "ALL" : key)}
            className={`record-stat ${filter === key ? "active" : ""}`}
          >
            <span className={`status-orb ${tone}`} />
            <span>{label}</span>
            <strong>{records.filter((r) => r.status === key).length}</strong>
          </button>
        ))}
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>
              {filter === "ALL"
                ? "All academic attempts"
                : filter === "TRANSFER"
                  ? "Transfer credits"
                  : filter === "CURRENT"
                    ? "Current enrollment"
                    : filter === "FAILED"
                      ? "Failed attempts"
                      : "Passed courses"}
            </h2>
            <p>
              {
                records.filter((r) => filter === "ALL" || r.status === filter)
                  .length
              }{" "}
              records · {curriculum.program}
            </p>
          </div>
          {filter !== "ALL" && (
            <button className="text-button" onClick={() => setFilter("ALL")}>
              Show all
            </button>
          )}
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>COURSE CODE</th>
                <th>COURSE NAME</th>
                <th>TERM</th>
                <th>ECTS</th>
                <th>GRADE</th>
                <th>STATUS</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {records
                .filter((r) => filter === "ALL" || r.status === filter)
                .slice()
                .reverse()
                .map((r) => (
                  <tr key={r.id}>
                    <td className="course-code">{r.courseCode}</td>
                    <td>
                      {course(r.courseCode)?.name ||
                        "Course from earlier curriculum"}
                    </td>
                    <td>{termLabel(r.term)}</td>
                    <td>{course(r.courseCode)?.ects || "—"}</td>
                    <td className="font-medium">{r.grade || "—"}</td>
                    <td>
                      <Badge
                        tone={
                          r.status === "PASSED"
                            ? "green"
                            : r.status === "CURRENT"
                              ? "blue"
                              : r.status === "FAILED"
                                ? "red"
                                : r.approved
                                  ? "purple"
                                  : "amber"
                        }
                      >
                        {r.status === "PASSED"
                          ? "Passed"
                          : r.status === "CURRENT"
                            ? "In progress"
                            : r.status === "FAILED"
                              ? "Failed"
                              : r.approved
                                ? "Transfer approved"
                                : "Approval pending"}
                      </Badge>
                    </td>
                    <td>
                      <button
                        className="icon-button danger-text"
                        aria-label={`Delete ${r.courseCode} ${r.term}`}
                        onClick={() => {
                          setRemoving(r);
                          setError("");
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {!records.length && (
            <Empty
              title="Let’s start with your progress"
              description="Add completed courses, current enrollment, or transfer credits to build a useful path."
            >
              <Button onClick={() => setModal("add")}>
                Add your first record
              </Button>
            </Empty>
          )}
        </div>
      </section>
      {modal === "add" && (
        <Modal title="Add an academic record" onClose={() => setModal(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              act(
                () => api("/records", "POST", entry),
                "Academic record saved. Plans have been rechecked.",
              );
            }}
          >
            <div className="modal-body">
              <p className="muted">
                A course can have one attempt per term. Saving an existing
                course and term updates that attempt.
              </p>
              <label>
                Course
                <select
                  value={entry.courseCode}
                  onChange={(e) =>
                    setEntry({ ...entry, courseCode: e.target.value })
                  }
                >
                  {curriculum.data.courses.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="form-grid">
                <label>
                  Status
                  <select
                    value={entry.status}
                    onChange={(e) =>
                      setEntry({
                        ...entry,
                        status: e.target.value,
                        grade:
                          e.target.value === "FAILED"
                            ? "F"
                            : e.target.value === "CURRENT"
                              ? ""
                              : "B",
                      })
                    }
                  >
                    <option value="PASSED">Passed</option>
                    <option value="CURRENT">Currently taking</option>
                    <option value="FAILED">Failed</option>
                    <option value="TRANSFER">Transfer credit</option>
                  </select>
                </label>
                <label>
                  Grade
                  <select
                    value={entry.grade}
                    onChange={(e) =>
                      setEntry({ ...entry, grade: e.target.value })
                    }
                  >
                    <option value="">Not graded</option>
                    {[
                      "A",
                      "A-",
                      "B+",
                      "B",
                      "B-",
                      "C+",
                      "C",
                      "C-",
                      "D+",
                      "D",
                      "F",
                      "P",
                      "NP",
                    ].map((g) => (
                      <option key={g}>{g}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                Academic term
                <select
                  value={entry.term}
                  onChange={(e) => setEntry({ ...entry, term: e.target.value })}
                >
                  {terms(2020, 2035).map((t) => (
                    <option key={t} value={t}>
                      {termLabel(t)}
                    </option>
                  ))}
                </select>
              </label>
              {entry.status === "TRANSFER" && (
                <p className="callout amber">
                  Your advisor will need to approve this transfer before it
                  counts toward graduation.
                </p>
              )}
              {error && (
                <div role="alert" className="form-error">
                  {error}
                </div>
              )}
            </div>
            <div className="modal-actions">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setModal(null)}
              >
                Cancel
              </Button>
              <Button type="submit" busy={busy}>
                Save record
              </Button>
            </div>
          </form>
        </Modal>
      )}
      {modal === "import" && (
        <Modal
          title="Import academic records"
          onClose={() => setModal(null)}
          wide
        >
          <div className="modal-body">
            <div className="step-indicator">
              <span className="active">1 · Upload</span>
              <i />
              <span className={preview ? "active" : ""}>2 · Review</span>
              <i />
              <span>3 · Confirm</span>
            </div>
            <p className="muted">
              Use CSV columns <code>courseCode,status,grade,term</code>, or a
              JSON array. Course codes must match your curriculum.
            </p>
            <label className="file-drop">
              <Upload size={24} />
              <strong>Choose a CSV or JSON file</strong>
              <span>Up to 1 MB, or paste its contents below</span>
              <input
                type="file"
                accept=".csv,.json"
                aria-label="Upload academic records"
                onChange={(e) => readFile(e.target.files?.[0])}
              />
            </label>
            <div className="form-grid">
              <label>
                Format
                <select
                  value={format}
                  onChange={(e) => {
                    setFormat(e.target.value);
                    setPreview(null);
                  }}
                >
                  <option>CSV</option>
                  <option>JSON</option>
                </select>
              </label>
              <div className="template-link">
                <button
                  className="text-button"
                  onClick={() =>
                    download(
                      "records-template.csv",
                      "courseCode,status,grade,term\nCSS 109,PASSED,B+,2024-FALL\nCSS 112,PASSED,A-,2024-FALL",
                      "text/csv",
                    )
                  }
                >
                  <Download size={14} />
                  Download template
                </button>
              </div>
            </div>
            <label>
              File contents
              <textarea
                rows={7}
                value={content}
                placeholder={
                  "courseCode,status,grade,term\nCSS 109,PASSED,B+,2024-FALL"
                }
                onChange={(e) => {
                  setContent(e.target.value);
                  setPreview(null);
                }}
              />
            </label>
            {error && (
              <div role="alert" className="form-error">
                {error}
              </div>
            )}
            {preview && (
              <div className="import-preview">
                <h3>
                  {preview.rows.length} matched records — review before saving
                </h3>
                {preview.warnings.map((w, i) => (
                  <p key={i} className="callout amber">
                    {w}
                  </p>
                ))}
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>COURSE</th>
                        <th>NAME</th>
                        <th>STATUS</th>
                        <th>GRADE</th>
                        <th>TERM</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.map((r, i) => (
                        <tr key={i}>
                          <td>{r.courseCode}</td>
                          <td>{course(r.courseCode)?.name}</td>
                          <td>{r.status}</td>
                          <td>{r.grade}</td>
                          <td>{termLabel(r.term)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setModal(null)}>
              Cancel
            </Button>
            {preview ? (
              <Button
                busy={busy}
                onClick={() =>
                  act(
                    () =>
                      api("/records/import", "POST", { rows: preview.rows }),
                    "Imported records saved. All plans have been rechecked.",
                  )
                }
              >
                Confirm & save {preview.rows.length} records
              </Button>
            ) : (
              <Button
                busy={busy}
                disabled={!content.trim()}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    setPreview(
                      await api("/records/import-preview", "POST", {
                        format,
                        content,
                      }),
                    );
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Preview matched records
              </Button>
            )}
          </div>
        </Modal>
      )}
      {removing && (
        <Modal
          title="Remove this academic attempt?"
          onClose={() => setRemoving(null)}
        >
          <div className="modal-body">
            <p>
              <strong>{removing.courseCode}</strong> ·{" "}
              {course(removing.courseCode)?.name}
              <br />
              {termLabel(removing.term)} · {removing.status}
            </p>
            <p className="muted">
              Plans and graduation estimates will be checked again using the
              remaining records.
            </p>
            {error && <div className="form-error">{error}</div>}
          </div>
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setRemoving(null)}>
              Keep record
            </Button>
            <Button
              variant="danger"
              busy={busy}
              onClick={() =>
                act(
                  () => api(`/records/${removing.id}`, "DELETE"),
                  "Record removed. Plans have been rechecked.",
                )
              }
            >
              Remove record
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
