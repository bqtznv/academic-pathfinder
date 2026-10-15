package kz.sdu.planner.curriculum;

import java.sql.*;
import java.util.*;
import kz.sdu.planner.shared.*;
import kz.sdu.planner.shared.Models.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class CurriculumRepository {
  private final JdbcTemplate db;
  private final Json json;

  public CurriculumRepository(JdbcTemplate db, Json json) {
    this.db = db;
    this.json = json;
  }

  private Curriculum map(ResultSet r, int i) throws SQLException {
    return new Curriculum(
        r.getObject("id", UUID.class),
        r.getString("program"),
        r.getInt("year"),
        r.getInt("version"),
        r.getString("status"),
        json.read(r.getString("data"), CurriculumData.class));
  }

  public List<Curriculum> list(boolean drafts) {
    return db.query(
        "select * from curricula "
            + (drafts ? "" : "where status='PUBLISHED' ")
            + "order by program,year,version desc",
        this::map);
  }

  public Curriculum get(UUID id) {
    return db.query("select * from curricula where id=?", this::map, id).stream()
        .findFirst()
        .orElseThrow(() -> new IllegalArgumentException("Curriculum not found."));
  }

  public Curriculum latest(String program, int year) {
    return db
        .query(
            "select * from curricula where program=? and year=? and status='PUBLISHED' order by"
                + " version desc limit 1",
            this::map,
            program,
            year)
        .stream()
        .findFirst()
        .orElseThrow(
            () ->
                new IllegalArgumentException("No published curriculum for this program and year."));
  }

  public Curriculum draft(String program, int year, CurriculumData data) {
    UUID id = UUID.randomUUID();
    Integer version =
        db.queryForObject(
            "select coalesce(max(version),0)+1 from curricula where program=? and year=?",
            Integer.class,
            program,
            year);
    db.update(
        "insert into curricula(id,program,year,version,status,data)"
            + " values(?,?,?,?,'DRAFT',?::jsonb)",
        id,
        program,
        year,
        version,
        json.write(data));
    return get(id);
  }

  public void publish(UUID id) {
    db.update(
        "update curricula set status='PUBLISHED',published_at=now() where id=? and status='DRAFT'",
        id);
  }

  public int affected(Curriculum c) {
    return db.queryForObject(
        "select count(*) from users where role='STUDENT' and program=? and curriculum_year=?",
        Integer.class,
        c.program(),
        c.year());
  }

  public List<Offering> offerings() {
    return db.query(
        "select * from offerings order by course_code,season,year",
        (r, i) ->
            new Offering(
                r.getObject("id", UUID.class),
                r.getString("course_code"),
                r.getString("season"),
                (Integer) r.getObject("year"),
                r.getBoolean("available"),
                Arrays.asList(json.read(r.getString("slots"), Slot[].class))));
  }

  public void offering(Offering o) {
    db.update(
        "insert into offerings(id,course_code,season,year,available,slots)"
            + " values(?,?,?,?,?,?::jsonb) on conflict(course_code,season,year) do update set"
            + " available=excluded.available,slots=excluded.slots",
        UUID.randomUUID(),
        o.courseCode(),
        o.season(),
        o.year(),
        o.available(),
        json.write(o.slots()));
  }
}
