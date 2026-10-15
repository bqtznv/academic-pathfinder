package kz.sdu.planner.accounts;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.*;
import kz.sdu.planner.shared.Models.User;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class AccountRepository {
  private final JdbcTemplate db;

  public AccountRepository(JdbcTemplate db) {
    this.db = db;
  }

  private User map(ResultSet r, int n) throws SQLException {
    return new User(
        r.getObject("id", UUID.class),
        r.getString("email"),
        r.getString("name"),
        r.getString("role"),
        r.getString("program"),
        r.getInt("curriculum_year"));
  }

  public Optional<User> byEmail(String email) {
    return db
        .query("select * from users where email=?", this::map, email.toLowerCase(Locale.ROOT))
        .stream()
        .findFirst();
  }

  public User get(UUID id) {
    return db.query("select * from users where id=?", this::map, id).stream()
        .findFirst()
        .orElseThrow(() -> new IllegalArgumentException("Account not found."));
  }

  public String password(String email) {
    return db.queryForObject("select password_hash from users where email=?", String.class, email);
  }

  public List<User> students() {
    return db.query("select * from users where role='STUDENT' order by name", this::map);
  }

  public User create(
      String email, String password, String name, String role, String program, int year) {
    UUID id = UUID.randomUUID();
    db.update(
        "insert into users(id,email,password_hash,name,role,program,curriculum_year)"
            + " values(?,?,?,?,?,?,?)",
        id,
        email,
        password,
        name,
        role,
        program,
        year);
    return get(id);
  }
}
