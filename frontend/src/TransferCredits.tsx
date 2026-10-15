import { useEffect, useState } from "react";
import { api, termLabel } from "./api";
import type { AcademicRecord, User } from "./types";
import { Badge, Button } from "./components";

export default function TransferCredits({
  notify,
}: {
  notify: (message: string) => void;
}) {
  const [students, setStudents] = useState<User[]>([]);
  const [student, setStudent] = useState("");
  const [records, setRecords] = useState<AcademicRecord[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api<User[]>("/admin/students")
      .then((rows) => {
        setStudents(rows);
        setStudent(rows[0]?.id || "");
      })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    let active = true;
    setRecords([]);
    if (student)
      api<AcademicRecord[]>(`/admin/students/${student}/records`)
        .then((rows) => {
          if (active) setRecords(rows);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
    };
  }, [student]);
  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>Transfer credits</h2>
      </div>
      <div className="panel-body">
        <label>
          Student
          <select
            aria-label="Transfer student"
            value={student}
            onChange={(e) => setStudent(e.target.value)}
          >
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.email}
              </option>
            ))}
          </select>
        </label>
        {error && (
          <div role="alert" className="form-error">
            {error}
          </div>
        )}
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>COURSE</th>
              <th>TERM</th>
              <th>GRADE</th>
              <th>STATUS</th>
              <th>APPROVAL</th>
            </tr>
          </thead>
          <tbody>
            {records
              .filter((r) => r.status === "TRANSFER")
              .map((r) => (
                <tr key={r.id}>
                  <td>{r.courseCode}</td>
                  <td>{termLabel(r.term)}</td>
                  <td>{r.grade || "—"}</td>
                  <td>
                    <Badge tone={r.approved ? "green" : "amber"}>
                      {r.approved ? "Approved" : "Pending"}
                    </Badge>
                  </td>
                  <td>
                    {!r.approved && (
                      <Button
                        variant="secondary"
                        busy={busy}
                        onClick={async () => {
                          setBusy(true);
                          setError("");
                          try {
                            await api(
                              `/admin/students/${student}/records/${r.id}/approve`,
                              "POST",
                            );
                            setRecords(
                              await api(`/admin/students/${student}/records`),
                            );
                            notify("Transfer credit approved.");
                          } catch (e) {
                            setError((e as Error).message);
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        Approve credit
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        {!records.some((r) => r.status === "TRANSFER") && (
          <div className="table-empty">No transfer credits</div>
        )}
      </div>
    </section>
  );
}
