import { test, expect } from "@playwright/test";
import type { APIRequestContext, Page } from "@playwright/test";

async function signIn(page: Page, role = "student") {
  await page.goto("/");
  await page
    .getByRole("button", {
      name:
        role === "admin"
          ? "Administrator"
          : role === "advisor"
            ? "Advisor"
            : "Student",
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
  await page
    .getByRole("button", { name: "Create starting path", exact: true })
    .click();
  await expect(page.getByLabel("Plan name", { exact: true })).toHaveValue(
    "New student path",
  );
  await expect(page.locator(".evaluation-foot")).toContainText("10 earned");
});

test("advisor reviews a submitted plan and the student sees the decision", async ({
  page,
}) => {
  const raw = page.request;
  await signIn(page);
  const original = (await request(raw, "/plans"))[0];
  const copy = await request(raw, "/plans", "POST", {
    name: "Advisor browser review",
    curriculumId: original.curriculumId,
    data: original.data,
  });
  await request(raw, `/plans/${copy.plan.id}/submit`, "POST");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome to your planner" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Advisor", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Advisor workspace", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Student", { exact: true })
    .selectOption({ label: "Atabek Bakhtyzhanov · student@planner.local" });
  await page.getByLabel("Study path").selectOption(copy.plan.id);
  await page.getByLabel("Decision").selectOption("APPROVED");
  await page
    .getByLabel("Comments")
    .fill(
      "Reviewed prerequisites, availability, class times and credit loads.",
    );
  await page.getByRole("button", { name: "Save review", exact: true }).click();
  await expect(page.locator(".review-history")).toContainText("Approved");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.getByRole("button", { name: "Student", exact: true }).click();
  await page
    .getByRole("button", { name: "Advisor review", exact: true })
    .click();
  await expect(page.locator(".review-history")).toContainText(
    "Reviewed prerequisites",
  );
  await request(raw, `/plans/${copy.plan.id}`, "DELETE");
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
