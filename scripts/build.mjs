import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(currentDirectory, "..");
const sourceDirectory = path.join(repositoryRoot, "src", "extension");
const distDirectory = path.join(repositoryRoot, "dist");
const extensionDirectory = path.join(distDirectory, "nebula-youtube-extension");
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

function createZip() {
  const result = spawnSync(
    "zip",
    ["-qr", zipFilePath, "nebula-youtube-extension"],
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
ensureCleanDirectory(extensionDirectory);
removeIfExists(zipFilePath);

cpSync(sourceDirectory, extensionDirectory, { recursive: true });
createZip();

console.log("Built extension files:");
for (const file of listFilesRecursively(extensionDirectory)) {
  console.log(`- ${file}`);
}
console.log(`Created zip artifact: ${path.relative(repositoryRoot, zipFilePath)}`);
