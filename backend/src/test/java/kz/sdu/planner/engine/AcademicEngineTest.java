package kz.sdu.planner.engine;

import static org.junit.jupiter.api.Assertions.*;

import java.util.*;
import kz.sdu.planner.shared.Csv;
import kz.sdu.planner.shared.Models.*;
import org.junit.jupiter.api.Test;

class AcademicEngineTest {
  final AcademicEngine engine = new AcademicEngine();

  Course course(String code, boolean required, String group, String... pre) {
    return new Course(code, code, 5, 1, required, group, List.of(pre));
  }

  Curriculum curriculum() {
    return new Curriculum(
        UUID.randomUUID(),
        "CS",
        2024,
        1,
        "PUBLISHED",
        new CurriculumData(
            List.of(
                course("A", true, null),
                course("B", true, null, "A"),
                course("C", true, null, "B"),
                course("E1", false, "E"),
                course("E2", false, "E")),
            List.of(new ElectiveGroup("E", "Electives", 5)),
            20,
            10,
            5));
  }

  Offering offering(String code, String season, int start) {
    return new Offering(
        UUID.randomUUID(), code, season, null, true, List.of(new Slot("MON", start, start + 60)));
  }

  List<Offering> offerings() {
    return List.of(
        offering("A", "FALL", 540),
        offering("B", "SPRING", 540),
        offering("C", "FALL", 540),
        offering("E1", "FALL", 660),
        offering("E2", "SPRING", 660));
  }

  AcademicRecord passed() {
    return new AcademicRecord(UUID.randomUUID(), "A", "PASSED", "B", "2024-FALL", false);
  }

  PlanData valid() {
    return new PlanData(
        Map.of("2025-SPRING", List.of("B"), "2025-FALL", List.of("C", "E1")),
        List.of("E1"),
        "2025-FALL",
        List.of());
  }

  boolean has(Evaluation e, String code) {
    return e.issues().stream().anyMatch(i -> i.code().equals(code));
  }

  @Test
  void completePathHasConditionalGraduation() {
    var e = engine.evaluate(curriculum(), offerings(), List.of(passed()), valid());
    assertTrue(e.valid());
    assertTrue(e.complete());
    assertEquals("2025-FALL", e.graduation());
    assertEquals("ON_TRACK", e.targetStatus());
    assertEquals(5, e.earnedEcts());
    assertEquals(15, e.plannedEcts());
  }

  @Test
  void sameSemesterPrerequisiteCannotCount() {
    var p =
        new PlanData(Map.of("2025-FALL", List.of("B", "C", "E1")), List.of("E1"), null, List.of());
    var e = engine.evaluate(curriculum(), offerings(), List.of(passed()), p);
    assertTrue(has(e, "PREREQUISITE"));
    assertNull(e.graduation());
  }

  @Test
  void missingCoursePreventsGraduationWithoutFabricatingDate() {
    var p = new PlanData(Map.of("2025-SPRING", List.of("B")), List.of(), null, List.of());
    var e = engine.evaluate(curriculum(), offerings(), List.of(passed()), p);
    assertTrue(e.valid());
    assertFalse(e.complete());
    assertNull(e.graduation());
    assertTrue(e.missingCourses().contains("C"));
    assertTrue(has(e, "ELECTIVE_CREDITS"));
  }

  @Test
  void loadsDuplicatesAndCompletedCourseAreFlagged() {
    var p =
        new PlanData(
            Map.of("2025-FALL", List.of("A", "B", "C", "C", "E1")), List.of("E1"), null, List.of());
    var e = engine.evaluate(curriculum(), offerings(), List.of(passed()), p);
    assertTrue(has(e, "ECTS_OVERLOAD"));
    assertTrue(has(e, "DUPLICATE"));
    assertTrue(has(e, "ALREADY_PASSED"));
    assertNull(e.graduation());
  }

  @Test
  void yearlyUnavailableOverrideWinsOverRecurringOffering() {
    var os = new ArrayList<>(offerings());
    os.add(new Offering(UUID.randomUUID(), "C", "FALL", 2025, false, List.of()));
    var e = engine.evaluate(curriculum(), os, List.of(passed()), valid());
    assertTrue(has(e, "NOT_OFFERED"));
    assertNull(e.graduation());
  }

  @Test
  void timetableOverlapDetectedButAdjacentClassesAreAllowed() {
    var os = new ArrayList<>(offerings());
    os.add(
        new Offering(
            UUID.randomUUID(), "E1", "FALL", 2025, true, List.of(new Slot("MON", 570, 630))));
    assertTrue(
        has(engine.evaluate(curriculum(), os, List.of(passed()), valid()), "TIMETABLE_CONFLICT"));
    os.set(
        os.size() - 1,
        new Offering(
            UUID.randomUUID(), "E1", "FALL", 2025, true, List.of(new Slot("MON", 600, 660))));
    assertFalse(
        has(engine.evaluate(curriculum(), os, List.of(passed()), valid()), "TIMETABLE_CONFLICT"));
  }

  @Test
  void unapprovedTransferDoesNotEarnCreditOrMeetPrerequisite() {
    var transfer = new AcademicRecord(UUID.randomUUID(), "A", "TRANSFER", "P", "2024-FALL", false);
    var e = engine.evaluate(curriculum(), offerings(), List.of(transfer), valid());
    assertEquals(0, e.earnedEcts());
    assertTrue(has(e, "TRANSFER_PENDING"));
    assertTrue(has(e, "PREREQUISITE"));
  }

  @Test
  void approvedTransferAndRetakeAreCountedOnce() {
    var transfer = new AcademicRecord(UUID.randomUUID(), "A", "TRANSFER", "P", "2024-FALL", true);
    var e =
        engine.evaluate(
            curriculum(),
            offerings(),
            List.of(
                transfer,
                passed(),
                new AcademicRecord(UUID.randomUUID(), "A", "FAILED", "F", "2024-SPRING", false)),
            valid());
    assertEquals(5, e.earnedEcts());
    assertTrue(e.valid());
  }

  @Test
  void failureAssumptionDoesNotMutateAcademicHistory() {
    var original = valid();
    var scenario =
        new PlanData(original.semesters(), original.electives(), original.target(), List.of("A"));
    var history = List.of(passed());
    var e = engine.evaluate(curriculum(), offerings(), history, scenario);
    assertEquals(0, e.earnedEcts());
    assertTrue(has(e, "PREREQUISITE"));
    assertEquals("PASSED", history.getFirst().status());
    assertTrue(engine.evaluate(curriculum(), offerings(), history, original).valid());
  }

  @Test
  void targetIsNeverConfirmedForInvalidOrIncompletePlan() {
    var p = new PlanData(Map.of(), List.of(), "2025-SPRING", List.of());
    var e = engine.evaluate(curriculum(), offerings(), List.of(), p);
    assertEquals("UNCONFIRMED", e.targetStatus());
    assertNull(e.graduation());
    var v = valid();
    assertEquals(
        "AFTER_TARGET",
        engine
            .evaluate(
                curriculum(),
                offerings(),
                List.of(passed()),
                new PlanData(v.semesters(), v.electives(), "2025-SPRING", List.of()))
            .targetStatus());
  }

  @Test
  void csvSupportsQuotedNamesAndRejectsTruncatedRows() {
    var rows = Csv.parse("code,name\r\nA,\"Course, advanced\"\r\n");
    assertEquals("Course, advanced", rows.getFirst().get("name"));
    assertThrows(IllegalArgumentException.class, () -> Csv.parse("a,b\nonlyone\n"));
    assertThrows(IllegalArgumentException.class, () -> Csv.parse("a,b\n\"unfinished,x"));
  }

  @Test
  void backdatedFuturePlansCannotConfirmGraduation() {
    var e =
        engine.evaluate(
            curriculum(), offerings(), List.of(passed()), valid(), new Term(2026, "FALL"));
    assertTrue(has(e, "PAST_SEMESTER"));
    assertNull(e.graduation());
  }

  @Test
  void curriculumUpgradeFlagsRemovedElectiveChoices() {
    var p = new PlanData(valid().semesters(), List.of("REMOVED"), null, List.of());
    var e = engine.evaluate(curriculum(), offerings(), List.of(passed()), p);
    assertTrue(has(e, "INVALID_ELECTIVE"));
    assertFalse(e.valid());
  }
}
