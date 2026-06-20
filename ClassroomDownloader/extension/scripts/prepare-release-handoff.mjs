import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const extensionRoot = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(extensionRoot, "..");
const packageJson = JSON.parse(fs.readFileSync(path.join(extensionRoot, "package.json"), "utf8"));
const zipFileName = `${packageJson.name}-${packageJson.version}-chrome.zip`;
const zipPath = path.join(extensionRoot, ".output", zipFileName);
const releaseDir = path.join(repoRoot, "release-artifacts", `coursebinder-${packageJson.version}`);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function readManifestFromZip(filePath) {
  const result = spawnSync("unzip", ["-p", filePath, "manifest.json"], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
  });
  if (result.error) {
    throw result.error;
  }
  assert(result.status === 0, `Could not read manifest.json from ${filePath}: ${result.stderr}`);
  return JSON.parse(result.stdout);
}

function verifyManifest(manifest) {
  const forbiddenPermissions = ["scripting", "activeTab", "nativeMessaging", "identity", "cookies"];
  const forbiddenHosts = ["drive.google.com", "docs.google.com", "googleapis.com"];
  const expectedPermissions = ["downloads", "storage"];
  const expectedHosts = ["https://classroom.google.com/*"];
  const permissions = manifest.permissions || [];
  const hostPermissions = manifest.host_permissions || [];
  const forbiddenPresent = forbiddenPermissions.filter((permission) => permissions.includes(permission));
  const forbiddenHostPresent = hostPermissions.filter((host) => forbiddenHosts.some((forbidden) => host.includes(forbidden)));

  assert(manifest.manifest_version === 3, `Expected Manifest V3, got ${manifest.manifest_version}.`);
  assert(manifest.name === "CourseBinder – AI-Ready Google Classroom Exporter", `Unexpected manifest name: ${manifest.name}`);
  assert(manifest.version === packageJson.version, `Manifest version ${manifest.version} does not match package version ${packageJson.version}.`);
  assert(JSON.stringify(permissions) === JSON.stringify(expectedPermissions), `Unexpected permissions: ${JSON.stringify(permissions)}.`);
  assert(JSON.stringify(hostPermissions) === JSON.stringify(expectedHosts), `Unexpected host permissions: ${JSON.stringify(hostPermissions)}.`);
  assert(forbiddenPresent.length === 0, `Forbidden permissions present: ${forbiddenPresent.join(", ")}.`);
  assert(forbiddenHostPresent.length === 0, `Forbidden host permissions present: ${forbiddenHostPresent.join(", ")}.`);

  for (const size of ["16", "32", "48", "128"]) {
    assert(manifest.icons?.[size], `Missing manifest icon ${size}.`);
    assert(manifest.action?.default_icon?.[size], `Missing action.default_icon ${size}.`);
  }
}

function writeText(fileName, text) {
  fs.writeFileSync(path.join(releaseDir, fileName), `${text.trimEnd()}\n`);
}

assert(fs.existsSync(zipPath), `Missing expected zip: ${zipPath}. Run npm run zip first.`);

const manifest = readManifestFromZip(zipPath);
verifyManifest(manifest);
const digest = sha256(zipPath);

fs.rmSync(releaseDir, { recursive: true, force: true });
fs.mkdirSync(releaseDir, { recursive: true });
fs.copyFileSync(zipPath, path.join(releaseDir, zipFileName));

writeText("SHA256.txt", `${digest}  ${zipFileName}`);
writeText("manifest-summary.json", JSON.stringify({
  manifest_version: manifest.manifest_version,
  name: manifest.name,
  version: manifest.version,
  permissions: manifest.permissions,
  host_permissions: manifest.host_permissions,
  icons: Object.keys(manifest.icons || {}),
  action_default_icon: Object.keys(manifest.action?.default_icon || {}),
  forbidden_permissions: [],
  forbidden_hosts: []
}, null, 2));
writeText("REVIEWER_NOTE.txt", `
This resubmission fixes the prior permission rejection. The previous draft requested the scripting permission, but the current version ${packageJson.version} removes scripting from the default Chrome Web Store manifest.

The extension now requests only downloads and storage, plus host access limited to https://classroom.google.com/*. It does not request scripting, activeTab, nativeMessaging, identity, cookies, Drive/Docs host access, or googleapis.com access.

CourseBinder exports only visible Google Classroom page content after the user clicks an export action. It does not use Google APIs, OAuth, cookies, token extraction, telemetry, ads, or a hosted backend.
`);
writeText("UPLOAD_THIS.md", `
# Upload This Package

Upload this zip in the Chrome Web Store Developer Dashboard:

\`\`\`txt
${path.join(releaseDir, zipFileName)}
\`\`\`

SHA256:

\`\`\`txt
${digest}
\`\`\`

Manifest summary:

- Name: ${manifest.name}
- Version: ${manifest.version}
- Permissions: ${(manifest.permissions || []).join(", ")}
- Host permissions: ${(manifest.host_permissions || []).join(", ")}
- Forbidden permissions present: none
- Forbidden hosts present: none

Use \`REVIEWER_NOTE.txt\` as the resubmission note for the prior \`scripting\` rejection.
`);

console.log(JSON.stringify({
  ok: true,
  releaseDir,
  zipPath: path.join(releaseDir, zipFileName),
  sha256: digest,
  manifest: {
    name: manifest.name,
    version: manifest.version,
    permissions: manifest.permissions,
    host_permissions: manifest.host_permissions
  }
}, null, 2));
