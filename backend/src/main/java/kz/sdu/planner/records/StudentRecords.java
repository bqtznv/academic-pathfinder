package kz.sdu.planner.records;

import java.util.*;
import kz.sdu.planner.accounts.AccountRepository;
import kz.sdu.planner.curriculum.CurriculumService;
import kz.sdu.planner.shared.*;
import kz.sdu.planner.shared.Models.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class StudentRecords {
  private final RecordRepository repository;
  private final CurriculumService curricula;
  private final AccountRepository accounts;

  public StudentRecords(RecordRepository r, CurriculumService c, AccountRepository a) {
    repository = r;
    curricula = c;
    accounts = a;
  }

  public List<AcademicRecord> list(UUID student) {
    return repository.list(student);
  }

  public void validate(UUID student, AcademicRecord r) {
    var user = accounts.get(student);
    var c = curricula.latest(user.program(), user.curriculumYear());
    if (r.courseCode() == null
        || c.data().courses().stream().noneMatch(x -> x.code().equals(r.courseCode())))
      throw new IllegalArgumentException("Unknown course code: " + r.courseCode());
    if (r.status() == null
        || !Set.of("PASSED", "CURRENT", "FAILED", "TRANSFER").contains(r.status()))
      throw new IllegalArgumentException("Use status PASSED, CURRENT, FAILED or TRANSFER.");
    Term.parse(r.term());
    if (r.grade() != null
        && !r.grade().isBlank()
        && !Set.of("A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "F", "P", "NP")
            .contains(r.grade()))
      throw new IllegalArgumentException("Unrecognized grade for " + r.courseCode() + ".");
    if ("PASSED".equals(r.status())
        && Set.of("F", "NP").contains(r.grade() == null ? "" : r.grade()))
      throw new IllegalArgumentException("A failed grade cannot be marked passed.");
  }

  @Transactional
  public void save(UUID student, List<AcademicRecord> records) {
    if (records == null || records.isEmpty() || records.size() > 1000)
      throw new IllegalArgumentException("Provide 1–1000 academic records.");
    var keys = new HashSet<String>();
    for (var r : records) {
      validate(student, r);
      if (!keys.add(r.courseCode() + r.term()))
        throw new IllegalArgumentException(
            "Duplicate course and term in import: " + r.courseCode());
    }
    records.forEach(r -> repository.save(student, r));
  }
}
