import path from 'path';
import { getTemplates, getDeployConfigContent, render, getBackupPath } from './file-utility'
import {parseConfigFromScript} from './script-helper'
import { green, gray} from './console-helper'


export async function init(projectRoot: string = '.', force: boolean = false)
{
    const rootDir = path.resolve(projectRoot)
    green(`Project root path is: ${projectRoot}`)

    green('Getting deployment configuration...')
    const configSrc = getDeployConfigContent(rootDir)

    const deployConfig = JSON.stringify(parseConfigFromScript(configSrc), null, 2);
    gray(`deployConfig: ${deployConfig}`)

    let templates = await getTemplates()

    const backupRootPath = getBackupPath(rootDir);
    green(`Copying files.  Any existing/modified files will be backed up to: ${backupRootPath}`)

    for (const file of Object.values(templates)) {
        render(file, rootDir, backupRootPath, deployConfig);
    }
    
    green('Done!')
      
}
