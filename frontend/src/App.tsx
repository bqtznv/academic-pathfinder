import { useCallback, useEffect, useRef, useState } from "react";
import {
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  FileText,
  GitCompareArrows,
  Home,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  Plus,
  Settings2,
  Shield,
  X,
} from "lucide-react";
import Auth, { Brand } from "./Auth";
import Dashboard from "./Dashboard";
import CurriculumPage from "./CurriculumPage";
import RecordsPage from "./RecordsPage";
import PlannerPage from "./PlannerPage";
import ComparePage from "./ComparePage";
import AdminPage from "./AdminPage";
import { api, refreshCsrf } from "./api";
import type {
  AcademicRecord,
  Curriculum,
  Detail,
  Offering,
  Plan,
  User,
} from "./types";
import { Badge, Button, Empty, Modal } from "./components";
const labels: Record<string, string> = {
  overview: "My academic path",
  curriculum: "My curriculum",
  records: "Academic records",
  planner: "Semester planner",
  compare: "Compare paths",
  admin: "Curriculum management",
};
export default function App() {
  const [user, setUser] = useState<User | null>(null),
    [initializing, setInitializing] = useState(true),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [toast, setToast] = useState("");
  const [view, setView] = useState("overview"),
    [mobile, setMobile] = useState(false),
    [profile, setProfile] = useState(false);
  const [curriculum, setCurriculum] = useState<Curriculum | null>(null),
    [records, setRecords] = useState<AcademicRecord[]>([]),
    [offerings, setOfferings] = useState<Offering[]>([]),
    [plans, setPlans] = useState<Plan[]>([]),
    [detail, setDetail] = useState<Detail | null>(null);
  const [creating, setCreating] = useState(false),
    [planName, setPlanName] = useState("My graduation path"),
    [busy, setBusy] = useState(false),
    [modalError, setModalError] = useState("");
  const [dirty, setDirty] = useState(false),
    [pending, setPending] = useState<(() => void) | null>(null);
  const selectedRef = useRef<string>("");
  const notify = useCallback((m: string) => setToast(m), []);
  useEffect(() => {
    refreshCsrf()
      .then(() => api<User>("/auth/me"))
      .then((u) => {
        setUser(u);
        setView(
          u.role === "ADMIN"
            ? "admin"
            : Object.hasOwn(labels, location.hash.slice(1))
              ? location.hash.slice(1)
              : "overview",
        );
      })
      .catch((e) => {
        if (e.message !== "Sign in to continue.") setError(e.message);
      })
      .finally(() => setInitializing(false));
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 6000);
    return () => clearTimeout(t);
  }, [toast]);
  const load = useCallback(async () => {
    if (!user) return;
    setError("");
    try {
      const [c, o, r, p] = await Promise.all([
        api<Curriculum>("/curriculum"),
        api<Offering[]>("/offerings"),
        user.role === "STUDENT"
          ? api<AcademicRecord[]>("/records")
          : Promise.resolve([] as AcademicRecord[]),
        user.role === "STUDENT"
          ? api<Plan[]>("/plans")
          : Promise.resolve([] as Plan[]),
      ]);
      setCurriculum(c);
      setOfferings(o);
      setRecords(r);
      setPlans(p);
      const id = p.find((x) => x.id === selectedRef.current)?.id || p[0]?.id;
      selectedRef.current = id || "";
      setDetail(id ? await api<Detail>(`/plans/${id}`) : null);
    } catch (e) {
      setError((e as Error).message);
      throw e;
    }
  }, [user]);
  useEffect(() => {
    if (user) {
      setLoading(true);
      load()
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [user, load]);
  function guard(action: () => void) {
    if (dirty) setPending(() => action);
    else action();
  }
  function navigate(v: string) {
    guard(() => {
      setDirty(false);
      setView(v);
      history.replaceState(null, "", `#${v}`);
      setMobile(false);
      window.scrollTo({ top: 0 });
    });
  }
  function create() {
    guard(() => {
      setDirty(false);
      setPlanName(
        plans.length ? "Alternative graduation path" : "My graduation path",
      );
      setModalError("");
      setCreating(true);
    });
  }
  async function select(id: string) {
    guard(() => {
      setDirty(false);
      selectedRef.current = id;
      setLoading(true);
      api<Detail>(`/plans/${id}`)
        .then(setDetail)
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    });
  }
  async function onSaved(d: Detail) {
    selectedRef.current = d.plan.id;
    setDirty(false);
    await load();
    setDetail(d);
  }
  async function logout() {
    guard(() => {
      api("/auth/logout", "POST")
        .then(() => {
          setUser(null);
          setCurriculum(null);
          setPlans([]);
          setDetail(null);
          setRecords([]);
          setDirty(false);
          setProfile(false);
          setMobile(false);
          selectedRef.current = "";
          history.replaceState(null, "", location.pathname);
          return refreshCsrf();
        })
        .catch((e) => setError(e.message));
    });
  }
  const onLogin = (u: User) => {
    setError("");
    setUser(u);
    setView(u.role === "ADMIN" ? "admin" : "overview");
  };
  if (initializing)
    return (
      <div className="boot-loading">
        <Brand />
        <Loader2 className="spin" />
        <p>Opening your academic portal…</p>
      </div>
    );
  if (!user)
    return (
      <>
        {error && (
          <div className="connection-banner" role="alert">
            {error}
            <button onClick={() => location.reload()}>Retry connection</button>
          </div>
        )}
        <Auth onLogin={onLogin} />
      </>
    );
  const studentNav = [
    ["overview", Home, "My academic path"],
    ["curriculum", BookOpen, "My curriculum"],
    ["records", FileText, "Academic records"],
    ["planner", CalendarDays, "Semester planner"],
    ["compare", GitCompareArrows, "Compare paths"],
  ] as const;
  const activeNav =
    user.role === "ADMIN"
      ? ([
          ["admin", Settings2, "Curriculum management"],
          ["curriculum", BookOpen, "My curriculum"],
        ] as const)
      : studentNav;
  const allowed = new Set(activeNav.map(([id]) => id));
  const active = allowed.has(view as never)
    ? view
    : user.role === "ADMIN"
      ? "admin"
      : "overview";
  return (
    <div className="app">
      <div className="top-strip">
        <span>
          SDU UNIVERSITY <i /> ACADEMIC PATH PLANNER
        </span>
        <span>
          <span className="online-dot" />
          Student planning portal <b>2026–2027</b>
        </span>
      </div>
      <header className="portal-header">
        <div className="header-inner">
          <button
            className="mobile-menu icon-button"
            aria-label="Open navigation"
            onClick={() => setMobile(!mobile)}
          >
            <Menu size={24} />
          </button>
          <Brand />
          <div className="portal-title">
            <strong>Student Information System</strong>
          </div>
          <div className="profile-summary">
            <div>
              <strong>{user.name}</strong>
              <span>
                {user.program} <i /> {user.curriculumYear}
              </span>
            </div>
            <button
              className="avatar"
              aria-label="Open account details"
              onClick={() => setProfile(true)}
            >
              {user.name
                .split(" ")
                .slice(0, 2)
                .map((n) => n[0])
                .join("")}
            </button>
            <button
              className="icon-button"
              aria-label="Open account"
              onClick={() => setProfile(true)}
            >
              <ChevronDown size={16} />
            </button>
          </div>
          <Button
            variant="secondary"
            className="header-logout"
            onClick={logout}
          >
            <LogOut size={16} />
            Logout
          </Button>
        </div>
      </header>
      <div className="portal-shell">
        {mobile && (
          <button
            className="nav-backdrop"
            aria-label="Close navigation"
            onClick={() => setMobile(false)}
          />
        )}
        <aside className={`sidebar ${mobile ? "open" : ""}`}>
          <div className="sidebar-title">
            <span>STUDENT PORTAL</span>
            <Badge tone="blue">
              {user.role === "STUDENT" ? "Planner" : "Admin"}
            </Badge>
          </div>
          <button
            className="home-link"
            onClick={() =>
              navigate(user.role === "ADMIN" ? "admin" : "overview")
            }
          >
            <LayoutDashboard size={17} />
            Home page
            <ChevronRight size={14} />
          </button>
          <span className="nav-group-label">
            {user.role === "STUDENT"
              ? "Academic operations"
              : "Academic management"}
          </span>
          <nav aria-label="Main navigation">
            {activeNav.map(([id, Icon, label]) => (
              <button
                aria-current={active === id ? "page" : undefined}
                className={active === id ? "active" : ""}
                key={id}
                onClick={() => navigate(id)}
              >
                <Icon size={18} strokeWidth={1.7} />
                {label}
              </button>
            ))}
          </nav>
          <span className="nav-group-label">Information & support</span>
          <nav aria-label="Support">
            <button onClick={() => setProfile(true)}>
              <Shield size={18} strokeWidth={1.7} />
              My account
            </button>
          </nav>
        </aside>
        <div className="content-wrap">
          <div className="breadcrumb">
            <span>Student portal</span>
            <ChevronRight size={12} />
            <span>
              {user.role === "STUDENT"
                ? "Academic operations"
                : "Academic management"}
            </span>
            <ChevronRight size={12} />
            <strong>{labels[active]}</strong>
          </div>
          <main className="main-content">
            {error && (
              <div role="alert" className="form-error app-error">
                {error}
                <button
                  className="text-button"
                  onClick={() => load().catch(() => {})}
                >
                  Retry
                </button>
              </div>
            )}
            {loading ? (
              <div className="page-loading">
                <Loader2 className="spin" size={25} />
                <p>Loading your academic path…</p>
              </div>
            ) : curriculum ? (
              <>
                {active === "overview" && (
                  <Dashboard
                    user={user}
                    curriculum={curriculum}
                    detail={detail}
                    records={records}
                    navigate={navigate}
                    create={create}
                  />
                )}
                {active === "curriculum" && (
                  <CurriculumPage
                    curriculum={curriculum}
                    records={records}
                    offerings={offerings}
                  />
                )}
                {active === "records" && (
                  <RecordsPage
                    records={records}
                    curriculum={curriculum}
                    reload={load}
                    notify={notify}
                  />
                )}
                {active === "planner" &&
                  (detail ? (
                    <PlannerPage
                      key={`${detail.plan.id}-${detail.plan.revision}`}
                      detail={detail}
                      plans={plans}
                      records={records}
                      select={select}
                      onSaved={onSaved}
                      create={create}
                      notify={notify}
                      onDirty={setDirty}
                    />
                  ) : (
                    <>
                      <div className="page-heading">
                        <div>
                          <span className="eyebrow">ACADEMIC OPERATIONS</span>
                          <h1>Semester planner</h1>
                        </div>
                      </div>
                      <section className="panel">
                        <Empty title="No saved plans" description="">
                          <Button onClick={create}>
                            <Plus size={16} />
                            Create my first path
                          </Button>
                        </Empty>
                      </section>
                    </>
                  ))}
                {active === "compare" && (
                  <ComparePage
                    plans={plans}
                    navigate={() => navigate("planner")}
                  />
                )}

                {active === "admin" && (
                  <AdminPage notify={notify} onRefresh={load} />
                )}
              </>
            ) : !error ? (
              <div className="page-loading">
                <Loader2 className="spin" />
              </div>
            ) : null}
          </main>
        </div>
      </div>
      {toast && (
        <div role="status" className="toast">
          <Check size={19} />
          <span>{toast}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {creating && (
        <Modal
          title="Create a new academic path"
          onClose={() => setCreating(false)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setModalError("");
              try {
                const d = await api<Detail>("/plans", "POST", {
                  name: planName,
                });
                await onSaved(d);
                setCreating(false);
                setView("planner");
                notify("Plan created.");
              } catch (err) {
                setModalError((err as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="modal-body">
              <label>
                Path name
                <input
                  required
                  maxLength={100}
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                />
              </label>
              {modalError && (
                <div role="alert" className="form-error">
                  {modalError}
                </div>
              )}
            </div>
            <div className="modal-actions">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setCreating(false)}
              >
                Cancel
              </Button>
              <Button type="submit" busy={busy}>
                Create path
              </Button>
            </div>
          </form>
        </Modal>
      )}
      {pending && (
        <Modal
          title="You have unsaved plan changes"
          onClose={() => setPending(null)}
        >
          <div className="modal-body">
            <p>
              Save your draft in the planner to keep it, or discard the changes
              before continuing.
            </p>
          </div>
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setPending(null)}>
              Keep editing
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                const action = pending;
                setPending(null);
                setDirty(false);
                action();
              }}
            >
              Discard & continue
            </Button>
          </div>
        </Modal>
      )}
      {profile && (
        <Modal title="My account" onClose={() => setProfile(false)}>
          <div className="modal-body">
            <div className="account-person">
              <span className="avatar">
                {user.name
                  .split(" ")
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join("")}
              </span>
              <div>
                <h3>{user.name}</h3>
                <p>{user.email}</p>
              </div>
            </div>
            <dl className="account-details">
              <dt>Account role</dt>
              <dd>{user.role[0] + user.role.slice(1).toLowerCase()}</dd>
              <dt>Program</dt>
              <dd>{user.program}</dd>
              <dt>Curriculum year</dt>
              <dd>{user.curriculumYear}</dd>
            </dl>
          </div>
          <div className="modal-actions">
            <Button onClick={() => setProfile(false)}>Done</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
