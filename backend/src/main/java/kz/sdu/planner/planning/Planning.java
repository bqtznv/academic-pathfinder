package kz.sdu.planner.planning;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.util.*;
import kz.sdu.planner.accounts.*;
import kz.sdu.planner.curriculum.CurriculumService;
import kz.sdu.planner.engine.AcademicEngine;
import kz.sdu.planner.records.StudentRecords;
import kz.sdu.planner.shared.*;
import kz.sdu.planner.shared.Models.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class Planning {
  private final CurriculumService curricula;
  private final StudentRecords records;
  private final PlanRepository plans;
  private final AccountRepository users;
  private final Json json;
  private final AcademicEngine engine = new AcademicEngine();
  private final LocalDate date;

  public Planning(
      CurriculumService c,
      StudentRecords r,
      PlanRepository p,
      AccountRepository u,
      Json j,
      @Value("${app.clock-date}") String d) {
    curricula = c;
    records = r;
    plans = p;
    users = u;
    json = j;
    date = LocalDate.parse(d);
  }

  public Term currentTerm() {
    return new Term(
        date.getYear(),
        date.getMonthValue() < 6 ? "SPRING" : date.getMonthValue() < 8 ? "SUMMER" : "FALL");
  }

  public void validate(PlanData p) {
    if (p == null
        || p.semesters() == null
        || p.electives() == null
        || p.failedCourses() == null
        || p.semesters().size() > 30
        || p.electives().size() > 1000
        || p.failedCourses().size() > 1000)
      throw new IllegalArgumentException(
          "Plan needs semesters, electives and failedCourses (maximum 30 semesters).");
    for (var e : p.semesters().entrySet()) {
      Term.parse(e.getKey());
      if (e.getValue() == null
          || e.getValue().size() > 1000
          || e.getValue().stream().anyMatch(Objects::isNull))
        throw new IllegalArgumentException("Invalid course list.");
    }
    if (p.target() != null && !p.target().isBlank()) Term.parse(p.target());
  }

  public Curriculum compatible(UUID student, UUID id) {
    var u = users.get(student);
    var c = id == null ? curricula.latest(u.program(), u.curriculumYear()) : curricula.get(id);
    if (!c.status().equals("PUBLISHED")
        || !c.program().equals(u.program())
        || c.year() != u.curriculumYear())
      throw new IllegalArgumentException(
          "Choose a published curriculum for this student's program and year.");
    return c;
  }

  public Evaluation evaluate(UUID student, UUID curriculum, PlanData data) {
    validate(data);
    return engine.evaluate(
        curricula.get(curriculum),
        curricula.offerings(),
        records.list(student),
        data,
        currentTerm());
  }

  public PlanData generate(UUID student, UUID curriculum, PlanData previous) {
    return engine.generate(
        curricula.get(curriculum),
        curricula.offerings(),
        records.list(student),
        currentTerm(),
        previous == null ? List.of() : previous.electives(),
        previous == null ? null : previous.target(),
        previous == null ? List.of() : previous.failedCourses());
  }

  public String hash(Plan p) {
    try {
      String input =
          json.write(
              List.of(
                  p.data(),
                  curricula.get(p.curriculumId()),
                  records.list(p.studentId()),
                  curricula.offerings()));
      return HexFormat.of()
          .formatHex(
              MessageDigest.getInstance("SHA-256").digest(input.getBytes(StandardCharsets.UTF_8)));
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }

  public Map<String, Object> detail(Plan p) {
    var c = curricula.get(p.curriculumId());
    return Map.of(
        "plan",
        p,
        "curriculum",
        c,
        "latestCurriculum",
        curricula.latest(c.program(), c.year()),
        "evaluation",
        evaluate(p.studentId(), p.curriculumId(), p.data()),
        "reviews",
        plans.reviews(p.id(), p.revision(), hash(p)),
        "student",
        users.get(p.studentId()),
        "currentTerm",
        currentTerm().toString());
  }
}
