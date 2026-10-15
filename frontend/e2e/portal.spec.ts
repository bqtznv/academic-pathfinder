import { test, expect } from "@playwright/test";
import type { APIRequestContext, Page } from "@playwright/test";

async function signIn(page: Page, role = "student") {
  await page.goto("/");
  await page
    .getByRole("button", {
      name: role === "admin" ? "Administrator" : "Student",
      exact: true,
    })
    .click();
  await expect(page.locator(".app")).toBeVisible();
}
async function request(
  request: APIRequestContext,
  path: string,
  method = "GET",
  data?: unknown,
) {
  const csrf = await (await request.get("/api/auth/csrf")).json();
  const r = await request.fetch("/api" + path, {
    method,
    data,
    headers: { "X-XSRF-TOKEN": csrf.token },
  });
  expect(r.ok(), await r.text()).toBeTruthy();
  const text = await r.text();
  return text ? JSON.parse(text) : null;
}

test("student dashboard and searchable curriculum use real progress", async ({
  page,
}) => {
  await signIn(page);
  await expect(
    page.getByRole("heading", { name: "My academic path", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("120 of 240 ECTS")).toBeVisible();
  await expect(page.getByText("Spring 2028", { exact: true })).toHaveCount(3);
  await page
    .getByRole("button", { name: "My curriculum", exact: true })
    .click();
  await page.getByRole("textbox", { name: "Search courses" }).fill("CSS 109");
  await expect(
    page.getByRole("button", { name: "Calculus 1", exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "CSS 109", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "No prerequisites required.",
  );
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.screenshot({
    path: "test-results/curriculum-desktop.png",
    fullPage: true,
  });
});

test("what-if failing a current prerequisite changes the forecast without saving", async ({
  page,
}) => {
  const raw = page.request;
  await signIn(page);
  const before = await request(raw, "/plans");
  const original = await request(raw, `/plans/${before[0].id}`);
  await page
    .getByRole("button", { name: "Semester planner", exact: false })
    .first()
    .click();
  await page
    .getByRole("button", { name: "What if I change a course?", exact: true })
    .click();
  await page.getByLabel("What-if action").selectOption("fail");
  await page.getByLabel("What-if course").selectOption("CSS 301");
  await page
    .getByRole("button", { name: "Preview change", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Not confirmed", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "CSS 302 requires CSS 301 to be passed in an earlier semester.",
      { exact: true },
    ),
  ).toBeVisible();
  const after = await request(raw, `/plans/${before[0].id}`);
  expect(after.plan.data).toEqual(original.plan.data);
  await page
    .getByRole("button", { name: "My curriculum", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "You have unsaved plan changes",
  );
  await page.getByRole("button", { name: "Keep editing", exact: true }).click();
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(
    page
      .locator(".evaluation-summary")
      .getByRole("heading", { name: "Spring 2028", exact: true }),
  ).toBeVisible();
});

test("course moves, save as copy and comparison persist an independent scenario", async ({
  page,
}) => {
  const raw = page.request;
  await signIn(page);
  await page
    .getByRole("button", { name: "Semester planner", exact: false })
    .first()
    .click();
  await page.getByRole("button", { name: "Move CSS 401", exact: true }).click();
  await page.getByLabel("Destination semester").selectOption("2028-FALL");
  await page.getByRole("button", { name: "Place course", exact: true }).click();
  await expect(
    page.getByText(
      "CSS 402 requires CSS 401 to be passed in an earlier semester.",
      { exact: true },
    ),
  ).toBeVisible();
  await page
    .getByLabel("Plan name", { exact: true })
    .fill("Browser what-if scenario");
  await page.getByRole("button", { name: "Save as copy", exact: true }).click();
  await expect(page.getByLabel("Plan name", { exact: true })).toHaveValue(
    "Browser what-if scenario (what-if)",
  );
  await page
    .getByRole("button", { name: "Compare paths", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Semester-by-semester difference" }),
  ).toBeVisible();
  await expect(page.locator(".comparison-grid")).toContainText("Not confirmed");
  const plans = await request(raw, "/plans");
  const copy = plans.find(
    (p: { name: string }) => p.name === "Browser what-if scenario (what-if)",
  );
  await request(raw, `/plans/${copy.id}`, "DELETE");
});

test("new student reviews an import before confirming academic records", async ({
  page,
}) => {
  const raw = page.request;
  await page.goto("/");
  await page
    .getByRole("button", { name: "Create an account", exact: true })
    .click();
  await page.getByLabel("Full name").fill("Browser Test Student");
  await page
    .getByLabel("Email address")
    .fill(`browser-${Date.now()}@example.com`);
  await page.getByLabel("Password", { exact: true }).fill("BrowserTest2026!");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "My academic path", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Academic records", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Import records", exact: true })
    .click();
  await page
    .getByLabel("File contents")
    .fill(
      "courseCode,status,grade,term\nCSS 109,PASSED,B+,2024-FALL\nCSS 112,PASSED,A-,2024-FALL",
    );
  await page
    .getByRole("button", { name: "Preview matched records", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "2 matched records — review before saving",
    }),
  ).toBeVisible();
  expect(await request(raw, "/records")).toHaveLength(0);
  await page
    .getByRole("button", { name: "Confirm & save 2 records", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await request(raw, "/records")).toHaveLength(2);
  await page
    .getByRole("button", { name: "Semester planner", exact: false })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Create my first path", exact: true })
    .click();
  await page.getByLabel("Path name").fill("New student path");
  await page.getByRole("button", { name: "Create path", exact: true }).click();
  await expect(page.getByLabel("Plan name", { exact: true })).toHaveValue(
    "New student path",
  );
  await expect(page.locator(".evaluation-foot")).toContainText("10 earned");
  const created = (await request(raw, "/plans"))[0];
  expect(created.data.semesters).toEqual({});
  await page
    .getByRole("button", { name: "Add semester", exact: true })
    .first()
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add semester", exact: true })
    .click();
  await page.getByRole("button", { name: "Add CSS 101", exact: true }).click();
  await page.getByRole("button", { name: "Place course", exact: true }).click();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Save changes", exact: true }),
  ).toBeDisabled();
  const saved = await request(raw, `/plans/${created.id}`);
  expect(Object.values(saved.plan.data.semesters).flat()).toContain("CSS 101");
});

test("logout ends the session and removed features are absent on desktop and mobile", async ({
  page,
}) => {
  await signIn(page);
  await expect(
    page.getByRole("button", { name: "Advisor review", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.locator(".portal-footer,.sidebar-tip,.sample-indicator,.tip-card"),
  ).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("Sample academic data");
  await expect(page.locator("body")).not.toContainText(
    "Independent student project",
  );
  await page
    .getByRole("button", { name: "Semester planner", exact: false })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: /Suggest.*path/i }),
  ).toHaveCount(0);
  await page
    .getByLabel("Plan name", { exact: true })
    .fill("Unsaved logout check");
  await page.getByRole("button", { name: "Logout", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("unsaved plan changes");
  await page.getByRole("button", { name: "Keep editing", exact: true }).click();
  await expect(page.getByLabel("Plan name", { exact: true })).toHaveValue(
    "Unsaved logout check",
  );
  await page.getByRole("button", { name: "Logout", exact: true }).click();
  await page
    .getByRole("button", { name: "Discard & continue", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Sign in", exact: true }),
  ).toBeVisible();
  expect((await page.request.get("/api/auth/me")).status()).toBe(401);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Student", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Logout", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Logout", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Sign in", exact: true }),
  ).toBeVisible();
});

test("administrator validates and publishes a new immutable curriculum version", async ({
  page,
}) => {
  const raw = page.request;
  await signIn(page, "admin");
  const catalogs = await request(raw, "/admin/curricula");
  const original = catalogs[0];
  await page
    .getByRole("button", { name: "Validate & preview", exact: true })
    .click();
  await expect(
    page.getByText(
      `Validated: ${original.data.courses.length} courses · ${original.data.totalEcts} ECTS`,
      { exact: true },
    ),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Save new draft", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Review & publish", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Review & publish", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "student(s) use this program",
  );
  await page
    .getByRole("button", { name: "Publish version", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".admin-version-bar")).toContainText("Published");
  const updated = await request(raw, "/admin/curricula");
  expect(updated.length).toBe(catalogs.length + 1);
  expect(
    updated.find((c: { id: string }) => c.id === original.id),
  ).toBeTruthy();
  await page
    .getByRole("button", { name: "Offerings & timetable", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Edit course offering" }),
  ).toBeVisible();
});

test("mobile navigation and planner stay within the viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await expect(
    page.getByRole("heading", { name: "My academic path", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "test-results/overview-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .getByRole("button", { name: "Semester planner", exact: false })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Semester planner", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "test-results/planner-mobile.png",
    fullPage: true,
  });
});

test("administrator approves transfer credits without an advisor workspace", async ({
  page,
}) => {
  await signIn(page);
  const raw = page.request;
  await request(raw, "/records", "POST", {
    courseCode: "CSS 401",
    status: "TRANSFER",
    grade: "P",
    term: "2026-SUMMER",
    approved: false,
  });
  const record = (await request(raw, "/records")).find(
    (r: { courseCode: string; term: string }) =>
      r.courseCode === "CSS 401" && r.term === "2026-SUMMER",
  );
  await page.getByRole("button", { name: "Logout", exact: true }).click();
  await page
    .getByRole("button", { name: "Administrator", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Transfer credits", exact: true })
    .click();
  await page
    .getByLabel("Transfer student")
    .selectOption({ label: "Atabek Bakhtyzhanov · student@planner.local" });
  const row = page.getByRole("row").filter({ hasText: "CSS 401" });
  await row
    .getByRole("button", { name: "Approve credit", exact: true })
    .click();
  await expect(row).toContainText("Approved");
  await page.getByRole("button", { name: "Logout", exact: true }).click();
  await page.getByRole("button", { name: "Student", exact: true }).click();
  await expect(page.locator('.app')).toBeVisible();
  expect(
    (await request(raw, "/records")).find(
      (r: { id: string }) => r.id === record.id,
    ).approved,
  ).toBe(true);
  await request(raw, `/records/${record.id}`, "DELETE");
});
