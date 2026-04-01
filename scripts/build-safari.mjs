import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(currentDirectory, "..");
const safariProjectPath = path.join(
  repositoryRoot,
  "safari",
  "Nebula Match for YouTube",
  "Nebula Match for YouTube.xcodeproj"
);
const derivedDataPath = path.join(repositoryRoot, "build", "safari");
const appName = "Nebula Match for YouTube.app";
const builtAppPath = path.join(
  derivedDataPath,
  "Build",
  "Products",
  "Debug",
  appName
);

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: repositoryRoot,
    encoding: "utf8"
  });

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }

  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;

    if (command === "xcodebuild" && output.includes('No signing certificate "Mac Development" found')) {
      throw new Error(
        [
          "xcodebuild could not find a usable Mac Development certificate for the signed Safari project.",
          "This script does not modify your Xcode project.",
          "Open the existing Safari project in Xcode, confirm the macOS app and extension targets both use your team,",
          "and let Xcode finish creating/downloading the signing certificate before rerunning `npm run build:safari`."
        ].join(" ")
      );
    }

    throw new Error(`${command} exited with status ${result.status}`);
  }
}

if (!existsSync(safariProjectPath)) {
  throw new Error(
    [
      "Safari Xcode project not found.",
      "Run `npm run setup:safari` once, open the generated project in Xcode,",
      "and finish signing before using `npm run build:safari`."
    ].join(" ")
  );
}

mkdirSync(path.dirname(derivedDataPath), { recursive: true });

run("node", [path.join("scripts", "build.mjs")]);
run("xcodebuild", [
  "-project",
  safariProjectPath,
  "-scheme",
  "Nebula Match for YouTube (macOS)",
  "-configuration",
  "Debug",
  "-derivedDataPath",
  derivedDataPath,
  "-destination",
  "platform=macOS",
  "build"
]);

console.log("");
console.log("Safari build complete.");
console.log(`App bundle: ${builtAppPath}`);
console.log("Next steps:");
console.log("1. Open the built app in Finder or from Xcode's Products group.");
console.log("2. Launch it once if Xcode did not already do that.");
console.log("3. In Safari, go to Settings > Extensions and enable Nebula Match for YouTube.");
