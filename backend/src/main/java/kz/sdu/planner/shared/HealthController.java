package kz.sdu.planner.shared;

import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

@RestController
public class HealthController {
  private final JdbcTemplate db;

  public HealthController(JdbcTemplate db) {
    this.db = db;
  }

  @GetMapping("/api/health")
  Object health() {
    db.queryForObject("select 1", Integer.class);
    return Map.of("status", "UP", "database", "PostgreSQL");
  }
}
