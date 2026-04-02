import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(currentDirectory, "..");
const sourceDirectory = path.join(repositoryRoot, "src", "extension");
const distDirectory = path.join(repositoryRoot, "dist");
const chromeExtensionDirectory = path.join(distDirectory, "nebula-youtube-extension");
const firefoxExtensionDirectory = path.join(distDirectory, "nebula-youtube-extension-firefox");
const safariExtensionDirectory = path.join(distDirectory, "nebula-youtube-extension-safari");
const zipFilePath = path.join(distDirectory, "nebula-youtube-extension.zip");
const firefoxZipFilePath = path.join(distDirectory, "nebula-youtube-extension-firefox.zip");
const buildFirefoxOnly = process.argv.includes("--firefox-only");

function ensureCleanDirectory(directory) {
  rmSync(directory, { recursive: true, force: true });
  mkdirSync(directory, { recursive: true });
}

function removeIfExists(targetPath) {
  rmSync(targetPath, { recursive: true, force: true });
}

function listFilesRecursively(directory, parentPrefix = "") {
  const entries = readdirSync(directory).sort((left, right) => left.localeCompare(right));
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry);
    const relativePath = path.join(parentPrefix, entry);
    const stats = statSync(absolutePath);

    if (stats.isDirectory()) {
      files.push(...listFilesRecursively(absolutePath, relativePath));
    } else {
      files.push(relativePath);
    }
  }

  return files;
}

function readSourceFile(...relativeSegments) {
  return readFileSync(path.join(sourceDirectory, ...relativeSegments), "utf8");
}

function shouldCopyExtensionPath(sourcePath) {
  return path.basename(sourcePath) !== ".DS_Store";
}

function createBundledBackgroundScript() {
  const runtimeSource = readSourceFile("lib", "runtime.js");
  const textSource = readSourceFile("lib", "text.js")
    .replace(/export /g, "");
  const matchingSource = readSourceFile("lib", "matching.js")
    .replace(/import\s+\{[\s\S]*?\}\s+from\s+"\.\/text\.js";\n\n/, "")
    .replace(/export /g, "");
  const nebulaClientSource = readSourceFile("lib", "nebula-client.js")
    .replace(/import\s+\{[\s\S]*?\}\s+from\s+"\.\/matching\.js";\n\n/, "")
    .replace(/export /g, "");
  const backgroundSource = readSourceFile("background.js")
    .replace('import "./lib/runtime.js";\n', "")
    .replace('import { NebulaClient } from "./lib/nebula-client.js";\n\n', "");

  return [
    runtimeSource.trim(),
    textSource.trim(),
    "",
    matchingSource.trim(),
    "",
    nebulaClientSource.trim(),
    "",
    backgroundSource.trim(),
    ""
  ].join("\n");
}

function createSafariBackgroundBundle() {
  const bundledBackground = createBundledBackgroundScript();

  return bundledBackground.replace(
    readSourceFile("lib", "runtime.js").trim(),
    'importScripts("./lib/runtime.js");'
  );
}

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function buildChromeExtension() {
  ensureCleanDirectory(chromeExtensionDirectory);
  cpSync(sourceDirectory, chromeExtensionDirectory, {
    recursive: true,
    filter: shouldCopyExtensionPath
  });
}

function buildFirefoxExtension() {
  ensureCleanDirectory(firefoxExtensionDirectory);
  cpSync(sourceDirectory, firefoxExtensionDirectory, {
    recursive: true,
    filter: shouldCopyExtensionPath
  });

  const manifestPath = path.join(firefoxExtensionDirectory, "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

  manifest.background = {
    scripts: ["background.js"]
  };

  writeJson(manifestPath, manifest);
  writeFileSync(
    path.join(firefoxExtensionDirectory, "background.js"),
    createBundledBackgroundScript()
  );
}

function buildSafariExtension() {
  ensureCleanDirectory(safariExtensionDirectory);
  cpSync(sourceDirectory, safariExtensionDirectory, {
    recursive: true,
    filter: shouldCopyExtensionPath
  });

  const manifestPath = path.join(safariExtensionDirectory, "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

  if (manifest.background?.type) {
    delete manifest.background.type;
  }

  writeJson(manifestPath, manifest);
  writeFileSync(
    path.join(safariExtensionDirectory, "background.js"),
    createSafariBackgroundBundle()
  );
}

function createZip() {
  const result = spawnSync(
    "zip",
    ["-qr", zipFilePath, path.basename(chromeExtensionDirectory)],
    {
      cwd: distDirectory,
      stdio: "inherit"
    }
  );

  if (result.status !== 0) {
    throw new Error(`zip command failed with status ${result.status}`);
  }
}

function createFirefoxZip() {
  const result = spawnSync(
    "zip",
    ["-qr", firefoxZipFilePath, path.basename(firefoxExtensionDirectory)],
    {
      cwd: distDirectory,
      stdio: "inherit"
    }
  );

  if (result.status !== 0) {
    throw new Error(`zip command failed with status ${result.status}`);
  }
}

mkdirSync(distDirectory, { recursive: true });

if (buildFirefoxOnly) {
  removeIfExists(firefoxZipFilePath);
  buildFirefoxExtension();
  createFirefoxZip();

  console.log("Built Firefox extension files:");
  for (const file of listFilesRecursively(firefoxExtensionDirectory)) {
    console.log(`- ${file}`);
  }
  console.log(`Created Firefox zip artifact: ${path.relative(repositoryRoot, firefoxZipFilePath)}`);
} else {
  removeIfExists(zipFilePath);
  removeIfExists(firefoxZipFilePath);
  buildChromeExtension();
  buildFirefoxExtension();
  buildSafariExtension();
  createZip();
  createFirefoxZip();

  console.log("Built Chrome extension files:");
  for (const file of listFilesRecursively(chromeExtensionDirectory)) {
    console.log(`- ${file}`);
  }
  console.log("Built Firefox extension files:");
  for (const file of listFilesRecursively(firefoxExtensionDirectory)) {
    console.log(`- ${file}`);
  }
  console.log("Built Safari extension files:");
  for (const file of listFilesRecursively(safariExtensionDirectory)) {
    console.log(`- ${file}`);
  }
  console.log(`Created zip artifact: ${path.relative(repositoryRoot, zipFilePath)}`);
  console.log(`Created Firefox zip artifact: ${path.relative(repositoryRoot, firefoxZipFilePath)}`);
}
