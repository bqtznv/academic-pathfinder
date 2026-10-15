package kz.sdu.planner.curriculum;

import java.util.*;
import kz.sdu.planner.accounts.Accounts;
import kz.sdu.planner.shared.*;
import kz.sdu.planner.shared.Models.*;
import org.springframework.web.bind.annotation.*;

@RestController
public class CurriculumController {
  private final CurriculumRepository repository;
  private final CurriculumService service;
  private final Accounts accounts;
  private final Json json;

  public CurriculumController(CurriculumRepository r, CurriculumService s, Accounts a, Json j) {
    repository = r;
    service = s;
    accounts = a;
    json = j;
  }

  @GetMapping("/api/programs")
  Object programs() {
    return repository.list(false).stream()
        .map(c -> Map.of("program", c.program(), "year", c.year()))
        .distinct()
        .toList();
  }

  @GetMapping("/api/curriculum")
  Curriculum mine() {
    var me = accounts.current();
    return repository.latest(me.program(), me.curriculumYear());
  }

  @GetMapping("/api/offerings")
  List<Offering> offerings() {
    return repository.offerings();
  }

  @GetMapping("/api/admin/curricula")
  List<Curriculum> all() {
    accounts.role("ADMIN");
    return repository.list(true);
  }

  public record Draft(String program, int year, CurriculumData data) {}

  @PostMapping("/api/admin/curricula")
  Curriculum draft(@RequestBody Draft d) {
    accounts.role("ADMIN");
    if (d.program() == null
        || d.program().isBlank()
        || d.program().length() > 100
        || d.year() < 2000
        || d.year() > 2099)
      throw new IllegalArgumentException("Program and curriculum year are required.");
    service.validate(d.data());
    return repository.draft(d.program().trim(), d.year(), d.data());
  }

  public record Import(String format, String content, UUID baseCurriculumId) {}

  @PostMapping("/api/admin/curricula/import-preview")
  CurriculumData preview(@RequestBody Import i) {
    accounts.role("ADMIN");
    if (i.content() == null || i.content().length() > 1_000_000)
      throw new IllegalArgumentException("Import must be under 1 MB.");
    CurriculumData data;
    if ("JSON".equals(i.format())) data = json.read(i.content(), CurriculumData.class);
    else if ("CSV".equals(i.format())) {
      var base = repository.get(i.baseCurriculumId()).data();
      var courses =
          Csv.parse(i.content()).stream()
              .map(
                  r ->
                      new Course(
                          Csv.required(r, "code"),
                          Csv.required(r, "name"),
                          Integer.parseInt(Csv.required(r, "ects")),
                          Integer.parseInt(Csv.required(r, "suggestedSemester")),
                          Boolean.parseBoolean(Csv.required(r, "required")),
                          r.getOrDefault("electiveGroup", "").isBlank()
                              ? null
                              : r.get("electiveGroup"),
                          r.getOrDefault("prerequisites", "").isBlank()
                              ? List.<String>of()
                              : Arrays.asList(r.get("prerequisites").split("\\|"))))
              .toList();
      data =
          new CurriculumData(
              courses, base.electiveGroups(), base.totalEcts(), base.maxEcts(), base.minEcts());
    } else throw new IllegalArgumentException("Choose JSON or CSV.");
    service.validate(data);
    return data;
  }

  @GetMapping("/api/admin/curricula/{id}/impact")
  Object impact(@PathVariable UUID id) {
    accounts.role("ADMIN");
    var c = repository.get(id);
    return Map.of(
        "affectedStudents",
        repository.affected(c),
        "program",
        c.program(),
        "year",
        c.year(),
        "message",
        "Publishing keeps all previous versions and saved plan choices. Students can explicitly"
            + " upgrade their plans.");
  }

  @PostMapping("/api/admin/curricula/{id}/publish")
  Curriculum publish(@PathVariable UUID id) {
    accounts.role("ADMIN");
    var c = repository.get(id);
    if (!c.status().equals("DRAFT"))
      throw new IllegalArgumentException("Only a draft can be published.");
    service.validate(c.data());
    repository.publish(id);
    return repository.get(id);
  }

  @PutMapping("/api/admin/offerings")
  Object offering(@RequestBody Offering o) {
    accounts.role("ADMIN");
    service.validateOffering(o);
    repository.offering(o);
    return Map.of("saved", true);
  }
}
