package kz.sdu.planner.records;

import java.util.*;
import kz.sdu.planner.accounts.*;
import kz.sdu.planner.shared.*;
import kz.sdu.planner.shared.Models.*;
import org.springframework.web.bind.annotation.*;

@RestController
public class RecordsController {
  private final StudentRecords service;
  private final RecordRepository repository;
  private final Accounts accounts;
  private final AccountRepository users;
  private final Json json;

  public RecordsController(
      StudentRecords s, RecordRepository r, Accounts a, AccountRepository u, Json j) {
    service = s;
    repository = r;
    accounts = a;
    users = u;
    json = j;
  }

  @GetMapping("/api/records")
  List<AcademicRecord> mine() {
    return service.list(accounts.current().id());
  }

  @PostMapping("/api/records")
  Object save(@RequestBody AcademicRecord r) {
    service.save(accounts.current().id(), List.of(r));
    return Map.of("saved", true);
  }

  @DeleteMapping("/api/records/{id}")
  void delete(@PathVariable UUID id) {
    repository.delete(accounts.current().id(), id);
  }

  public record Import(String format, String content) {}

  @PostMapping("/api/records/import-preview")
  Object preview(@RequestBody Import input) {
    if (input.content() == null || input.content().length() > 1_000_000)
      throw new IllegalArgumentException("Import must be under 1 MB.");
    List<AcademicRecord> rows;
    if ("JSON".equals(input.format()))
      rows = Arrays.asList(json.read(input.content(), AcademicRecord[].class));
    else if ("CSV".equals(input.format()))
      rows =
          Csv.parse(input.content()).stream()
              .map(
                  r ->
                      new AcademicRecord(
                          null,
                          Csv.required(r, "courseCode"),
                          Csv.required(r, "status"),
                          r.getOrDefault("grade", ""),
                          Csv.required(r, "term"),
                          false))
              .toList();
    else throw new IllegalArgumentException("Choose JSON or CSV.");
    if (rows.isEmpty() || rows.size() > 1000)
      throw new IllegalArgumentException("Import must have 1–1000 rows.");
    var warnings = new ArrayList<String>();
    var keys = new HashSet<String>();
    var existing = service.list(accounts.current().id());
    for (var r : rows) {
      service.validate(accounts.current().id(), r);
      if (!keys.add(r.courseCode() + r.term()))
        throw new IllegalArgumentException("Duplicate course and term: " + r.courseCode());
      if (existing.stream()
          .anyMatch(e -> e.courseCode().equals(r.courseCode()) && e.term().equals(r.term())))
        warnings.add(r.courseCode() + " (" + r.term() + ") will replace the existing attempt.");
      if (r.status().equals("TRANSFER"))
        warnings.add(r.courseCode() + ": transfer credit will need advisor approval.");
    }
    return Map.of("rows", rows, "warnings", warnings);
  }

  public record Confirm(List<AcademicRecord> rows) {}

  @PostMapping("/api/records/import")
  Object confirm(@RequestBody Confirm c) {
    service.save(accounts.current().id(), c.rows());
    return Map.of("saved", c.rows().size());
  }

  @GetMapping("/api/advisor/students")
  List<User> students() {
    accounts.role("ADVISOR", "ADMIN");
    var me = accounts.current();
    return users.students(me.id(), me.role().equals("ADMIN"));
  }

  @GetMapping("/api/advisor/students/{id}/records")
  List<AcademicRecord> studentRecords(@PathVariable UUID id) {
    accounts.role("ADVISOR", "ADMIN");
    accounts.viewStudent(id);
    return service.list(id);
  }

  @PostMapping("/api/advisor/students/{id}/records/{recordId}/approve")
  void approve(@PathVariable UUID id, @PathVariable UUID recordId) {
    accounts.role("ADVISOR", "ADMIN");
    accounts.viewStudent(id);
    repository.approve(id, recordId);
  }
}
