import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const extensionRoot = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(extensionRoot, "..");
const extensionPath = path.join(extensionRoot, ".output/chrome-mv3");
const manifestPath = path.join(extensionPath, "manifest.json");
const fixturePath = path.join(repoRoot, "tests/fixtures/classroom_assignment_page.html");
const expectedFiles = [
  "item.json",
  "item.md",
  "raw_text.txt",
  "links.jsonl",
  "attachments.manifest.jsonl",
  "page.snapshot.html",
];

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch (error) {
    throw new Error(
      "Playwright is required for the fixture smoke. Install it with `npm install -D playwright` or run from the monorepo where Playwright is already installed."
    );
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

async function waitForCompleteDownloads(serviceWorker, expectedCount, timeoutMs = 10_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const downloads = await serviceWorker.evaluate(
      async () => await new Promise((resolve) => chrome.downloads.search({}, resolve))
    );
    if (downloads.length >= expectedCount && downloads.every((download) => download.state === "complete")) {
      return downloads;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return await serviceWorker.evaluate(async () => await new Promise((resolve) => chrome.downloads.search({}, resolve)));
}

async function main() {
  assert(fs.existsSync(manifestPath), "Build output is missing. Run `npm run build` before `npm run smoke:fixture`.");
  const manifest = readJson(manifestPath);
  assert(manifest.version === "0.1.2", `Expected built manifest version 0.1.2, got ${manifest.version}.`);
  assert(!manifest.permissions?.includes("scripting"), "Built manifest still contains the rejected scripting permission.");
  assert(!manifest.permissions?.includes("activeTab"), "Built manifest still contains the redundant activeTab permission.");

  const playwright = await loadPlaywright();
  const { chromium } = playwright;
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "coursebinder-smoke-"));
  const html = fs.readFileSync(fixturePath, "utf8");
  const keepProfile = process.env.COURSEBINDER_KEEP_SMOKE_PROFILE === "1";

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    executablePath: chromium.executablePath(),
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-background-networking",
    ],
  });

  try {
    await context.route("https://classroom.google.com/**", async (route) => {
      await route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html });
    });

    let serviceWorker = context.serviceWorkers()[0];
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent("serviceworker", { timeout: 10_000 });
    }
    const extensionId = new URL(serviceWorker.url()).host;

    const classroomPage = await context.newPage();
    await classroomPage.goto("https://classroom.google.com/c/abc/a/def/details", { waitUntil: "domcontentloaded" });
    await classroomPage.waitForTimeout(500);

    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`, { waitUntil: "domcontentloaded" });
    await classroomPage.bringToFront();

    const exportResponse = await popupPage.evaluate(
      async () =>
        await new Promise((resolve) => {
          chrome.runtime.sendMessage({ type: "classroom_ai:export_current", downloadAttachments: false }, (response) => {
            if (chrome.runtime.lastError) {
              resolve({ ok: false, error: chrome.runtime.lastError.message });
              return;
            }
            resolve(response);
          });
        })
    );

    assert(exportResponse?.ok, `Export response was not ok: ${JSON.stringify(exportResponse)}`);
    assert(exportResponse?.fallbackResponse?.ok, "Expected browser-download fallback to succeed without native host.");
    assert(exportResponse?.nativeResponse?.ok === false, "Expected native host to be absent in fixture smoke.");

    const fallbackPaths = exportResponse.fallbackResponse.paths || {};
    for (const fileName of expectedFiles) {
      assert(fallbackPaths[fileName]?.startsWith("CourseBinder/"), `Missing fallback path for ${fileName}.`);
    }

    const downloads = await waitForCompleteDownloads(serviceWorker, expectedFiles.length);
    assert(downloads.length >= expectedFiles.length, `Expected ${expectedFiles.length} downloads, saw ${downloads.length}.`);
    assert(downloads.every((download) => download.state === "complete"), "Not all fallback downloads completed.");

    const summary = {
      ok: true,
      extensionId,
      userDataDir,
      manifest: {
        name: manifest.name,
        version: manifest.version,
        permissions: manifest.permissions,
        host_permissions: manifest.host_permissions,
      },
      fallbackRoot: exportResponse.fallbackResponse.root,
      fallbackFiles: expectedFiles,
      completedDownloads: downloads.length,
    };
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await context.close();
    if (!keepProfile) {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
