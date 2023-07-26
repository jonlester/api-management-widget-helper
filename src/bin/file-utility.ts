import { glob } from "glob";
import { join as pathJoin, parse as parsePath } from "path";
import fs from "fs";
import mustache from "mustache";
import { white, gray } from "./console-helper";

const templateSuffix = ".mustache";

export async function getTemplates(includeReact: boolean = false): Promise<string[]> {
  const sharedFiles = await getFiles(pathJoin(__dirname, "../", "templates/common", "**/*.*"));
  const reactFiles = await getFiles(pathJoin(__dirname, "../", "templates/react", "**/*.*", "**", "**", "*.*"));
  return [...sharedFiles, ...(includeReact ? reactFiles : [])];
}

async function getFiles(path: string): Promise<string[]> {
  const normalizedPath = path.replace(/\\/g, "/");
  return glob(normalizedPath, { dot: true });
}

export function getDeployConfigContent(rootPath: string): string {
  return getFileContent(rootPath, "vite.config.ts");
}

export function getViteConfigContent(rootPath: string): string {
  return getFileContent(rootPath, "deploy.js");
}

export function getNewDeployConfigContent(rootPath: string): string {
  return getFileContent(rootPath, "deployConfig.json");
}

function getFileContent(rootPath: string, name: string): string {
  const path = pathJoin(rootPath, name);
  if (fs.existsSync(path)) return fs.readFileSync(path, "utf8");
  else return "";
}

export function render(file: string, destRootPath: string, backupRootPath: string, deployConfig: any) {
  const encoding = file.endsWith(".ttf") ? "binary" : "utf8";
  let fileData = fs.readFileSync(file, encoding);
  if (file.endsWith(templateSuffix)) {
    fileData = mustache.render(fileData, {
      deployConfig: deployConfig,
    });
  }

  let relativePath = file;
  if (__dirname.includes("\\")) {
    relativePath = relativePath.replace(/\//g, "\\");
  }
  relativePath = relativePath.replace(pathJoin(__dirname, "templates"), "").replace(templateSuffix, "");

  const newFilePath = pathJoin(destRootPath, relativePath);
  const backupFilePath = pathJoin(backupRootPath, relativePath);
  const dir = parsePath(newFilePath).dir;

  fs.mkdirSync(dir, { recursive: true });
  if (fs.existsSync(newFilePath)) {
    if (sameFileContents(fileData, newFilePath, encoding)) {
      gray(`Skipped: ${newFilePath}`);
    } else {
      fs.mkdirSync(parsePath(backupFilePath).dir, { recursive: true });
      fs.renameSync(newFilePath, backupFilePath);
      white(`Backed up: ${relativePath}`);
      fs.writeFileSync(newFilePath, fileData, { encoding });
      white(`File Updated: ${newFilePath}`);
    }
  } else {
    fs.writeFileSync(newFilePath, fileData, { encoding });
    white(`File Created: ${newFilePath}`);
  }
}

export function getBackupPath(root: string): string {
  const chars = "abcdefghijklmnopqrstuvwxyz";
  const charArray = () => {
    return Array.from({ length: 6 }, (v, k) => chars[Math.floor(Math.random() * chars.length)]);
  };

  let testPath = root;
  while (fs.existsSync(testPath)) {
    testPath = pathJoin(root, `backup-${charArray().join("")}`);
  }
  return testPath;
}

function sameFileContents(newContent: string, oldFilePath: string, encoding: "binary" | "utf8"): Boolean {
  if (fs.existsSync(oldFilePath)) {
    let bufferNew = Buffer.from(newContent);
    let bufferOld = Buffer.from(fs.readFileSync(oldFilePath, encoding));

    return Buffer.compare(bufferNew, bufferOld) == 0;
  }
  return false;
}
