import { glob } from "glob";
import { join as pathJoin, parse as parsePath } from "path";
import fs from "fs";
import mustache from "mustache";
import { white, gray } from "./console-helper";

const templateSuffix = ".mustache";
const deleteSuffix = ".delete";

async function getTemplates(basePath: string): Promise<string[]> {
  return await getFiles(pathJoin(basePath, "**/*.*"));
}

export async function renderTemplates(folder: string, destRootPath: string, backupRootPath: string, configData: any) {
  const basePath = pathJoin(__dirname, "../", "templates", folder);
  const files = await getTemplates(basePath);
  for (const file of Object.values(files)) {
    render(file, basePath, destRootPath, backupRootPath, configData);
  }
}

async function getFiles(path: string): Promise<string[]> {
  const normalizedPath = path.replace(/\\/g, "/");
  return glob(normalizedPath, { dot: true });
}

export function getDeployConfigContent(rootPath: string): string {
  return getFileContent(pathJoin(rootPath, "deploy.js"));
}

export function getViteConfigContent(rootPath: string): string {
  return getFileContent(pathJoin(rootPath, "vite.config.ts"));
}

export function getNewDeployConfigContent(rootPath: string): string {
  return getFileContent(pathJoin(rootPath, "deployConfig.json"));
}
function encodingFromExt(path: string): "binary" | "utf8" {
  return path.endsWith(".ttf") ? "binary" : "utf8";
}

function getFileContent(path: string, allowEmpty: boolean = true): string {
  if (!allowEmpty || fs.existsSync(path)) return fs.readFileSync(path, encodingFromExt(path));
  else return "";
}
function moveFile(currentPath: string, newPath: string) {
  fs.mkdirSync(parsePath(newPath).dir, { recursive: true });
  fs.renameSync(currentPath, newPath);
}

function writeFileContent(path: string, content: string) {
  const dir = parsePath(path).dir;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path, content, encodingFromExt(path));
}

function render(
  filePath: string,
  sourceRootPath: string,
  destRootPath: string,
  backupRootPath: string,
  configData: any,
) {
  let fileData = getFileContent(filePath, false);
  let deleteFile: boolean = false;
  let relativePath = filePath.replace(sourceRootPath, "");
  if (relativePath.endsWith(templateSuffix)) {
    relativePath = relativePath.replace(templateSuffix, "");
    fileData = mustache.render(fileData, {
      deployConfig: configData,
    });
  } else if (relativePath.endsWith(deleteSuffix)) {
    deleteFile = true;
    relativePath = relativePath.replace(deleteSuffix, "");
  }

  const newFilePath = pathJoin(destRootPath, relativePath);
  const backupFilePath = pathJoin(backupRootPath, relativePath);
  const dir = parsePath(newFilePath).dir;

  if (fs.existsSync(newFilePath)) {
    if (deleteFile) {
      moveFile(newFilePath, backupFilePath);
      white(`Backed up + Removed: ${relativePath}`);
    }
    if (sameFileContents(fileData, newFilePath)) {
      gray(`Skipped (current): ${newFilePath}`);
    } else {
      moveFile(newFilePath, backupFilePath);
      writeFileContent(newFilePath, fileData);
      white(`Backed up + Updated: ${relativePath}`);
    }
  } else {
    writeFileContent(newFilePath, fileData);
    white(`Created: ${newFilePath}`);
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

function sameFileContents(newContent: string, oldFilePath: string): Boolean {
  if (fs.existsSync(oldFilePath)) {
    let bufferNew = Buffer.from(newContent);
    let bufferOld = Buffer.from(getFileContent(oldFilePath, false));

    return Buffer.compare(bufferNew, bufferOld) == 0;
  }
  return false;
}
