let csrf = "";
export async function refreshCsrf() {
  const r = await fetch("/api/auth/csrf", { credentials: "same-origin" });
  if (!r.ok)
    throw new Error(
      "Cannot connect to the application. Check that the server is running.",
    );
  csrf = (await r.json()).token;
}
export async function api<T = unknown>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  if (method !== "GET" && !csrf) await refreshCsrf();
  const r = await fetch("/api" + path, {
    method,
    credentials: "same-origin",
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(method === "GET" ? {} : { "X-XSRF-TOKEN": csrf }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!r.ok) {
    let message = `Request failed (${r.status})`;
    try {
      const e = await r.json();
      message = e.message || message;
    } catch {
      /* Empty error response. */
    }
    throw new Error(message);
  }
  if (r.status === 204 || r.headers.get("content-length") === "0")
    return undefined as T;
  const text = await r.text();
  return text ? JSON.parse(text) : (undefined as T);
}
export function termLabel(term: string | null | undefined) {
  if (!term) return "Not confirmed";
  const [year, season] = term.split("-");
  return `${season[0] + season.slice(1).toLowerCase()} ${year}`;
}
export function termOrder(a: string, b: string) {
  const order = ["SPRING", "SUMMER", "FALL"];
  const [ay, as] = a.split("-"),
    [by, bs] = b.split("-");
  return (
    Number(ay) * 3 + order.indexOf(as) - (Number(by) * 3 + order.indexOf(bs))
  );
}
export function terms(start = 2026, end = 2035) {
  return Array.from({ length: end - start + 1 }, (_, i) =>
    ["SPRING", "SUMMER", "FALL"].map((s) => `${start + i}-${s}`),
  ).flat();
}
export function download(name: string, content: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}
