package kz.sdu.planner.accounts;

import static org.springframework.http.HttpStatus.*;

import java.util.UUID;
import kz.sdu.planner.shared.Models.User;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class Accounts {
  private final AccountRepository repository;

  public Accounts(AccountRepository repository) {
    this.repository = repository;
  }

  public User current() {
    var a = SecurityContextHolder.getContext().getAuthentication();
    if (a == null || !a.isAuthenticated() || a.getName().equals("anonymousUser"))
      throw new ResponseStatusException(UNAUTHORIZED, "Sign in to continue.");
    return repository
        .byEmail(a.getName())
        .orElseThrow(() -> new ResponseStatusException(UNAUTHORIZED, "Account not found."));
  }

  public void role(String... roles) {
    String actual = current().role();
    for (String r : roles) if (r.equals(actual)) return;
    throw new ResponseStatusException(FORBIDDEN, "You do not have access to this operation.");
  }

  public void viewStudent(UUID id) {
    var me = current();
    if (me.id().equals(id)
        || me.role().equals("ADMIN")
        || me.role().equals("ADVISOR") && me.id().equals(repository.get(id).advisorId())) return;
    throw new ResponseStatusException(FORBIDDEN, "This student is not assigned to your account.");
  }

  public void own(UUID student) {
    if (!current().id().equals(student))
      throw new ResponseStatusException(FORBIDDEN, "Only the plan owner can change it.");
  }
}
