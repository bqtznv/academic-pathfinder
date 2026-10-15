package kz.sdu.planner.planning;

import static org.springframework.http.HttpStatus.*;

import java.sql.*;
import java.util.*;
import kz.sdu.planner.shared.*;
import kz.sdu.planner.shared.Models.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.web.server.ResponseStatusException;

@Repository
public class PlanRepository {
  private final JdbcTemplate db;
  private final Json json;

  public PlanRepository(JdbcTemplate db, Json j) {
    this.db = db;
    json = j;
  }

  private Plan map(ResultSet r, int n) throws SQLException {
    return new Plan(
        r.getObject("id", UUID.class),
        r.getObject("student_id", UUID.class),
        r.getString("name"),
        r.getObject("curriculum_id", UUID.class),
        json.read(r.getString("data"), PlanData.class),
        r.getInt("revision"),
        r.getBoolean("submitted"),
        r.getString("updated_at"));
  }

  public Plan get(UUID id) {
    return db.query("select * from plans where id=?", this::map, id).stream()
        .findFirst()
        .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Plan not found."));
  }

  public List<Plan> list(UUID student) {
    return db.query(
        "select * from plans where student_id=? order by updated_at desc", this::map, student);
  }

  public Plan create(UUID student, String name, UUID curriculum, PlanData data) {
    UUID id = UUID.randomUUID();
    db.update(
        "insert into plans(id,student_id,name,curriculum_id,data) values(?,?,?,?,?::jsonb)",
        id,
        student,
        name,
        curriculum,
        json.write(data));
    return get(id);
  }

  public Plan save(UUID id, int revision, String name, UUID curriculum, PlanData data) {
    if (db.update(
            "update plans set"
                + " name=?,curriculum_id=?,data=?::jsonb,revision=revision+1,submitted=false,updated_at=now()"
                + " where id=? and revision=?",
            name,
            curriculum,
            json.write(data),
            id,
            revision)
        == 0)
      throw new ResponseStatusException(
          CONFLICT, "This plan changed in another window. Reload before saving.");
    return get(id);
  }

  public void submit(UUID id) {
    db.update("update plans set submitted=true where id=?", id);
  }

  public void delete(UUID id) {
    db.update("delete from plans where id=?", id);
  }

  public List<Review> reviews(UUID plan, int revision, String hash) {
    return db.query(
        "select r.*,u.name as advisor from reviews r join users u on u.id=r.advisor_id where"
            + " plan_id=? order by created_at desc",
        (r, i) ->
            new Review(
                r.getObject("id", UUID.class),
                r.getString("advisor"),
                r.getInt("revision"),
                r.getString("decision"),
                r.getString("comment"),
                r.getString("created_at"),
                revision == r.getInt("revision") && hash.equals(r.getString("context_hash"))),
        plan);
  }

  public void review(Plan p, UUID advisor, String decision, String comment, String hash) {
    db.update(
        "insert into reviews(id,plan_id,advisor_id,revision,decision,comment,context_hash)"
            + " values(?,?,?,?,?,?,?)",
        UUID.randomUUID(),
        p.id(),
        advisor,
        p.revision(),
        decision,
        comment,
        hash);
  }
}
