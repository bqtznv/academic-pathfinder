package kz.sdu.planner.records;

import java.util.*;
import kz.sdu.planner.shared.Models.AcademicRecord;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class RecordRepository {
  private final JdbcTemplate db;

  public RecordRepository(JdbcTemplate db) {
    this.db = db;
  }

  public List<AcademicRecord> list(UUID student) {
    return db.query(
        "select * from academic_records where student_id=? order by term,course_code",
        (r, i) ->
            new AcademicRecord(
                r.getObject("id", UUID.class),
                r.getString("course_code"),
                r.getString("status"),
                r.getString("grade"),
                r.getString("term"),
                r.getBoolean("approved")),
        student);
  }

  public void save(UUID student, AcademicRecord r) {
    db.update(
        "insert into academic_records(id,student_id,course_code,status,grade,term,approved)"
            + " values(?,?,?,?,?,?,false) on conflict(student_id,course_code,term) do update set"
            + " status=excluded.status,grade=excluded.grade,approved=false",
        UUID.randomUUID(),
        student,
        r.courseCode(),
        r.status(),
        r.grade(),
        r.term());
  }

  public void delete(UUID student, UUID id) {
    if (db.update("delete from academic_records where student_id=? and id=?", student, id) == 0)
      throw new IllegalArgumentException("Record not found.");
  }

  public void approve(UUID student, UUID id) {
    if (db.update(
            "update academic_records set approved=true where student_id=? and id=? and"
                + " status='TRANSFER'",
            student,
            id)
        == 0) throw new IllegalArgumentException("Transfer record not found.");
  }
}
