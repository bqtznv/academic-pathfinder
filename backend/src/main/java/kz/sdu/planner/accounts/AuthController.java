package kz.sdu.planner.accounts;

import static org.springframework.http.HttpStatus.*;

import jakarta.servlet.http.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import kz.sdu.planner.curriculum.CurriculumService;
import kz.sdu.planner.shared.Models.User;
import org.springframework.security.authentication.*;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
  private final AuthenticationManager manager;
  private final AccountRepository repository;
  private final Accounts accounts;
  private final PasswordEncoder passwords;
  private final CurriculumService curricula;
  private final Map<String, List<Instant>> failures = new ConcurrentHashMap<>();

  public AuthController(
      AuthenticationManager m,
      AccountRepository r,
      Accounts a,
      PasswordEncoder p,
      CurriculumService c) {
    manager = m;
    repository = r;
    accounts = a;
    passwords = p;
    curricula = c;
  }

  public record Login(@NotBlank @Email String email, @NotBlank String password) {}

  public record Register(
      @NotBlank @Email @Size(max = 254) String email,
      @NotBlank @Size(min = 10, max = 72) String password,
      @NotBlank @Size(max = 120) String name,
      @NotBlank String program,
      int curriculumYear) {}

  @GetMapping("/csrf")
  Object csrf(CsrfToken token) {
    return Map.of("token", token.getToken());
  }

  @GetMapping("/me")
  User me() {
    return accounts.current();
  }

  @PostMapping("/login")
  User login(
      @Valid @RequestBody Login login, HttpServletRequest request, HttpServletResponse response) {
    String email = login.email().trim().toLowerCase(Locale.ROOT),
        key = request.getRemoteAddr() + ":" + email;
    var attempts =
        failures.computeIfAbsent(key, k -> Collections.synchronizedList(new ArrayList<>()));
    synchronized (attempts) {
      attempts.removeIf(t -> t.isBefore(Instant.now().minusSeconds(300)));
      if (attempts.size() >= 8)
        throw new ResponseStatusException(
            TOO_MANY_REQUESTS, "Too many attempts. Try again in five minutes.");
    }
    try {
      var auth =
          manager.authenticate(new UsernamePasswordAuthenticationToken(email, login.password()));
      if (request.getSession(false) != null) request.changeSessionId();
      var context = SecurityContextHolder.createEmptyContext();
      context.setAuthentication(auth);
      SecurityContextHolder.setContext(context);
      new HttpSessionSecurityContextRepository().saveContext(context, request, response);
      failures.remove(key);
      return repository.byEmail(email).orElseThrow();
    } catch (AuthenticationException e) {
      attempts.add(Instant.now());
      throw new ResponseStatusException(UNAUTHORIZED, "Email or password is incorrect.");
    }
  }

  @PostMapping("/register")
  User register(@Valid @RequestBody Register r) {
    if (r.password().getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 72)
      throw new IllegalArgumentException("Password must be no more than 72 UTF-8 bytes.");
    curricula.latest(r.program(), r.curriculumYear());
    return repository.create(
        r.email().trim().toLowerCase(Locale.ROOT),
        passwords.encode(r.password()),
        r.name().trim(),
        "STUDENT",
        r.program(),
        r.curriculumYear(),
        repository.defaultAdvisor().orElse(null));
  }
}
