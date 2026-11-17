import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const directory = fileURLToPath(new URL("../apps/web/", import.meta.url));
const next = fileURLToPath(new URL("../apps/web/node_modules/next/dist/bin/next", import.meta.url));

const child = spawn(process.execPath, [next, "start", "--hostname", "127.0.0.1", "--port", "0"], {
  cwd: directory,
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
  stdio: ["ignore", "pipe", "pipe"],
});

let output = "";

try {
  const port = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Web startup timed out")), 20000);
    function collect(chunk) {
      output += chunk.toString();
      const match = output.match(/http:\/\/127\.0\.0\.1:(\d+)/);
      if (match && /Ready in/.test(output)) {
        clearTimeout(timeout);
        resolve(match[1]);
      }
    }
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Web exited ${code}: ${output}`));
    });
  });

  const baseUrl = `http://127.0.0.1:${port}`;

  console.log(`Running P03.02 web route acceptance tests against ${baseUrl}...`);

  // 1. Public Indexable Routes
  const publicRoutes = [
    ["/", "TraceMigo", "Read the code."],
    ["/catalog", "Small code.", "The warmup library"],
    ["/catalog/python", "Python Code Comprehension", "Language Track · Python"],
    ["/cases/python/token-bucket", "Token Bucket Rate Limiter", "Concurrency"],
    ["/diagnostic", "25-Minute Diagnostic Benchmark", "Calibrated Assessment"],
    ["/methodology", "Pedagogical Framework", "Predict → Trace → Explain"],
    ["/pricing", "Transparent practice tiers", "Fair Pricing"],
    ["/privacy", "Privacy Policy", "Data Governance"],
    ["/terms", "Terms of Service", "Legal Boundaries"],
    ["/login", "Sign In", "Access your practice workspace"],
    ["/register", "Account Registration", "Create your TraceMigo account"],
    ["/warmup/python/running-total", "running_total.py", "Follow the running total"],
    ["/warmup/python/list-references", "list_references.py", "Two names, one list"],
    ["/warmup/python/default-arguments", "default_arguments.py", "Default values"],
  ];

  for (const [route, ...expectedTexts] of publicRoutes) {
    const res = await fetch(`${baseUrl}${route}`, { redirect: "manual" });
    assert.equal(res.status, 200, `Expected 200 for public route ${route}, got ${res.status}`);
    const body = await res.text();
    for (const text of expectedTexts) {
      assert.ok(
        body.includes(text),
        `Public route ${route} missing expected content "${text}"`
      );
    }
  }
  console.log("PASS: 14 public canonical routes serve 200 with verified content.");

  // 2. Canonical SEO & Metadata on Case Landing Page
  const caseRes = await fetch(`${baseUrl}/cases/python/token-bucket`);
  const caseHtml = await caseRes.text();
  assert.ok(
    caseHtml.includes('rel="canonical" href="https://tracemigo.com/cases/python/token-bucket"'),
    "Case page missing canonical link tag"
  );
  assert.ok(
    caseHtml.includes('application/ld+json'),
    "Case page missing JSON-LD structured data script"
  );
  assert.ok(
    caseHtml.includes('"@type":"LearningResource"'),
    "Case page JSON-LD missing LearningResource type"
  );
  console.log("PASS: Case landing page serves canonical link and JSON-LD schema.");

  // 3. Crawler Protection: robots.txt and sitemap.xml
  const robotsRes = await fetch(`${baseUrl}/robots.txt`);
  assert.equal(robotsRes.status, 200);
  const robotsTxt = await robotsRes.text();
  assert.ok(robotsTxt.includes("Disallow: /workspace/"), "robots.txt missing /workspace/ disallow");
  assert.ok(robotsTxt.includes("Disallow: /history"), "robots.txt missing /history disallow");
  assert.ok(robotsTxt.includes("Disallow: /settings"), "robots.txt missing /settings disallow");
  assert.ok(robotsTxt.includes("Disallow: /billing"), "robots.txt missing /billing disallow");
  assert.ok(robotsTxt.includes("Disallow: /admin/"), "robots.txt missing /admin/ disallow");
  assert.ok(robotsTxt.includes("sitemap.xml"), "robots.txt missing sitemap reference");

  const sitemapRes = await fetch(`${baseUrl}/sitemap.xml`);
  assert.equal(sitemapRes.status, 200);
  const sitemapXml = await sitemapRes.text();
  assert.ok(sitemapXml.includes("https://tracemigo.com/catalog"), "sitemap missing /catalog");
  assert.ok(sitemapXml.includes("https://tracemigo.com/cases/python/token-bucket"), "sitemap missing case landing page");
  assert.ok(!sitemapXml.includes("/workspace/"), "sitemap improperly includes private workspace");
  assert.ok(!sitemapXml.includes("/admin/"), "sitemap improperly includes admin routes");
  console.log("PASS: robots.txt and sitemap.xml strictly enforce crawler access boundaries.");

  // 4. Legacy Route Redirects (ADR 0003 section 6)
  const redirects = [
    ["/practice", 308, "/catalog"],
    ["/practice/python/token-bucket", 308, "/cases/python/token-bucket"],
    ["/practice/c2807f4a-7140-4da2-a4e3-3ce0f96d66e7", 307, "/workspace/c2807f4a-7140-4da2-a4e3-3ce0f96d66e7"],
  ];

  for (const [source, expectedStatus, expectedDestination] of redirects) {
    const res = await fetch(`${baseUrl}${source}`, { redirect: "manual" });
    assert.equal(
      res.status,
      expectedStatus,
      `Legacy route ${source} expected redirect ${expectedStatus}, got ${res.status}`
    );
    const location = res.headers.get("location");
    assert.ok(
      location?.includes(expectedDestination),
      `Legacy route ${source} expected location containing ${expectedDestination}, got ${location}`
    );
  }
  console.log("PASS: Legacy route redirects resolve according to ADR 0003.");

  // 5. Auth Middleware Guard on Private Routes (Unauthenticated)
  const privateRoutes = [
    "/workspace/attempt-123",
    "/history",
    "/settings",
    "/billing",
    "/admin/catalog",
    "/admin/appeals",
  ];

  for (const route of privateRoutes) {
    const res = await fetch(`${baseUrl}${route}`, { redirect: "manual" });
    assert.equal(
      res.status,
      307,
      `Private route ${route} must redirect unauthenticated users with 307, got ${res.status}`
    );
    const location = res.headers.get("location");
    assert.ok(
      location?.startsWith("/login?returnTo=") || location?.includes("/login"),
      `Private route ${route} redirect location should point to /login, got ${location}`
    );
  }
  console.log("PASS: Private routes reject unauthenticated access and redirect to /login.");

  // 6. Auth Middleware Guard on Private Routes (Authenticated)
  for (const route of privateRoutes) {
    const res = await fetch(`${baseUrl}${route}`, {
      headers: {
        Cookie: "tracemigo_session=sess_demo_learner_v1",
      },
      redirect: "manual",
    });
    assert.equal(
      res.status,
      200,
      `Private route ${route} should allow authenticated requests, got ${res.status}`
    );
    const robotsHeader = res.headers.get("X-Robots-Tag");
    assert.equal(
      robotsHeader,
      "noindex, nofollow, noarchive",
      `Private route ${route} must serve X-Robots-Tag: noindex, nofollow, noarchive`
    );
  }
  console.log("PASS: Authenticated requests access private routes with X-Robots-Tag header.");

  // 7. Finite Anonymous Warmups & Guest-to-Account Transfer Content
  const registerRes = await fetch(`${baseUrl}/register`);
  const registerHtml = await registerRes.text();
  assert.ok(registerHtml.includes("Transfer Guest Warmup Progress"), "Register page missing transfer section");
  assert.ok(registerHtml.includes("Conflict Handling Policy"), "Register page missing conflict handling options");
  assert.ok(registerHtml.includes("Merge with existing account data"), "Register page missing merge conflict option");
  assert.ok(registerHtml.includes("I consent to transferring my guest reasoning notes"), "Register page missing consent checkbox");

  const catalogRes = await fetch(`${baseUrl}/catalog`);
  const catalogHtml = await catalogRes.text();
  assert.ok(catalogHtml.includes("Follow the running total"), "Catalog missing warmup 1");
  assert.ok(catalogHtml.includes("Two names, one list"), "Catalog missing warmup 2");
  assert.ok(catalogHtml.includes("Default values"), "Catalog missing warmup 3");
  assert.ok(catalogHtml.includes("Token Bucket Rate Limiter"), "Catalog missing core case");
  assert.ok(catalogHtml.includes("Search by topic"), "Catalog missing search box");
  assert.ok(catalogHtml.includes("Filter by level"), "Catalog missing level filters");

  console.log("PASS: Finite warmups (3 cards), guest-to-account transfer, and catalog states verified.");
  console.log("VERDICT: PASS");
} finally {
  if (child.exitCode === null) {
    const exited = new Promise((resolve) => child.once("exit", resolve));
    child.kill("SIGTERM");
    const force = setTimeout(() => child.kill("SIGKILL"), 5000);
    await exited;
    clearTimeout(force);
  }
}
