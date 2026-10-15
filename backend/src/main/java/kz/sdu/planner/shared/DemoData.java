package kz.sdu.planner.shared;

import java.util.*;
import kz.sdu.planner.accounts.*;
import kz.sdu.planner.curriculum.*;
import kz.sdu.planner.planning.*;
import kz.sdu.planner.records.*;
import kz.sdu.planner.shared.Models.*;
import org.springframework.boot.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Fictional teaching dataset inspired by the supplied screenshot, not an official SDU curriculum.
 */
@Component
@ConditionalOnProperty(name = "app.demo-enabled", havingValue = "true")
public class DemoData implements ApplicationRunner {
  private final AccountRepository users;
  private final CurriculumRepository curricula;
  private final RecordRepository records;
  private final PlanRepository plans;
  private final Planning planning;
  private final PasswordEncoder passwords;

  public DemoData(
      AccountRepository u,
      CurriculumRepository c,
      RecordRepository r,
      PlanRepository p,
      Planning s,
      PasswordEncoder e) {
    users = u;
    curricula = c;
    records = r;
    plans = p;
    planning = s;
    passwords = e;
  }

  private Course course(
      String code, String name, int semester, boolean required, String group, String... pre) {
    return new Course(code, name, 5, semester, required, group, List.of(pre));
  }

  @Override
  @Transactional
  public void run(ApplicationArguments args) {
    if (users.byEmail("student@planner.local").isPresent()) return;
    var courses = new ArrayList<Course>();
    courses.add(course("CSS 109", "Calculus 1", 1, true, null));
    courses.add(course("CSS 112", "Physics 1", 1, true, null));
    courses.add(course("CSS 101", "Introduction to Programming", 1, true, null));
    courses.add(course("CSS 153", "Computer Ethics", 1, true, null));
    courses.add(course("MDE 190", "Academic English 1", 1, true, null));
    courses.add(course("MDE 283", "Turkish Language 1", 1, true, null));
    courses.add(course("CSS 110", "Calculus 2", 2, true, null, "CSS 109"));
    courses.add(course("CSS 251", "Physics 2", 2, true, null, "CSS 112"));
    courses.add(course("INF 106", "Information and Communication Technologies", 2, true, null));
    courses.add(course("CSS 102", "Programming 2", 2, true, null, "CSS 101"));
    courses.add(course("MDE 191", "Academic English 2", 2, true, null, "MDE 190"));
    courses.add(course("MDE 284", "Turkish Language 2", 2, true, null, "MDE 283"));
    courses.add(course("CSS 201", "Data Structures", 3, true, null, "CSS 102"));
    courses.add(course("CSS 203", "Discrete Mathematics", 3, true, null, "CSS 109"));
    courses.add(course("CSS 205", "Computer Architecture", 3, true, null, "CSS 102"));
    courses.add(course("CSS 207", "Linear Algebra", 3, true, null, "CSS 110"));
    courses.add(course("MDE 201", "History of Kazakhstan", 3, true, null));
    courses.add(course("CSS 209", "Probability and Statistics", 3, true, null, "CSS 110"));
    courses.add(course("CSS 202", "Algorithms", 4, true, null, "CSS 201", "CSS 203"));
    courses.add(course("CSS 204", "Database Systems", 4, true, null, "CSS 102"));
    courses.add(course("CSS 206", "Operating Systems", 4, true, null, "CSS 205"));
    courses.add(course("CSS 208", "Computer Networks", 4, true, null, "CSS 205"));
    courses.add(course("CSS 210", "Object-Oriented Design", 4, true, null, "CSS 201"));
    courses.add(course("MDE 202", "Philosophy", 4, true, null));
    courses.add(course("CSS 301", "Software Engineering", 5, true, null, "CSS 210"));
    courses.add(course("CSS 303", "Web Development", 5, true, null, "CSS 204"));
    courses.add(course("CSS 305", "Artificial Intelligence", 5, true, null, "CSS 202", "CSS 209"));
    courses.add(course("CSS 307", "Information Security", 5, true, null, "CSS 208"));
    courses.add(course("CSS 309", "Theory of Computation", 5, true, null, "CSS 203"));
    courses.add(course("CSS 311", "Research Methods", 5, true, null, "MDE 191"));
    courses.add(course("CSS 302", "Software Architecture", 6, true, null, "CSS 301"));
    courses.add(course("CSS 304", "Distributed Systems", 6, true, null, "CSS 206", "CSS 208"));
    courses.add(course("CSS 306", "Machine Learning", 6, true, null, "CSS 305"));
    courses.add(course("CSS 308", "Software Quality Assurance", 6, true, null, "CSS 301"));
    courses.add(course("CSS 310", "Mobile Application Development", 6, true, null, "CSS 210"));
    courses.add(course("CSS 312", "Professional Practice", 6, true, null, "CSS 301"));
    courses.add(course("CSS 401", "Capstone Project 1", 7, true, null, "CSS 302", "CSS 311"));
    courses.add(course("CSS 403", "Industry Internship", 7, true, null, "CSS 312"));
    courses.add(course("CSS 402", "Capstone Project 2", 8, true, null, "CSS 401"));
    courses.add(course("CSS 404", "Graduation Research", 8, true, null, "CSS 401"));
    courses.add(course("CSS 411", "Cloud Computing", 7, false, "AREA", "CSS 304"));
    courses.add(course("CSS 413", "Data Visualization", 7, false, "AREA", "CSS 209"));
    courses.add(course("MDE 301", "Entrepreneurship", 7, false, "GENERAL"));
    courses.add(course("MDE 303", "Academic Writing", 7, false, "GENERAL", "MDE 191"));
    courses.add(course("CSS 412", "Advanced Databases", 8, false, "AREA", "CSS 204"));
    courses.add(course("CSS 414", "Human-Computer Interaction", 8, false, "AREA", "CSS 303"));
    courses.add(course("MDE 302", "Project Management", 8, false, "GENERAL"));
    courses.add(course("MDE 304", "Leadership and Communication", 8, false, "GENERAL"));
    courses.add(course("CSS 415", "Computer Vision", 7, false, "AREA", "CSS 306"));
    courses.add(course("CSS 416", "Natural Language Processing", 8, false, "AREA", "CSS 306"));
    courses.add(course("MDE 305", "Sustainable Development", 7, false, "GENERAL"));
    courses.add(course("MDE 306", "Business Communication", 8, false, "GENERAL"));
    Curriculum curriculum;
    if (curricula.list(false).isEmpty()) {
      curriculum =
          curricula.draft(
              "Computer Science (EN)",
              2024,
              new CurriculumData(
                  courses,
                  List.of(
                      new ElectiveGroup("AREA", "Area electives", 20),
                      new ElectiveGroup("GENERAL", "General electives", 20)),
                  240,
                  30,
                  15));
      new CurriculumService(curricula).validate(curriculum.data());
      curricula.publish(curriculum.id());
      curriculum = curricula.get(curriculum.id());
      var counters = new HashMap<Integer, Integer>();
      for (var c : courses) {
        int index = counters.merge(c.suggestedSemester(), 1, Integer::sum) - 1;
        String day = List.of("MON", "TUE", "WED", "THU", "FRI", "MON").get(index % 6);
        int start = index % 6 == 5 ? 660 : 540;
        curricula.offering(
            new Offering(
                null,
                c.code(),
                c.suggestedSemester() % 2 == 1 ? "FALL" : "SPRING",
                null,
                true,
                List.of(new Slot(day, start, start + 90))));
      }
    } else curriculum = curricula.latest("Computer Science (EN)", 2024);
    String hash = passwords.encode("Planner2026!");
    var advisor =
        users
            .byEmail("advisor@planner.local")
            .orElseGet(
                () ->
                    users.create(
                        "advisor@planner.local",
                        hash,
                        "Dana Karimova",
                        "ADVISOR",
                        "Computer Science (EN)",
                        2024,
                        null));
    if (users.byEmail("admin@planner.local").isEmpty())
      users.create(
          "admin@planner.local",
          hash,
          "Curriculum Administrator",
          "ADMIN",
          "Computer Science (EN)",
          2024,
          null);
    var student =
        users.create(
            "student@planner.local",
            hash,
            "Atabek Bakhtyzhanov",
            "STUDENT",
            "Computer Science (EN)",
            2024,
            advisor.id());
    for (var c : curriculum.data().courses())
      if (c.required() && c.suggestedSemester() <= 5) {
        int sem = c.suggestedSemester();
        String term = (2024 + sem / 2) + (sem % 2 == 1 ? "-FALL" : "-SPRING");
        records.save(
            student.id(),
            new AcademicRecord(
                null, c.code(), sem < 5 ? "PASSED" : "CURRENT", sem < 5 ? "B+" : "", term, false));
      }
    var draft =
        planning.generate(
            student.id(),
            curriculum.id(),
            new PlanData(Map.of(), List.of(), "2028-SPRING", List.of()));
    plans.create(student.id(), "My graduation path", curriculum.id(), draft);
  }
}
