import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Code2,
  FileUp,
  Pencil,
  Plus,
  Save,
  Send,
  Trash2,
} from "lucide-react";
import { api } from "./api";
import type {
  Course,
  Curriculum,
  CurriculumData,
  Offering,
  Slot,
} from "./types";
import { Badge, Button, Modal } from "./components";
export default function AdminPage({
  notify,
  onRefresh,
}: {
  notify: (s: string) => void;
  onRefresh: () => Promise<void>;
}) {
  const [catalogs, setCatalogs] = useState<Curriculum[]>([]),
    [selected, setSelected] = useState<Curriculum | null>(null),
    [offerings, setOfferings] = useState<Offering[]>([]),
    [tab, setTab] = useState("curriculum");
  const [editor, setEditor] = useState(""),
    [program, setProgram] = useState("Computer Science (EN)"),
    [year, setYear] = useState(2024),
    [preview, setPreview] = useState<CurriculumData | null>(null),
    [editCourse, setEditCourse] = useState<Course | null>(null);
  const [format, setFormat] = useState("JSON"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [impact, setImpact] = useState<{
      affectedStudents: number;
      message: string;
    } | null>(null),
    [showImport, setShowImport] = useState(false),
    [rawImport, setRawImport] = useState("");
  const [offering, setOffering] = useState<Offering>({
      courseCode: "",
      season: "FALL",
      year: null,
      available: true,
      slots: [],
    }),
    [offeringFilter, setOfferingFilter] = useState("");
  async function load(pick?: string) {
    const [c, o] = await Promise.all([
      api<Curriculum[]>("/admin/curricula"),
      api<Offering[]>("/offerings"),
    ]);
    setCatalogs(c);
    setOfferings(o);
    const s = c.find((x) => x.id === pick) || c[0];
    if (s) choose(s);
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);
  function choose(c: Curriculum) {
    setSelected(c);
    setEditor(JSON.stringify(c.data, null, 2));
    setProgram(c.program);
    setYear(c.year);
    setPreview(null);
    setError("");
    setOffering((o) => ({
      ...o,
      courseCode: o.courseCode || c.data.courses[0]?.code || "",
    }));
  }
  async function validate(content = editor, inputFormat = "JSON") {
    setBusy(true);
    setError("");
    try {
      const p = await api<CurriculumData>(
        "/admin/curricula/import-preview",
        "POST",
        { format: inputFormat, content, baseCurriculumId: selected?.id },
      );
      setPreview(p);
      setEditor(JSON.stringify(p, null, 2));
      setShowImport(false);
      notify(
        "Curriculum parsed and validated. Review before saving a new version.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function saveDraft() {
    if (!preview) return;
    setBusy(true);
    setError("");
    try {
      const c = await api<Curriculum>("/admin/curricula", "POST", {
        program,
        year,
        data: preview,
      });
      await load(c.id);
      notify(`Version ${c.version} saved as an unpublished draft.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function updateCourse(c: Course) {
    try {
      const d = JSON.parse(editor) as CurriculumData;
      const index = d.courses.findIndex((x) => x.code === c.code);
      if (index >= 0) d.courses[index] = c;
      else d.courses.push(c);
      setEditor(JSON.stringify(d, null, 2));
      setPreview(null);
      setEditCourse(null);
      notify(
        "Local curriculum edit applied. Validate and save a new version to retain it.",
      );
    } catch {
      setError("Fix the JSON before editing a course.");
    }
  }
  let parsed: CurriculumData | null = null;
  try {
    parsed = JSON.parse(editor);
  } catch {
    /* Editor may temporarily contain incomplete JSON. */
  }
  const dirty = selected && editor !== JSON.stringify(selected.data, null, 2);
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ADMINISTRATION</span>
          <h1>Curriculum management</h1>
          <p>Review every update. Preserve every student’s choices.</p>
        </div>
        <Badge tone="purple">Administrator</Badge>
      </div>
      <div className="admin-tabs">
        <button
          className={tab === "curriculum" ? "active" : ""}
          onClick={() => setTab("curriculum")}
        >
          Curriculum versions
        </button>
        <button
          className={tab === "offerings" ? "active" : ""}
          onClick={() => setTab("offerings")}
        >
          Offerings & timetable
        </button>
      </div>
      {error && (
        <div role="alert" className="form-error">
          {error}
        </div>
      )}
      {tab === "curriculum" ? (
        <>
          <section className="panel admin-version-bar">
            <label>
              Curriculum version
              <select
                aria-label="Curriculum version"
                value={selected?.id || ""}
                onChange={(e) => {
                  const c = catalogs.find((x) => x.id === e.target.value);
                  if (c) choose(c);
                }}
              >
                {catalogs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.program} · {c.year} · v{c.version} · {c.status}
                  </option>
                ))}
              </select>
            </label>
            <div className="button-row">
              {selected && (
                <Badge
                  tone={selected.status === "PUBLISHED" ? "green" : "amber"}
                >
                  {selected.status === "PUBLISHED" ? "Published" : "Draft"}
                </Badge>
              )}
              <Button
                variant="secondary"
                onClick={() => {
                  setShowImport(true);
                  setError("");
                }}
              >
                <FileUp size={16} />
                Import CSV / JSON
              </Button>
              {selected?.status === "DRAFT" && !dirty && (
                <Button
                  busy={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      setImpact(
                        await api(`/admin/curricula/${selected.id}/impact`),
                      );
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <Send size={15} />
                  Review & publish
                </Button>
              )}
            </div>
          </section>
          <div className="admin-editor-grid">
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Prepare a new version</h2>
                  <p>
                    Editing creates a new draft. Existing versions remain
                    intact.
                  </p>
                </div>
                <Code2 size={20} />
              </div>
              <div className="panel-body">
                <div className="form-grid">
                  <label>
                    Program name
                    <input
                      value={program}
                      onChange={(e) => {
                        setProgram(e.target.value);
                        setPreview(null);
                      }}
                    />
                  </label>
                  <label>
                    Curriculum year
                    <input
                      type="number"
                      min={2000}
                      max={2099}
                      value={year}
                      onChange={(e) => {
                        setYear(Number(e.target.value));
                        setPreview(null);
                      }}
                    />
                  </label>
                </div>
                <label>
                  Curriculum data (JSON)
                  <textarea
                    className="code-editor"
                    rows={20}
                    spellCheck={false}
                    value={editor}
                    onChange={(e) => {
                      setEditor(e.target.value);
                      setPreview(null);
                    }}
                  />
                </label>
                <p className="muted">
                  Includes courses, elective groups, totalEcts, maxEcts and
                  minEcts. Prerequisites use course codes. Total ECTS must equal
                  core credits plus elective requirements.
                </p>
                <div className="button-row">
                  <Button
                    variant="secondary"
                    busy={busy}
                    onClick={() => validate()}
                  >
                    <CheckCircle2 size={16} />
                    Validate & preview
                  </Button>
                  <Button disabled={!preview} busy={busy} onClick={saveDraft}>
                    <Save size={16} />
                    Save new draft
                  </Button>
                </div>
                {preview && (
                  <div className="inline-success">
                    <CheckCircle2 size={18} />
                    <div>
                      <strong>
                        Validated: {preview.courses.length} courses ·{" "}
                        {preview.totalEcts} ECTS
                      </strong>
                      <span>
                        Review the course table before saving this draft.
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </section>
            <section className="panel admin-course-preview">
              <div className="panel-heading">
                <div>
                  <h2>Course review</h2>
                  <p>{parsed?.courses?.length || 0} courses in this draft</p>
                </div>
                <Button
                  variant="ghost"
                  onClick={() =>
                    setEditCourse({
                      code: "NEW 101",
                      name: "New course",
                      ects: 5,
                      suggestedSemester: 1,
                      required: true,
                      electiveGroup: null,
                      prerequisites: [],
                    })
                  }
                >
                  <Plus size={15} />
                  Add
                </Button>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>COURSE</th>
                      <th>ECTS</th>
                      <th>TERM</th>
                      <th>
                        <span className="sr-only">Edit course</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed?.courses?.map((c, i) => (
                      <tr key={i}>
                        <td>
                          <strong className="course-code">{c.code}</strong>
                          <small className="block muted">{c.name}</small>
                        </td>
                        <td>{c.ects}</td>
                        <td>{c.suggestedSemester}</td>
                        <td>
                          <button
                            className="icon-button"
                            aria-label={`Edit ${c.code}`}
                            onClick={() => setEditCourse(structuredClone(c))}
                          >
                            <Pencil size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </>
      ) : (
        <>
          <div className="callout blue">
            Course offerings are maintained separately from degree requirements.
            A year-specific entry overrides the recurring entry for that season.
            Every plan is rechecked using current offerings.
          </div>
          <div className="admin-editor-grid">
            <section className="panel">
              <div className="panel-heading">
                <h2>Edit course offering</h2>
              </div>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  setError("");
                  try {
                    await api("/admin/offerings", "PUT", offering);
                    setOfferings(await api("/offerings"));
                    await onRefresh();
                    notify(
                      "Offering saved. Plans now use the updated availability and timetable.",
                    );
                  } catch (err) {
                    setError((err as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <div className="panel-body">
                  <label>
                    Course
                    <select
                      value={offering.courseCode}
                      onChange={(e) =>
                        setOffering({ ...offering, courseCode: e.target.value })
                      }
                    >
                      {selected?.data.courses.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.code} — {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="form-grid">
                    <label>
                      Season
                      <select
                        value={offering.season}
                        onChange={(e) =>
                          setOffering({ ...offering, season: e.target.value })
                        }
                      >
                        <option value="FALL">Fall</option>
                        <option value="SPRING">Spring</option>
                        <option value="SUMMER">Summer</option>
                      </select>
                    </label>
                    <label>
                      Year (blank = recurring)
                      <input
                        type="number"
                        min={2000}
                        max={2099}
                        value={offering.year ?? ""}
                        placeholder="Every year"
                        onChange={(e) =>
                          setOffering({
                            ...offering,
                            year: e.target.value
                              ? Number(e.target.value)
                              : null,
                          })
                        }
                      />
                    </label>
                  </div>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={offering.available}
                      onChange={(e) =>
                        setOffering({
                          ...offering,
                          available: e.target.checked,
                        })
                      }
                    />
                    Available for enrollment
                  </label>
                  <div className="section-heading">
                    <h3>Weekly class slots</h3>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() =>
                        setOffering({
                          ...offering,
                          slots: [
                            ...offering.slots,
                            { day: "MON", start: 540, end: 630 },
                          ],
                        })
                      }
                    >
                      <Plus size={14} />
                      Add slot
                    </button>
                  </div>
                  {offering.slots.map((s, i) => (
                    <SlotEditor
                      key={i}
                      slot={s}
                      update={(slot) =>
                        setOffering({
                          ...offering,
                          slots: offering.slots.map((v, j) =>
                            i === j ? slot : v,
                          ),
                        })
                      }
                      remove={() =>
                        setOffering({
                          ...offering,
                          slots: offering.slots.filter((_, j) => j !== i),
                        })
                      }
                    />
                  ))}
                  {!offering.slots.length && (
                    <p className="muted">
                      No class times specified. Add slots to enable timetable
                      conflict checks for this offering.
                    </p>
                  )}
                  <Button type="submit" busy={busy}>
                    <Save size={15} />
                    Save offering
                  </Button>
                </div>
              </form>
            </section>
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Current offerings</h2>
                  <p>Choose an entry to edit</p>
                </div>
              </div>
              <div className="panel-body">
                <label>
                  Filter course
                  <input
                    placeholder="Code or season…"
                    value={offeringFilter}
                    onChange={(e) => setOfferingFilter(e.target.value)}
                  />
                </label>
              </div>
              <div className="offerings-list">
                {offerings
                  .filter((o) =>
                    (o.courseCode + " " + o.season)
                      .toLowerCase()
                      .includes(offeringFilter.toLowerCase()),
                  )
                  .map((o) => (
                    <button
                      className="offering-list-row"
                      key={o.id}
                      onClick={() => setOffering(structuredClone(o))}
                    >
                      <span>
                        <strong>{o.courseCode}</strong>
                        <small>
                          {o.season} · {o.year || "Recurring"} ·{" "}
                          {o.slots.length} class slots
                        </small>
                      </span>
                      <Badge tone={o.available ? "green" : "red"}>
                        {o.available ? "Available" : "Unavailable"}
                      </Badge>
                      <Pencil size={14} />
                    </button>
                  ))}
              </div>
            </section>
          </div>
        </>
      )}
      {showImport && (
        <Modal
          title="Import curriculum data"
          onClose={() => setShowImport(false)}
          wide
        >
          <div className="modal-body">
            <p className="muted">
              JSON accepts a full curriculum data object. CSV replaces courses
              using the selected version’s elective groups and ECTS limits. CSV
              columns:
              code,name,ects,suggestedSemester,required,electiveGroup,prerequisites.
              Separate prerequisites with |.
            </p>
            <div className="form-grid">
              <label>
                Format
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                >
                  <option>JSON</option>
                  <option>CSV</option>
                </select>
              </label>
              <label>
                Choose file
                <input
                  type="file"
                  accept=".json,.csv"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      if (f.size > 1_000_000) {
                        setError("File must be under 1 MB.");
                        return;
                      }
                      setRawImport(await f.text());
                      setFormat(f.name.endsWith(".csv") ? "CSV" : "JSON");
                    }
                  }}
                />
              </label>
            </div>
            <label>
              Import contents
              <textarea
                rows={12}
                className="code-editor"
                value={rawImport}
                onChange={(e) => setRawImport(e.target.value)}
              />
            </label>
            {error && <div className="form-error">{error}</div>}
          </div>
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setShowImport(false)}>
              Cancel
            </Button>
            <Button
              busy={busy}
              disabled={!rawImport.trim()}
              onClick={() => validate(rawImport, format)}
            >
              Parse & preview
            </Button>
          </div>
        </Modal>
      )}
      {impact && selected && (
        <Modal
          title={`Publish curriculum version ${selected.version}?`}
          onClose={() => setImpact(null)}
        >
          <div className="modal-body">
            <p>
              <strong>
                {selected.program} · {selected.year}
              </strong>
            </p>
            <div className="callout blue">
              {impact.affectedStudents} student(s) use this program and
              curriculum year.
            </div>
            <p>{impact.message}</p>
            <p className="muted">
              Students see an update notice and can preview the new
              requirements. Their saved curriculum version is never silently
              replaced.
            </p>
          </div>
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setImpact(null)}>
              Keep draft
            </Button>
            <Button
              busy={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await api(`/admin/curricula/${selected.id}/publish`, "POST");
                  setImpact(null);
                  await load(selected.id);
                  await onRefresh();
                  notify(
                    "Curriculum published. Previous versions and student plans are preserved.",
                  );
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Publish version
            </Button>
          </div>
        </Modal>
      )}
      {editCourse && (
        <CourseEditor
          course={editCourse}
          groups={parsed?.electiveGroups.map((g) => g.id) || []}
          existing={!!parsed?.courses.some((c) => c.code === editCourse.code)}
          onClose={() => setEditCourse(null)}
          onSave={updateCourse}
        />
      )}
    </>
  );
}
function SlotEditor({
  slot,
  update,
  remove,
}: {
  slot: Slot;
  update: (s: Slot) => void;
  remove: () => void;
}) {
  const time = (n: number) =>
    `${Math.floor(n / 60)
      .toString()
      .padStart(2, "0")}:${(n % 60).toString().padStart(2, "0")}`;
  const minute = (s: string) =>
    Number(s.split(":")[0]) * 60 + Number(s.split(":")[1]);
  return (
    <div className="slot-editor">
      <label>
        Day
        <select
          value={slot.day}
          onChange={(e) => update({ ...slot, day: e.target.value })}
        >
          {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
      </label>
      <label>
        Starts
        <input
          required
          type="time"
          value={time(slot.start)}
          onChange={(e) => update({ ...slot, start: minute(e.target.value) })}
        />
      </label>
      <label>
        Ends
        <input
          required
          type="time"
          value={time(slot.end)}
          onChange={(e) => update({ ...slot, end: minute(e.target.value) })}
        />
      </label>
      <button
        type="button"
        className="icon-button"
        aria-label="Remove class slot"
        onClick={remove}
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}
function CourseEditor({
  course,
  groups,
  existing,
  onClose,
  onSave,
}: {
  course: Course;
  groups: string[];
  existing: boolean;
  onClose: () => void;
  onSave: (c: Course) => void;
}) {
  const [draft, setDraft] = useState(course);
  return (
    <Modal
      title={existing ? `Edit ${course.code}` : "Add course"}
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(draft);
        }}
      >
        <div className="modal-body">
          <label>
            Course code
            <input
              required
              readOnly={existing}
              value={draft.code}
              onChange={(e) =>
                setDraft({ ...draft, code: e.target.value.toUpperCase() })
              }
            />
          </label>
          <label>
            Course name
            <input
              required
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </label>
          <div className="form-grid">
            <label>
              ECTS
              <input
                required
                type="number"
                min={1}
                max={30}
                value={draft.ects}
                onChange={(e) =>
                  setDraft({ ...draft, ects: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Suggested semester
              <input
                required
                type="number"
                min={1}
                max={16}
                value={draft.suggestedSemester}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    suggestedSemester: Number(e.target.value),
                  })
                }
              />
            </label>
          </div>
          <label>
            Requirement type
            <select
              value={draft.required ? "CORE" : draft.electiveGroup || ""}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  required: e.target.value === "CORE",
                  electiveGroup:
                    e.target.value === "CORE" ? null : e.target.value,
                })
              }
            >
              <option value="CORE">Required core</option>
              {groups.map((g) => (
                <option key={g} value={g}>
                  {g} elective
                </option>
              ))}
            </select>
          </label>
          <label>
            Prerequisites (comma-separated)
            <input
              value={draft.prerequisites.join(", ")}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  prerequisites: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
            />
          </label>
          <p className="muted">
            Changing credits may require adjusting totalEcts or elective
            requirements in the JSON editor before validation.
          </p>
        </div>
        <div className="modal-actions">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Apply local edit</Button>
        </div>
      </form>
    </Modal>
  );
}
