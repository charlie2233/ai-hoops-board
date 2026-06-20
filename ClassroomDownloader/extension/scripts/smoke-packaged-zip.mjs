import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const extensionRoot = path.resolve(scriptDir, "..");
const outputDir = path.join(extensionRoot, ".output");
const packageJsonPath = path.join(extensionRoot, "package.json");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function expectedChromeZip() {
  assert(fs.existsSync(outputDir), "Missing .output directory. Run `npm run zip` before `npm run smoke:zip`.");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  const zipPath = path.join(outputDir, `${packageJson.name}-${packageJson.version}-chrome.zip`);
  assert(
    fs.existsSync(zipPath),
    `Missing expected Chrome extension zip ${path.basename(zipPath)}. Run \`npm run zip\` before \`npm run smoke:zip\`.`
  );
  return zipPath;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    ...options,
    env: {
      ...process.env,
      ...options.env,
    },
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} exited with status ${result.status}`);
  }
}

const zipPath = expectedChromeZip();
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "coursebinder-zip-smoke-"));
const extractedPath = path.join(tempDir, "extension");
fs.mkdirSync(extractedPath);

console.error(`CourseBinder packaged smoke using zip: ${zipPath}`);

try {
  run("unzip", ["-q", zipPath, "-d", extractedPath]);
  assert(fs.existsSync(path.join(extractedPath, "manifest.json")), "Extracted zip is missing manifest.json at package root.");
  run(process.execPath, [path.join(scriptDir, "smoke-fixture.mjs")], {
    env: {
      COURSEBINDER_EXTENSION_PATH: extractedPath,
    },
  });
} finally {
  if (process.env.COURSEBINDER_KEEP_SMOKE_PROFILE !== "1") {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}
