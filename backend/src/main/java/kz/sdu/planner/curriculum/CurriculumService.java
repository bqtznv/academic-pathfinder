package kz.sdu.planner.curriculum;

import java.util.*;
import kz.sdu.planner.shared.Models.*;
import org.springframework.stereotype.Service;

@Service
public class CurriculumService {
  private final CurriculumRepository repository;

  public CurriculumService(CurriculumRepository r) {
    repository = r;
  }

  public Curriculum latest(String program, int year) {
    return repository.latest(program, year);
  }

  public Curriculum get(UUID id) {
    return repository.get(id);
  }

  public List<Offering> offerings() {
    return repository.offerings();
  }

  public void validate(CurriculumData d) {
    if (d == null
        || d.courses() == null
        || d.courses().isEmpty()
        || d.courses().size() > 1000
        || d.electiveGroups() == null
        || d.maxEcts() < 1
        || d.maxEcts() > 60
        || d.minEcts() < 0
        || d.minEcts() > d.maxEcts())
      throw new IllegalArgumentException(
          "Provide courses, electiveGroups and sensible ECTS limits (maximum 60).");
    var codes = new HashSet<String>();
    var groups = new HashSet<String>();
    for (var g : d.electiveGroups())
      if (g.id() == null
          || g.id().isBlank()
          || g.name() == null
          || g.name().isBlank()
          || g.ectsRequired() < 1
          || !groups.add(g.id()))
        throw new IllegalArgumentException(
            "Elective groups need unique IDs, names and positive credits.");
    for (var c : d.courses()) {
      if (c.code() == null
          || !c.code().matches("[A-Z0-9][A-Z0-9 _-]{1,29}")
          || !codes.add(c.code())
          || c.name() == null
          || c.name().isBlank()
          || c.name().length() > 200
          || c.ects() < 1
          || c.ects() > 30
          || c.suggestedSemester() < 1
          || c.suggestedSemester() > 16
          || c.prerequisites() == null)
        throw new IllegalArgumentException(
            "Courses need unique uppercase codes, names, 1–30 ECTS, suggested semesters 1–16 and"
                + " prerequisites.");
      if (c.required() && c.electiveGroup() != null && !c.electiveGroup().isBlank()
          || !c.required() && !groups.contains(c.electiveGroup()))
        throw new IllegalArgumentException(
            "Every elective must belong to a group; required courses cannot belong to elective"
                + " groups.");
    }
    var graph = new HashMap<String, List<String>>();
    for (var c : d.courses()) {
      if (!codes.containsAll(c.prerequisites()))
        throw new IllegalArgumentException("Unknown prerequisite for " + c.code() + ".");
      graph.put(c.code(), c.prerequisites());
    }
    var visited = new HashSet<String>();
    for (String code : codes) cycle(code, graph, new HashSet<>(), visited);
    for (var g : d.electiveGroups())
      if (d.courses().stream()
              .filter(c -> g.id().equals(c.electiveGroup()))
              .mapToInt(Course::ects)
              .sum()
          < g.ectsRequired())
        throw new IllegalArgumentException(
            "Not enough elective credits offered for " + g.name() + ".");
    int total =
        d.courses().stream().filter(Course::required).mapToInt(Course::ects).sum()
            + d.electiveGroups().stream().mapToInt(ElectiveGroup::ectsRequired).sum();
    if (d.totalEcts() != total)
      throw new IllegalArgumentException(
          "Total ECTS must equal required-course credits plus elective requirements ("
              + total
              + ").");
  }

  private void cycle(
      String code, Map<String, List<String>> graph, Set<String> path, Set<String> visited) {
    if (visited.contains(code)) return;
    if (!path.add(code)) throw new IllegalArgumentException("Prerequisite cycle at " + code + ".");
    for (String p : graph.get(code)) cycle(p, graph, path, visited);
    path.remove(code);
    visited.add(code);
  }

  public void validateOffering(Offering o) {
    if (o.courseCode() == null
        || !Set.of("FALL", "SPRING", "SUMMER").contains(o.season())
        || o.year() != null && (o.year() < 2000 || o.year() > 2099)
        || o.slots() == null) throw new IllegalArgumentException("Invalid course offering.");
    if (repository.list(true).stream()
        .noneMatch(c -> c.data().courses().stream().anyMatch(x -> x.code().equals(o.courseCode()))))
      throw new IllegalArgumentException("Unknown course code.");
    for (var s : o.slots())
      if (!Set.of("MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN").contains(s.day())
          || s.start() < 0
          || s.end() > 1440
          || s.start() >= s.end())
        throw new IllegalArgumentException(
            "Class slots need day MON–SUN and start/end minutes from midnight.");
  }
}
