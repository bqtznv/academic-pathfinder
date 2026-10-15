package kz.sdu.planner.api;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.*;
import java.util.*;
import kz.sdu.planner.accounts.AccountRepository;
import kz.sdu.planner.curriculum.CurriculumRepository;
import kz.sdu.planner.planning.PlanRepository;
import kz.sdu.planner.shared.Models.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@TestPropertySource(
    properties = {
      "spring.datasource.url=${TEST_DATABASE_URL:jdbc:postgresql://127.0.0.1:5432/pathfinder_test}",
      "app.demo-enabled=true"
    })
class PlannerApiIT {
  @Autowired MockMvc mvc;
  @Autowired ObjectMapper json;
  @Autowired AccountRepository users;
  @Autowired PlanRepository plans;
  @Autowired CurriculumRepository curricula;

  UUID student() {
    return users.byEmail("student@planner.local").orElseThrow().id();
  }

  Plan plan() {
    return plans.list(student()).getFirst();
  }

  @Test
  void anonymousAccessAndMissingCsrfAreRejected() throws Exception {
    mvc.perform(get("/api/plans")).andExpect(status().isUnauthorized());
    mvc.perform(
            post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"student@planner.local\",\"password\":\"Planner2026!\"}"))
        .andExpect(status().isForbidden());
  }

  @Test
  void actualLoginCreatesAuthenticatedSession() throws Exception {
    var result =
        mvc.perform(
                post("/api/auth/login")
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"email\":\"student@planner.local\",\"password\":\"Planner2026!\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.role").value("STUDENT"))
            .andReturn();
    mvc.perform(
            get("/api/auth/me")
                .session(
                    (org.springframework.mock.web.MockHttpSession)
                        result.getRequest().getSession()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.email").value("student@planner.local"));
  }

  @Test
  void studentCannotReadOrModifyAnotherStudentsPlan() throws Exception {
    var u =
        users.create(
            "other@example.com",
            "unused",
            "Other student",
            "STUDENT",
            "Computer Science (EN)",
            2024,
            null);
    var foreign = plans.create(u.id(), "Private path", plan().curriculumId(), plan().data());
    mvc.perform(get("/api/plans/" + foreign.id()).with(user("student@planner.local")))
        .andExpect(status().isForbidden());
    mvc.perform(
            delete("/api/plans/" + foreign.id()).with(user("student@planner.local")).with(csrf()))
        .andExpect(status().isForbidden());
  }

  @Test
  void previewDoesNotPersistAndStaleRevisionIsRejected() throws Exception {
    var p = plan();
    var body = Map.of("data", new PlanData(Map.of(), List.of(), "2027-SPRING", List.of()));
    mvc.perform(
            post("/api/plans/" + p.id() + "/preview")
                .with(user("student@planner.local"))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.complete").value(false))
        .andExpect(jsonPath("$.graduation").isEmpty());
    assertEquals(p.data(), plans.get(p.id()).data());
    String edit =
        json.writeValueAsString(
            Map.of("name", "Renamed", "revision", p.revision(), "data", p.data()));
    mvc.perform(
            put("/api/plans/" + p.id())
                .with(user("student@planner.local"))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(edit))
        .andExpect(status().isOk());
    mvc.perform(
            put("/api/plans/" + p.id())
                .with(user("student@planner.local"))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(edit))
        .andExpect(status().isConflict());
  }

  @Test
  void recordPreviewDoesNotSaveAndStudentCannotApproveOwnTransfer() throws Exception {
    String csv = "courseCode,status,grade,term\nCSS 401,TRANSFER,P,2026-SPRING";
    mvc.perform(
            post("/api/records/import-preview")
                .with(user("student@planner.local"))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("format", "CSV", "content", csv))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.rows[0].courseCode").value("CSS 401"));
    var r = new AcademicRecord(null, "CSS 401", "TRANSFER", "P", "2026-SPRING", true);
    mvc.perform(
            post("/api/records")
                .with(user("student@planner.local"))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(r)))
        .andExpect(status().isOk());
    var result = mvc.perform(get("/api/records").with(user("student@planner.local"))).andReturn();
    var rows = json.readTree(result.getResponse().getContentAsString());
    String id = "";
    for (var row : rows)
      if (row.get("courseCode").asText().equals("CSS 401")) {
        assertFalse(row.get("approved").asBoolean());
        id = row.get("id").asText();
      }
    assertFalse(id.isBlank());
    mvc.perform(
            post("/api/advisor/students/" + student() + "/records/" + id + "/approve")
                .with(user("student@planner.local"))
                .with(csrf()))
        .andExpect(status().isForbidden());
  }

  @Test
  void advisorCanReviewOnlyAssignedSubmittedValidPlan() throws Exception {
    var p = plan();
    var request =
        Map.of(
            "decision",
            "APPROVED",
            "comment",
            "Prerequisites and semester loads reviewed.",
            "revision",
            p.revision());
    mvc.perform(
            post("/api/plans/" + p.id() + "/reviews")
                .with(user("advisor@planner.local"))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(request)))
        .andExpect(status().isBadRequest());
    plans.submit(p.id());
    mvc.perform(
            post("/api/plans/" + p.id() + "/reviews")
                .with(user("advisor@planner.local"))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(request)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.reviews[0].current").value(true));
    var o = curricula.offerings().getFirst();
    curricula.offering(new Offering(null, o.courseCode(), o.season(), o.year(), false, o.slots()));
    mvc.perform(get("/api/plans/" + p.id()).with(user("student@planner.local")))
        .andExpect(jsonPath("$.reviews[0].current").value(false));
  }

  @Test
  void studentCannotPublishCurriculumAndDraftDoesNotReplacePublishedVersion() throws Exception {
    var old = curricula.latest("Computer Science (EN)", 2024);
    var draft = curricula.draft(old.program(), old.year(), old.data());
    assertEquals(old.id(), curricula.latest(old.program(), old.year()).id());
    mvc.perform(
            post("/api/admin/curricula/" + draft.id() + "/publish")
                .with(user("student@planner.local"))
                .with(csrf()))
        .andExpect(status().isForbidden());
    mvc.perform(
            post("/api/admin/curricula/" + draft.id() + "/publish")
                .with(user("admin@planner.local"))
                .with(csrf()))
        .andExpect(status().isOk());
    assertEquals(old.id(), plans.get(plan().id()).curriculumId());
  }
}
