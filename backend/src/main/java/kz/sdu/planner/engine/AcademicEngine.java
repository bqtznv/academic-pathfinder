package kz.sdu.planner.engine;

import java.util.*;
import java.util.stream.Collectors;
import kz.sdu.planner.shared.Models.*;

/**
 * Pure academic rules. Inputs are immutable snapshots; no Spring, repositories or database calls.
 */
public class AcademicEngine {
  public Evaluation evaluate(
      Curriculum curriculum,
      List<Offering> offerings,
      List<AcademicRecord> records,
      PlanData plan) {
    return evaluate(curriculum, offerings, records, plan, null);
  }

  public Evaluation evaluate(
      Curriculum curriculum,
      List<Offering> offerings,
      List<AcademicRecord> records,
      PlanData plan,
      Term currentTerm) {
    var courses =
        curriculum.data().courses().stream().collect(Collectors.toMap(Course::code, c -> c));
    var issues = new ArrayList<Issue>();
    for (String code : plan.electives())
      if (!courses.containsKey(code) || courses.get(code).required())
        issues.add(
            issue(
                "INVALID_ELECTIVE",
                "Elective choice is not an elective in this curriculum.",
                null,
                code));
    for (String code : plan.failedCourses())
      if (!courses.containsKey(code))
        issues.add(
            issue(
                "UNKNOWN_ASSUMPTION", "Failure assumption is not in this curriculum.", null, code));
    var failed = new HashSet<>(plan.failedCourses());
    var earned =
        records.stream()
            .filter(
                r ->
                    !failed.contains(r.courseCode())
                        && (r.status().equals("PASSED")
                            || r.status().equals("TRANSFER") && r.approved()))
            .map(AcademicRecord::courseCode)
            .filter(courses::containsKey)
            .collect(Collectors.toSet());
    records.stream()
        .filter(r -> r.status().equals("TRANSFER") && !r.approved())
        .forEach(
            r ->
                issues.add(
                    new Issue(
                        "WARNING",
                        "TRANSFER_PENDING",
                        "Transfer credit needs advisor approval.",
                        r.term(),
                        r.courseCode())));
    var scheduled = new HashMap<String, Term>();
    var ordered = new TreeMap<Term, List<String>>();
    for (var entry : plan.semesters().entrySet())
      ordered.put(Term.parse(entry.getKey()), entry.getValue());
    for (var entry : ordered.entrySet()) {
      Term term = entry.getKey();
      int load = 0;
      if (currentTerm != null && term.compareTo(currentTerm) < 0 && !entry.getValue().isEmpty())
        issues.add(
            issue(
                "PAST_SEMESTER",
                "Planned courses must be in the current or a future semester. Enter historical"
                    + " attempts in Academic records.",
                term,
                null));
      for (String code : entry.getValue()) {
        Course c = courses.get(code);
        if (c == null) {
          issues.add(issue("UNKNOWN_COURSE", "Course is not in this curriculum.", term, code));
          continue;
        }
        if (scheduled.putIfAbsent(code, term) != null)
          issues.add(issue("DUPLICATE", "Course is scheduled more than once.", term, code));
        if (earned.contains(code))
          issues.add(issue("ALREADY_PASSED", "This course already has earned credit.", term, code));
        load += c.ects();
        if (offering(offerings, code, term).filter(Offering::available).isEmpty())
          issues.add(
              issue("NOT_OFFERED", c.name() + " is not offered in this semester.", term, code));
        if (!c.required() && !plan.electives().contains(code))
          issues.add(
              issue(
                  "ELECTIVE_NOT_SELECTED",
                  "Select this course as an elective before including it in the path.",
                  term,
                  code));
      }
      int limit =
          term.season().equals("SUMMER")
              ? Math.min(15, curriculum.data().maxEcts())
              : curriculum.data().maxEcts();
      if (load > limit)
        issues.add(
            issue(
                "ECTS_OVERLOAD",
                load + " ECTS exceeds the " + limit + " ECTS semester limit.",
                term,
                null));
      if (load > 0 && load < curriculum.data().minEcts() && !term.season().equals("SUMMER"))
        issues.add(
            new Issue(
                "WARNING",
                "LOW_LOAD",
                load
                    + " ECTS is below the suggested "
                    + curriculum.data().minEcts()
                    + " ECTS load.",
                term.toString(),
                null));
      var codes = entry.getValue().stream().distinct().toList();
      for (int i = 0; i < codes.size(); i++)
        for (int j = i + 1; j < codes.size(); j++) {
          var a = offering(offerings, codes.get(i), term);
          var b = offering(offerings, codes.get(j), term);
          if (a.isPresent() && b.isPresent() && clashes(a.get().slots(), b.get().slots()))
            issues.add(
                issue(
                    "TIMETABLE_CONFLICT",
                    codes.get(i) + " and " + codes.get(j) + " have overlapping classes.",
                    term,
                    codes.get(j)));
        }
    }
    for (var entry : ordered.entrySet())
      for (String code : entry.getValue()) {
        Course c = courses.get(code);
        if (c == null) continue;
        for (String pre : c.prerequisites())
          if (!earned.contains(pre)
              && (scheduled.get(pre) == null || scheduled.get(pre).compareTo(entry.getKey()) >= 0))
            issues.add(
                issue(
                    "PREREQUISITE",
                    code + " requires " + pre + " to be passed in an earlier semester.",
                    entry.getKey(),
                    code));
      }
    var future = new HashSet<>(scheduled.keySet());
    future.removeAll(earned);
    future.retainAll(courses.keySet());
    var all = new HashSet<>(earned);
    all.addAll(future);
    var missing =
        courses.values().stream()
            .filter(Course::required)
            .map(Course::code)
            .filter(c -> !all.contains(c))
            .sorted()
            .toList();
    var requirements = new ArrayList<Requirement>();
    int requiredCredits =
        courses.values().stream().filter(Course::required).mapToInt(Course::ects).sum();
    requirements.add(
        new Requirement(
            "CORE",
            "Required courses",
            requiredCredits,
            sum(earned, courses, true, null),
            sum(future, courses, true, null)));
    for (var g : curriculum.data().electiveGroups())
      requirements.add(
          new Requirement(
              g.id(),
              g.name(),
              g.ectsRequired(),
              sum(earned, courses, false, g.id()),
              sum(future, courses, false, g.id())));
    int earnedEcts = credited(earned, curriculum),
        plannedEcts = credited(all, curriculum) - earnedEcts;
    boolean complete =
        missing.isEmpty()
            && requirements.stream().allMatch(r -> r.earned() + r.planned() >= r.required())
            && earnedEcts + plannedEcts >= curriculum.data().totalEcts();
    if (!missing.isEmpty())
      issues.add(
          new Issue(
              "WARNING",
              "UNSCHEDULED",
              missing.size() + " required course(s) still need a semester.",
              null,
              null));
    for (var r : requirements)
      if (!r.id().equals("CORE") && r.earned() + r.planned() < r.required())
        issues.add(
            new Issue(
                "WARNING",
                "ELECTIVE_CREDITS",
                r.name() + " needs " + (r.required() - r.earned() - r.planned()) + " more ECTS.",
                null,
                null));
    boolean valid = issues.stream().noneMatch(i -> i.severity().equals("ERROR"));
    Term finish = scheduled.values().stream().max(Term::compareTo).orElse(null);
    if (finish == null && complete)
      finish =
          records.stream()
              .filter(r -> earned.contains(r.courseCode()))
              .map(r -> Term.parse(r.term()))
              .max(Term::compareTo)
              .orElse(null);
    String graduation = valid && complete && finish != null ? finish.toString() : null;
    String targetStatus =
        plan.target() == null || plan.target().isBlank()
            ? "NO_TARGET"
            : graduation == null
                ? "UNCONFIRMED"
                : Term.parse(graduation).compareTo(Term.parse(plan.target())) <= 0
                    ? "ON_TRACK"
                    : "AFTER_TARGET";
    if (targetStatus.equals("AFTER_TARGET"))
      issues.add(
          new Issue(
              "WARNING",
              "TARGET_DELAY",
              "The complete path finishes after your graduation target.",
              graduation,
              null));
    return new Evaluation(
        valid,
        complete,
        graduation,
        targetStatus,
        earnedEcts,
        plannedEcts,
        curriculum.data().totalEcts(),
        issues,
        missing,
        requirements);
  }

  public PlanData generate(
      Curriculum curriculum,
      List<Offering> offerings,
      List<AcademicRecord> records,
      Term start,
      List<String> choices,
      String target,
      List<String> failed) {
    var courses =
        curriculum.data().courses().stream().collect(Collectors.toMap(Course::code, c -> c));
    var earned =
        records.stream()
            .filter(
                r ->
                    !failed.contains(r.courseCode())
                        && (r.status().equals("PASSED")
                            || r.status().equals("TRANSFER") && r.approved()))
            .map(AcademicRecord::courseCode)
            .collect(Collectors.toCollection(HashSet::new));
    var selected = new ArrayList<>(choices);
    for (var g : curriculum.data().electiveGroups()) {
      int credit =
          courses.values().stream()
              .filter(
                  c ->
                      g.id().equals(c.electiveGroup())
                          && (earned.contains(c.code()) || selected.contains(c.code())))
              .mapToInt(Course::ects)
              .sum();
      for (var c : curriculum.data().courses())
        if (credit < g.ectsRequired()
            && g.id().equals(c.electiveGroup())
            && !earned.contains(c.code())
            && !selected.contains(c.code())) {
          selected.add(c.code());
          credit += c.ects();
        }
    }
    var remaining =
        new ArrayList<>(
            curriculum.data().courses().stream()
                .filter(
                    c ->
                        (c.required() || selected.contains(c.code())) && !earned.contains(c.code()))
                .sorted(Comparator.comparingInt(Course::suggestedSemester))
                .toList());
    var semesters = new LinkedHashMap<String, List<String>>();
    var done = new HashSet<>(earned);
    // Current enrollment remains in its actual term; invalid choices are explained by evaluate().
    for (var r : records)
      if (r.status().equals("CURRENT")
          && !failed.contains(r.courseCode())
          && courses.containsKey(r.courseCode())) {
        semesters.computeIfAbsent(r.term(), k -> new ArrayList<>());
        if (!semesters.get(r.term()).contains(r.courseCode()))
          semesters.get(r.term()).add(r.courseCode());
        remaining.removeIf(c -> c.code().equals(r.courseCode()));
      }
    for (var e : semesters.entrySet())
      if (Term.parse(e.getKey()).compareTo(start) < 0) done.addAll(e.getValue());
    Term term = start;
    for (int n = 0; n < 30 && !remaining.isEmpty(); n++, term = term.next()) {
      var list = semesters.computeIfAbsent(term.toString(), k -> new ArrayList<>());
      int load = list.stream().map(courses::get).mapToInt(Course::ects).sum();
      for (var it = remaining.iterator(); it.hasNext(); ) {
        var c = it.next();
        var offer = offering(offerings, c.code(), term);
        int limit =
            term.season().equals("SUMMER")
                ? Math.min(15, curriculum.data().maxEcts())
                : curriculum.data().maxEcts();
        if (done.containsAll(c.prerequisites())
            && offer.isPresent()
            && offer.get().available()
            && load + c.ects() <= limit) {
          boolean conflict = false;
          for (String code : list) {
            var existing = offering(offerings, code, term);
            if (existing.isPresent() && clashes(offer.get().slots(), existing.get().slots()))
              conflict = true;
          }
          if (!conflict) {
            list.add(c.code());
            load += c.ects();
            it.remove();
          }
        }
      }
      done.addAll(list);
    }
    semesters.entrySet().removeIf(e -> e.getValue().isEmpty());
    return new PlanData(semesters, selected, target, failed);
  }

  public Optional<Offering> offering(List<Offering> offerings, String code, Term term) {
    return offerings.stream()
        .filter(
            o ->
                o.courseCode().equals(code)
                    && o.season().equals(term.season())
                    && (o.year() == null || o.year() == term.year()))
        .max(Comparator.comparing(o -> o.year() != null));
  }

  private boolean clashes(List<Slot> a, List<Slot> b) {
    return a.stream()
        .anyMatch(
            x ->
                b.stream()
                    .anyMatch(
                        y ->
                            x.day().equals(y.day()) && x.start() < y.end() && y.start() < x.end()));
  }

  private Issue issue(String code, String message, Term term, String course) {
    return new Issue("ERROR", code, message, term == null ? null : term.toString(), course);
  }

  private int sum(Set<String> codes, Map<String, Course> courses, boolean required, String group) {
    return codes.stream()
        .map(courses::get)
        .filter(Objects::nonNull)
        .filter(c -> required ? c.required() : Objects.equals(c.electiveGroup(), group))
        .mapToInt(Course::ects)
        .sum();
  }

  private int credited(Set<String> codes, Curriculum c) {
    var map = c.data().courses().stream().collect(Collectors.toMap(Course::code, x -> x));
    int total = sum(codes, map, true, null);
    for (var g : c.data().electiveGroups())
      total += Math.min(g.ectsRequired(), sum(codes, map, false, g.id()));
    return total;
  }
}
