import path from "path";
import { cliTypes } from "./type-helper";
import * as fileUtil from "./file-utility";
import { parseConfigFromScript, queryNodeMatchValues } from "./script-helper";
import { green, gray } from "./console-helper";

export async function init(projectRoot: string = "./", force: boolean = false) {
  const rootDir = path.resolve(projectRoot);
  const backupRootPath = fileUtil.getBackupPath(rootDir);
  green(`Project root path is: ${rootDir}`);

  green("Getting deployment configuration...");

  // check first for json config, meaning init has already been run once
  let deployConfig = fileUtil.getNewDeployConfigContent(rootDir);

  // fall back to js
  if (!deployConfig) {
    const configSrc = fileUtil.getDeployConfigContent(rootDir);
    deployConfig = JSON.stringify(parseConfigFromScript(configSrc), null, 2);
  }

  if (!cliTypes.isDeployConfig(JSON.parse(deployConfig))) throw `Config does not exist at ${rootDir}, or is not valid.`;

  gray(`Found config deployConfig: ${deployConfig}`);

  green(`Starting file copy.  Any existing/modified files will be backed up to: ${backupRootPath}`);
  let templates = await fileUtil.renderTemplates("common", rootDir, backupRootPath, deployConfig);

  green("Done!");
}
