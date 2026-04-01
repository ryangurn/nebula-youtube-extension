import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(currentDirectory, "..");
const safariExtensionDirectory = path.join(repositoryRoot, "dist", "nebula-youtube-extension-safari");
const safariProjectDirectory = path.join(repositoryRoot, "safari");
const safariXcodeProjectPath = path.join(
  safariProjectDirectory,
  "Nebula Match for YouTube",
  "Nebula Match for YouTube.xcodeproj"
);
const appName = "Nebula Match for YouTube";
const bundleIdentifier = "com.ryangurnick.nebulamatch";
const shouldForceRegenerate = process.argv.includes("--force");

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: repositoryRoot,
    stdio: "inherit"
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${command} exited with status ${result.status}`);
  }
}

run("node", [path.join("scripts", "build.mjs")]);

if (!existsSync(safariExtensionDirectory)) {
  throw new Error(`Expected Safari extension build output at ${safariExtensionDirectory}`);
}

if (existsSync(safariXcodeProjectPath) && !shouldForceRegenerate) {
  console.log("Safari Xcode project already exists.");
  console.log("Skipping regeneration so your manual Xcode signing and identifier changes are preserved.");
  console.log("Use `npm run setup:safari -- --force` only when you intentionally want to recreate the project.");
  process.exit(0);
}

run("xcrun", [
  "safari-web-extension-converter",
  safariExtensionDirectory,
  "--project-location",
  safariProjectDirectory,
  "--app-name",
  appName,
  "--bundle-identifier",
  bundleIdentifier,
  "--swift",
  "--no-open",
  "--no-prompt",
  "--force"
]);
