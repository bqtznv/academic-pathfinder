package kz.sdu.planner.planning;

import java.util.*;
import kz.sdu.planner.accounts.Accounts;
import kz.sdu.planner.shared.Models.*;
import org.springframework.transaction.annotation.Transactional;
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
    var data = input.data() == null ? service.generate(student, c.id(), null) : input.data();
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

  @PostMapping("/{id}/generate")
  Object generate(@PathVariable UUID id, @RequestBody Preview input) {
    var p = repository.get(id);
    accounts.own(p.studentId());
    var c =
        service.compatible(
            p.studentId(), input.curriculumId() == null ? p.curriculumId() : input.curriculumId());
    if (input.data() != null) service.validate(input.data());
    var data = service.generate(p.studentId(), c.id(), input.data());
    return Map.of("data", data, "evaluation", service.evaluate(p.studentId(), c.id(), data));
  }

  @DeleteMapping("/{id}")
  void delete(@PathVariable UUID id) {
    var p = repository.get(id);
    accounts.own(p.studentId());
    repository.delete(id);
  }

  @PostMapping("/{id}/submit")
  Object submit(@PathVariable UUID id) {
    var p = repository.get(id);
    accounts.own(p.studentId());
    repository.submit(id);
    return service.detail(repository.get(id));
  }

  public record Decision(String decision, String comment, int revision) {}

  @PostMapping("/{id}/reviews")
  @Transactional
  Object review(@PathVariable UUID id, @RequestBody Decision d) {
    accounts.role("ADVISOR", "ADMIN");
    var p = repository.get(id);
    accounts.viewStudent(p.studentId());
    if (!p.submitted())
      throw new IllegalArgumentException("The student must submit this plan for review first.");
    if (p.revision() != d.revision())
      throw new IllegalArgumentException("Plan changed. Reload before reviewing.");
    if (d.decision() == null
        || !Set.of("APPROVED", "CHANGES_REQUESTED").contains(d.decision())
        || d.comment() == null
        || d.comment().isBlank()
        || d.comment().length() > 3000)
      throw new IllegalArgumentException(
          "Choose a decision and write a comment (maximum 3000 characters).");
    var e = service.evaluate(p.studentId(), p.curriculumId(), p.data());
    if (d.decision().equals("APPROVED") && (!e.valid() || !e.complete()))
      throw new IllegalArgumentException(
          "Only valid, complete paths can be approved. Request changes instead.");
    repository.review(p, accounts.current().id(), d.decision(), d.comment(), service.hash(p));
    return service.detail(p);
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
