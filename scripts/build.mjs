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
const safariExtensionDirectory = path.join(distDirectory, "nebula-youtube-extension-safari");
const zipFilePath = path.join(distDirectory, "nebula-youtube-extension.zip");

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

function createSafariBackgroundBundle() {
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
    'importScripts("./lib/runtime.js");',
    "",
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

mkdirSync(distDirectory, { recursive: true });
removeIfExists(zipFilePath);
buildChromeExtension();
buildSafariExtension();
createZip();

console.log("Built Chrome extension files:");
for (const file of listFilesRecursively(chromeExtensionDirectory)) {
  console.log(`- ${file}`);
}
console.log("Built Safari extension files:");
for (const file of listFilesRecursively(safariExtensionDirectory)) {
  console.log(`- ${file}`);
}
console.log(`Created zip artifact: ${path.relative(repositoryRoot, zipFilePath)}`);
