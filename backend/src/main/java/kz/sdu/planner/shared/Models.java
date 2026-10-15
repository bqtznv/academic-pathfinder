package kz.sdu.planner.shared;

import java.util.*;

/**
 * Immutable values exchanged across module interfaces. The engine has no persistence dependency.
 */
public final class Models {
  private Models() {}

  public record User(
      UUID id, String email, String name, String role, String program, int curriculumYear) {}

  public record Course(
      String code,
      String name,
      int ects,
      int suggestedSemester,
      boolean required,
      String electiveGroup,
      List<String> prerequisites) {}

  public record ElectiveGroup(String id, String name, int ectsRequired) {}

  public record CurriculumData(
      List<Course> courses,
      List<ElectiveGroup> electiveGroups,
      int totalEcts,
      int maxEcts,
      int minEcts) {}

  public record Curriculum(
      UUID id, String program, int year, int version, String status, CurriculumData data) {}

  public record Slot(String day, int start, int end) {}

  public record Offering(
      UUID id,
      String courseCode,
      String season,
      Integer year,
      boolean available,
      List<Slot> slots) {}

  public record AcademicRecord(
      UUID id, String courseCode, String status, String grade, String term, boolean approved) {}

  public record Term(int year, String season) implements Comparable<Term> {
    public static Term parse(String s) {
      if (s == null || !s.matches("(20[0-9]{2})-(SPRING|SUMMER|FALL)"))
        throw new IllegalArgumentException(
            "Semester must use YYYY-FALL, YYYY-SPRING or YYYY-SUMMER.");
      String[] v = s.split("-");
      return new Term(Integer.parseInt(v[0]), v[1]);
    }

    public int ordinal() {
      return year * 3
          + switch (season) {
            case "SPRING" -> 0;
            case "SUMMER" -> 1;
            case "FALL" -> 2;
            default -> throw new IllegalArgumentException("Invalid season.");
          };
    }

    public Term next() {
      return switch (season) {
        case "SPRING" -> new Term(year, "SUMMER");
        case "SUMMER" -> new Term(year, "FALL");
        default -> new Term(year + 1, "SPRING");
      };
    }

    @Override
    public int compareTo(Term other) {
      return Integer.compare(ordinal(), other.ordinal());
    }

    @Override
    public String toString() {
      return year + "-" + season;
    }
  }

  public record PlanData(
      Map<String, List<String>> semesters,
      List<String> electives,
      String target,
      List<String> failedCourses) {}

  public record Plan(
      UUID id,
      UUID studentId,
      String name,
      UUID curriculumId,
      PlanData data,
      int revision,
      String updatedAt) {}

  public record Issue(
      String severity, String code, String message, String term, String courseCode) {}

  public record Requirement(String id, String name, int required, int earned, int planned) {}

  public record Evaluation(
      boolean valid,
      boolean complete,
      String graduation,
      String targetStatus,
      int earnedEcts,
      int plannedEcts,
      int totalEcts,
      List<Issue> issues,
      List<String> missingCourses,
      List<Requirement> requirements) {}
}
