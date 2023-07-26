import path from "path";
import { cliTypes } from "./type-helper";
import * as fileUtil from "./file-utility";
import { parseConfigFromScript, queryNodeMatchValues } from "./script-helper";
import { green, gray } from "./console-helper";

export async function init(projectRoot: string = ".", force: boolean = false) {
  const rootDir = path.resolve(projectRoot);
  const backupRootPath = fileUtil.getBackupPath(rootDir);
  green(`Project root path is: ${projectRoot}`);

  green("Getting deployment configuration...");
  const configSrc = fileUtil.getDeployConfigContent(rootDir);

  // check first for json config
  let deployConfig = fileUtil.getNewDeployConfigContent(rootDir);

  // fall back to js
  if (!deployConfig) deployConfig = JSON.stringify(parseConfigFromScript(configSrc), null, 2);

  if (!cliTypes.isDeployConfig(JSON.parse(deployConfig)))
    throw "Config does not exist in the root directory, or is not valid.";

  gray(`Found config deployConfig: ${deployConfig}`);

  let templates = await fileUtil.getTemplates();
  green(`Starting file copy.  Any existing/modified files will be backed up to: ${backupRootPath}`);

  for (const file of Object.values(templates)) {
    fileUtil.render(file, rootDir, backupRootPath, deployConfig);
  }

  green("Done!");
}
