package kz.sdu.planner.planning;

import java.util.*;
import kz.sdu.planner.accounts.Accounts;
import kz.sdu.planner.shared.Models.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/plans")
public class PlanController {
  private final PlanRepository repository;
  private final Planning service;
  private final Accounts accounts;

  public PlanController(PlanRepository p, Planning s, Accounts a) {
    repository = p;
    service = s;
    accounts = a;
  }

  @GetMapping
  Object list(@RequestParam(required = false) UUID studentId) {
    UUID id = studentId == null ? accounts.current().id() : studentId;
    accounts.viewStudent(id);
    return repository.list(id);
  }

  public record Create(String name, UUID curriculumId, PlanData data) {}

  private String name(String n) {
    if (n == null || n.isBlank() || n.length() > 100)
      throw new IllegalArgumentException("Plan name must contain 1–100 characters.");
    return n.trim();
  }

  @PostMapping
  Object create(@RequestBody Create input) {
    UUID student = accounts.current().id();
    accounts.role("STUDENT");
    var c = service.compatible(student, input.curriculumId());
    var data =
        input.data() == null ? new PlanData(Map.of(), List.of(), null, List.of()) : input.data();
    service.validate(data);
    return service.detail(repository.create(student, name(input.name()), c.id(), data));
  }

  @GetMapping("/{id}")
  Object get(@PathVariable UUID id) {
    var p = repository.get(id);
    accounts.viewStudent(p.studentId());
    return service.detail(p);
  }

  public record Edit(String name, int revision, UUID curriculumId, PlanData data) {}

  @PutMapping("/{id}")
  Object save(@PathVariable UUID id, @RequestBody Edit input) {
    var p = repository.get(id);
    accounts.own(p.studentId());
    var c =
        service.compatible(
            p.studentId(), input.curriculumId() == null ? p.curriculumId() : input.curriculumId());
    service.validate(input.data());
    return service.detail(
        repository.save(id, input.revision(), name(input.name()), c.id(), input.data()));
  }

  public record Preview(UUID curriculumId, PlanData data) {}

  @PostMapping("/{id}/preview")
  Object preview(@PathVariable UUID id, @RequestBody Preview input) {
    var p = repository.get(id);
    accounts.viewStudent(p.studentId());
    var c =
        service.compatible(
            p.studentId(), input.curriculumId() == null ? p.curriculumId() : input.curriculumId());
    return service.evaluate(p.studentId(), c.id(), input.data());
  }

  @DeleteMapping("/{id}")
  void delete(@PathVariable UUID id) {
    var p = repository.get(id);
    accounts.own(p.studentId());
    repository.delete(id);
  }

  @GetMapping("/{id}/compare/{otherId}")
  Object compare(@PathVariable UUID id, @PathVariable UUID otherId) {
    var a = repository.get(id);
    var b = repository.get(otherId);
    accounts.viewStudent(a.studentId());
    accounts.viewStudent(b.studentId());
    if (!a.studentId().equals(b.studentId()))
      throw new IllegalArgumentException("Compare plans belonging to the same student.");
    return Map.of("left", service.detail(a), "right", service.detail(b));
  }
}
