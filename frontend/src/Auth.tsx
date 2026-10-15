import { useEffect, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  GraduationCap,
  ShieldCheck,
} from "lucide-react";
import { api, refreshCsrf } from "./api";
import type { User } from "./types";
import { Button } from "./components";

export function Brand() {
  return (
    <div className="brand">
      <div className="brand-mark">
        <GraduationCap size={31} strokeWidth={1.5} />
      </div>
      <div>
        <b>
          SDU<span>1996</span>
        </b>
        <small>UNIVERSITY</small>
      </div>
    </div>
  );
}
export default function Auth({ onLogin }: { onLogin: (u: User) => void }) {
  const [register, setRegister] = useState(false),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState("");
  const [programs, setPrograms] = useState<{ program: string; year: number }[]>(
      [],
    ),
    [choice, setChoice] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    api<typeof programs>("/programs")
      .then(setPrograms)
      .catch((e) => setError(e.message));
  }, []);
  async function signIn(e?: React.FormEvent, account?: string) {
    e?.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (register && !account) {
        const p = programs[choice];
        if (!p)
          throw new Error(
            "No published curriculum is available. Ask an administrator to publish one.",
          );
        await api("/auth/register", "POST", {
          email,
          password,
          name,
          program: p.program,
          curriculumYear: p.year,
        });
      }
      const u = await api<User>("/auth/login", "POST", {
        email: account || email,
        password: account ? "Planner2026!" : password,
      });
      await refreshCsrf();
      onLogin(u);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <section className="auth-story">
        <Brand />
        <div className="auth-story-main">
          <span className="eyebrow light">ACADEMIC PATH PLANNER</span>
          <h1>
            Your degree.
            <br />
            Your direction.
          </h1>
          <p>
            Turn your curriculum into a clear, semester-by-semester path to
            graduation.
          </p>
          <div className="story-steps">
            <div>
              <Check size={16} />
              Understand what’s left
            </div>
            <div>
              <Check size={16} />
              Test your next move
            </div>
            <div>
              <Check size={16} />
              Plan with confidence
            </div>
          </div>
        </div>
        <div className="auth-foot">
          <BookOpen size={17} /> Built around your academic journey
        </div>
      </section>
      <section className="auth-form-side">
        <div className="auth-form">
          <span className="eyebrow">STUDENT INFORMATION SYSTEM</span>
          <h2>
            {register ? "Start your academic path" : "Welcome to your planner"}
          </h2>
          <p>
            {register
              ? "Create a planner account and select your curriculum."
              : "Sign in to see your progress and plan what comes next."}
          </p>
          <form onSubmit={signIn}>
            {register && (
              <label>
                Full name
                <input
                  required
                  maxLength={120}
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                />
              </label>
            )}
            <label>
              Email address
              <input
                required
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </label>
            <label>
              Password
              <input
                required
                type="password"
                minLength={register ? 10 : 1}
                maxLength={register ? 72 : 100}
                autoComplete={register ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={
                  register ? "At least 10 characters" : "Enter your password"
                }
              />
            </label>
            {register && (
              <label>
                Program & curriculum year
                <select
                  value={choice}
                  onChange={(e) => setChoice(Number(e.target.value))}
                >
                  {programs.map((p, i) => (
                    <option key={i} value={i}>
                      {p.program} · {p.year}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {error && (
              <div role="alert" className="form-error">
                {error}
              </div>
            )}
            <Button type="submit" busy={busy}>
              {register ? "Create account" : "Sign in"}
              <ArrowRight size={17} />
            </Button>
          </form>
          <p className="auth-switch">
            {register ? "Already have an account?" : "New to the planner?"}{" "}
            <button
              onClick={() => {
                setRegister(!register);
                setError("");
              }}
            >
              {register ? "Sign in" : "Create an account"}
            </button>
          </p>
          <div className="demo-box">
            <div>
              <ShieldCheck size={17} />
              <strong>Explore the sample portal</strong>
            </div>
            <p>Fictional academic data. No SDU account needed.</p>
            <div className="demo-buttons">
              {["student", "advisor", "admin"].map((role) => (
                <Button
                  key={role}
                  variant="secondary"
                  disabled={busy}
                  onClick={() => signIn(undefined, `${role}@planner.local`)}
                >
                  {role === "admin"
                    ? "Administrator"
                    : role[0].toUpperCase() + role.slice(1)}
                </Button>
              ))}
            </div>
          </div>
          <small className="independent-note">
            Independent academic planning project. Not an official SDU service.
          </small>
        </div>
      </section>
    </main>
  );
}
