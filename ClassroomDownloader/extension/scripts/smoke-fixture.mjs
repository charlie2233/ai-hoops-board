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
const SMOKE_TIMEOUT_MS = Number(process.env.COURSEBINDER_SMOKE_TIMEOUT_MS || 45_000);

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

function existingFile(filePath) {
  return filePath && fs.existsSync(filePath) && fs.statSync(filePath).isFile();
}

function findInstalledPlaywrightChromes() {
  const cacheRoot = path.join(os.homedir(), "Library/Caches/ms-playwright");
  if (!fs.existsSync(cacheRoot)) {
    return [];
  }
  return fs
    .readdirSync(cacheRoot)
    .filter((entry) => /^chromium-\d+$/.test(entry))
    // If the exact Playwright browser is missing, prefer older cached Chrome-for-Testing builds.
    // They are more likely to match this repo's previously installed Playwright runtime.
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))
    .flatMap((entry) => {
      const root = path.join(cacheRoot, entry);
      return [
        path.join(root, "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"),
        path.join(root, "chrome-mac/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"),
      ];
    })
    .filter(existingFile);
}

function resolveChromeExecutable(chromium) {
  const candidates = [
    process.env.COURSEBINDER_CHROME_PATH,
    chromium.executablePath(),
    ...findInstalledPlaywrightChromes(),
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
  ];
  const executablePath = candidates.find(existingFile);
  if (!executablePath) {
    throw new Error(
      "Could not find a Chrome executable for smoke testing. Run `npx playwright install chromium` or set COURSEBINDER_CHROME_PATH."
    );
  }
  return executablePath;
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
  assert(manifest.version === "0.1.11", `Expected built manifest version 0.1.11, got ${manifest.version}.`);
  assert(!manifest.permissions?.includes("scripting"), "Built manifest still contains the rejected scripting permission.");
  assert(!manifest.permissions?.includes("activeTab"), "Built manifest still contains the redundant activeTab permission.");
  assert(
    !manifest.permissions?.includes("nativeMessaging"),
    "Default store build should not contain nativeMessaging. Use COURSEBINDER_ENABLE_NATIVE=1 for local native builds."
  );
  assert(
    JSON.stringify(manifest.host_permissions || []) === JSON.stringify(["https://classroom.google.com/*"]),
    `Expected only classroom.google.com host permission, got ${JSON.stringify(manifest.host_permissions || [])}.`
  );

  const playwright = await loadPlaywright();
  const { chromium } = playwright;
  const executablePath = resolveChromeExecutable(chromium);
  console.error(`CourseBinder fixture smoke using Chrome: ${executablePath}`);
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "coursebinder-smoke-"));
  const html = fs.readFileSync(fixturePath, "utf8");
  const keepProfile = process.env.COURSEBINDER_KEEP_SMOKE_PROFILE === "1";

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    executablePath,
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
      serviceWorker = await context.waitForEvent("serviceworker", { timeout: 30_000 });
    }
    const extensionId = new URL(serviceWorker.url()).host;

    const classroomPage = await context.newPage();
    await classroomPage.goto("https://classroom.google.com/c/abc/a/def/details", { waitUntil: "domcontentloaded" });
    await classroomPage.waitForTimeout(500);

    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`, { waitUntil: "domcontentloaded" });
    await classroomPage.bringToFront();
    const [activeClassroomTab] = await serviceWorker.evaluate(
      async () => await chrome.tabs.query({ active: true, currentWindow: true })
    );
    assert(
      activeClassroomTab?.url === "https://classroom.google.com/c/abc/a/def/details",
      `Minimal store permissions did not expose the active Classroom tab URL: ${JSON.stringify(activeClassroomTab)}`
    );

    await popupPage.waitForFunction(
      () =>
        [...document.querySelectorAll("button")].some(
          (button) => button.textContent?.includes("Export page") && !button.disabled
        ),
      undefined,
      { timeout: 20_000 }
    );
    await popupPage.evaluate(() => {
      const exportButton = [...document.querySelectorAll("button")].find((button) =>
        button.textContent?.includes("Export page")
      );
      if (!exportButton) {
        throw new Error("Could not find Export page button in popup.");
      }
      exportButton.click();
    });
    try {
      await popupPage.waitForFunction(
        () => document.body.innerText.includes("Saved browser-download archive files."),
        undefined,
        { timeout: 20_000 }
      );
    } catch (error) {
      const popupText = await popupPage.evaluate(() => document.body.innerText);
      throw new Error(`Popup did not show browser-download success text. Current popup text:\n${popupText}`);
    }
    const popupText = await popupPage.evaluate(() => document.body.innerText);
    assert(popupText.includes("Archive mode"), "Popup did not show archive mode label after export.");
    assert(popupText.includes("Browser downloads"), "Popup did not show browser-download mode after export.");
    assert(popupText.includes("No downloads queued"), "Popup should say no downloads were queued for Export page.");
    assert(!popupText.includes("0/0 browser downloads completed"), "Popup should not show a confusing 0/0 download summary.");
    assert(!popupText.includes("Native host unavailable"), "Popup should not present browser-download mode as a native-host failure.");

    const exportResponse = await popupPage.evaluate(
      async () =>
        await new Promise((resolve) => {
          chrome.runtime.sendMessage({ type: "classroom_ai:last_export" }, (response) => {
            if (chrome.runtime.lastError) {
              resolve({ ok: false, error: chrome.runtime.lastError.message });
              return;
            }
            resolve(response?.lastExport || { ok: false, error: "No last export was stored." });
          });
        })
    );

    assert(exportResponse?.fallbackResponse || exportResponse?.nativeResponse, `Export was not stored: ${JSON.stringify(exportResponse)}`);
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
      executablePath,
      manifest: {
        name: manifest.name,
        version: manifest.version,
        permissions: manifest.permissions,
        host_permissions: manifest.host_permissions,
      },
      fallbackRoot: exportResponse.fallbackResponse.root,
      fallbackFiles: expectedFiles,
      popupMode: "Browser downloads",
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

const timeout = setTimeout(() => {
  console.error(`CourseBinder fixture smoke timed out after ${SMOKE_TIMEOUT_MS} ms.`);
  process.exit(1);
}, SMOKE_TIMEOUT_MS);

main()
  .then(() => {
    clearTimeout(timeout);
  })
  .catch((error) => {
    clearTimeout(timeout);
    console.error(error instanceof Error ? error.stack || error.message : error);
    process.exitCode = 1;
  });
