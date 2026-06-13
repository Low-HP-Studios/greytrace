import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const electronDir = path.dirname(require.resolve("electron/package.json"));
const electronRequire = createRequire(path.join(electronDir, "package.json"));
const { downloadArtifact } = electronRequire("@electron/get");
const { version } = electronRequire(path.join(electronDir, "package.json"));

const platformPath =
  process.platform === "darwin"
    ? "Electron.app/Contents/MacOS/Electron"
    : process.platform === "win32"
      ? "electron.exe"
      : "electron";

const distDir = path.join(electronDir, "dist");
const binaryPath = path.join(distDir, platformPath);
const pathFile = path.join(electronDir, "path.txt");

function isComplete() {
  if (!fs.existsSync(binaryPath)) return false;
  if (process.platform === "darwin") {
    const framework = path.join(
      distDir,
      "Electron.app/Contents/Frameworks/Electron Framework.framework/Electron Framework",
    );
    return fs.existsSync(framework);
  }
  return true;
}

if (isComplete() && fs.existsSync(pathFile)) {
  process.exit(0);
}

if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir, { recursive: true });

const zipPath = await downloadArtifact({
  version,
  artifactName: "electron",
  platform: process.platform,
  arch: process.arch,
  checksums: electronRequire(path.join(electronDir, "checksums.json")),
});

if (process.platform === "win32") {
  const extract = electronRequire("extract-zip");
  await extract(zipPath, { dir: distDir });
} else {
  const result = spawnSync("unzip", ["-q", zipPath, "-d", distDir], {
    stdio: "inherit",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

await fs.promises.writeFile(pathFile, platformPath);
