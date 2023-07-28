#!/usr/bin/env node
'use strict';

const commander = require('commander');
const path = require('path');
const glob = require('glob');
const fs = require('fs');
const mustache = require('mustache');
const chalk = require('chalk');
const ts = require('typescript');

var cliTypes;
(function (cliTypes) {
    function isDeployConfig(obj) {
        const testObj = obj;
        return !(testObj.serviceInformation == undefined ||
            testObj.name == undefined ||
            testObj.fallbackConfigPath == undefined);
    }
    cliTypes.isDeployConfig = isDeployConfig;
})(cliTypes || (cliTypes = {}));

const white = (msg) => console.log(chalk.white(msg));
const green = (msg) => console.log(chalk.green(msg));
const gray = (msg) => console.log(chalk.gray(msg));

const templateSuffix = ".mustache";
const deleteSuffix = ".delete";
async function getTemplates(basePath) {
    return await getFiles(path.join(basePath, "**/*.*"));
}
async function renderTemplates(folder, destRootPath, backupRootPath, configData) {
    const basePath = path.join(__dirname, "../", "templates", folder);
    const files = await getTemplates(basePath);
    for (const file of Object.values(files)) {
        render(file, basePath, destRootPath, backupRootPath, configData);
    }
}
async function getFiles(path) {
    const normalizedPath = path.replace(/\\/g, "/");
    return glob.glob(normalizedPath, { dot: true });
}
function getDeployConfigContent(rootPath) {
    return getFileContent(path.join(rootPath, "deploy.js"));
}
function getNewDeployConfigContent(rootPath) {
    return getFileContent(path.join(rootPath, "deployConfig.json"));
}
function encodingFromExt(path) {
    return path.endsWith(".ttf") ? "binary" : "utf8";
}
function getFileContent(path, allowEmpty = true) {
    if (!allowEmpty || fs.existsSync(path))
        return fs.readFileSync(path, encodingFromExt(path));
    else
        return "";
}
function moveFile(currentPath, newPath) {
    fs.mkdirSync(path.parse(newPath).dir, { recursive: true });
    fs.renameSync(currentPath, newPath);
}
function writeFileContent(path$1, content) {
    const dir = path.parse(path$1).dir;
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path$1, content, encodingFromExt(path$1));
}
function render(filePath, sourceRootPath, destRootPath, backupRootPath, configData) {
    let fileData = getFileContent(filePath, false);
    let deleteFile = false;
    let relativePath = filePath.replace(sourceRootPath, "");
    if (relativePath.endsWith(templateSuffix)) {
        relativePath = relativePath.replace(templateSuffix, "");
        fileData = mustache.render(fileData, {
            deployConfig: configData,
        });
    }
    else if (relativePath.endsWith(deleteSuffix)) {
        deleteFile = true;
        relativePath = relativePath.replace(deleteSuffix, "");
    }
    const newFilePath = path.join(destRootPath, relativePath);
    const backupFilePath = path.join(backupRootPath, relativePath);
    path.parse(newFilePath).dir;
    if (fs.existsSync(newFilePath)) {
        if (deleteFile) {
            moveFile(newFilePath, backupFilePath);
            white(`Backed up + Removed: ${relativePath}`);
        }
        if (sameFileContents(fileData, newFilePath)) {
            gray(`Skipped (current): ${newFilePath}`);
        }
        else {
            moveFile(newFilePath, backupFilePath);
            writeFileContent(newFilePath, fileData);
            white(`Backed up + Updated: ${relativePath}`);
        }
    }
    else {
        writeFileContent(newFilePath, fileData);
        white(`Created: ${newFilePath}`);
    }
}
function getBackupPath(root) {
    const chars = "abcdefghijklmnopqrstuvwxyz";
    const charArray = () => {
        return Array.from({ length: 6 }, (v, k) => chars[Math.floor(Math.random() * chars.length)]);
    };
    let testPath = root;
    while (fs.existsSync(testPath)) {
        testPath = path.join(root, `backup-${charArray().join("")}`);
    }
    return testPath;
}
function sameFileContents(newContent, oldFilePath) {
    if (fs.existsSync(oldFilePath)) {
        let bufferNew = Buffer.from(newContent);
        let bufferOld = Buffer.from(getFileContent(oldFilePath, false));
        return Buffer.compare(bufferNew, bufferOld) == 0;
    }
    return false;
}

class JsonProperty {
    key;
    value;
    constructor(key, value) {
        this.key = key;
        this.value = value;
    }
    setValue(value) {
        //inner value is a prop with no key
        if (isJsonProperty(value) && !value.key)
            value = value.getValue();
        if (value !== undefined) {
            if (this.value !== undefined) {
                if (Array.isArray(this.value))
                    this.value.push(value);
                else
                    this.value = [this.value, value];
            }
            else
                this.value = value;
        }
    }
    getValue() {
        return this.value;
    }
}
function isJsonKeyType(node) {
    return ts.isIdentifier(node) || ts.isStringLiteral(node);
}
function isTypeWithNameAndInitializer(node) {
    return ts.isVariableDeclaration(node) || ts.isPropertyAssignment(node);
}
function isJsonProperty(prop) {
    return prop instanceof JsonProperty;
}
function getSourceFile(sourceString) {
    return ts.createSourceFile("", sourceString, ts.ScriptTarget.ES3, undefined, ts.ScriptKind.JS);
}
function rollupNodes(prop) {
    let obj = {};
    if (prop && prop.key) {
        const value = prop.getValue();
        if (isJsonProperty(value))
            obj[prop.key] = rollupNodes(value);
        else if (Array.isArray(value)) {
            for (let element of value) {
                if (isJsonProperty(element) && element.key)
                    obj[prop.key] = { ...obj[prop.key], ...rollupNodes(element) };
                else
                    (obj[prop.key] ||= []).push(element);
            }
        }
        else
            obj[prop.key] = value;
    }
    return obj;
}
function isValueKind(node) {
    if (!node)
        return false;
    switch (node.kind) {
        case ts.SyntaxKind.TrueKeyword:
        case ts.SyntaxKind.FalseKeyword:
        case ts.SyntaxKind.NullKeyword:
        case ts.SyntaxKind.NumericLiteral:
        case ts.SyntaxKind.StringLiteral:
        case ts.SyntaxKind.Identifier:
        case ts.SyntaxKind.ArrayLiteralExpression:
            return true;
        // falls through
        default:
            return false;
    }
}
function getNodeValue(node) {
    if (!node)
        return false;
    switch (node.kind) {
        case ts.SyntaxKind.TrueKeyword:
            return true;
        case ts.SyntaxKind.FalseKeyword:
            return false;
        case ts.SyntaxKind.NullKeyword:
            return null;
        case ts.SyntaxKind.NumericLiteral:
        case ts.SyntaxKind.StringLiteral:
        case ts.SyntaxKind.Identifier:
        case ts.SyntaxKind.ArrayLiteralExpression: {
            if (ts.isNumericLiteral(node))
                return +node.text;
            else if (ts.isStringLiteral(node))
                return node.text;
            else if (ts.isIdentifier(node))
                return node.text;
            else if (ts.isArrayLiteralExpression(node)) {
                let arrayValues = [];
                if (node.elements && node.elements.length > 0) {
                    node.elements.forEach((element) => {
                        arrayValues.push(getNodeValue(element));
                    });
                }
                return arrayValues;
            }
        }
        default:
            return undefined;
    }
}
function expandNode(node) {
    let thisProp;
    try {
        if (isTypeWithNameAndInitializer(node) && isJsonKeyType(node.name)) {
            thisProp = new JsonProperty(node.name.text);
            if (node.initializer) {
                if (isValueKind(node.initializer))
                    thisProp.setValue(getNodeValue(node.initializer));
                else
                    thisProp.setValue(expandNode(node.initializer));
            }
        }
        else {
            thisProp = new JsonProperty();
            ts.forEachChild(node, (childNode) => {
                thisProp.setValue(expandNode(childNode));
            });
        }
        return thisProp;
    }
    catch (error) {
        console.log(error);
    }
    return null;
}
function parseConfigFromScript(sourceString) {
    const sourceFile = getSourceFile(sourceString);
    const root = new JsonProperty("__root");
    root.setValue(expandNode(sourceFile));
    return rollupNodes(root).__root;
}

async function init(projectRoot = "./", force = false) {
    const rootDir = path.resolve(projectRoot);
    const backupRootPath = getBackupPath(rootDir);
    green(`Project root path is: ${rootDir}`);
    green("Getting deployment configuration...");
    // check first for json config, meaning init has already been run once
    let deployConfig = getNewDeployConfigContent(rootDir);
    // fall back to js
    if (!deployConfig) {
        const configSrc = getDeployConfigContent(rootDir);
        deployConfig = JSON.stringify(parseConfigFromScript(configSrc), null, 2);
    }
    if (!cliTypes.isDeployConfig(JSON.parse(deployConfig)))
        throw `Config does not exist at ${rootDir}, or is not valid.`;
    gray(`Found config deployConfig: ${deployConfig}`);
    green(`Starting file copy.  Any existing/modified files will be backed up to: ${backupRootPath}`);
    await renderTemplates("common", rootDir, backupRootPath, deployConfig);
    green("Done!");
}

async function main() {
    const program = new commander.Command();
    program
        .name("widget-helper")
        .usage("[command] [options]")
        .addHelpText("after", "example: foo")
        .command("init")
        .description("Initialize the current project with the widget helper features")
        .option("-p, --projectRoot <path>", "relative path of the project root from the current working directory", "./")
        .option("-s, --silent", "initialize without prompts, allowing files to be overwritten or modified without confirmation", false)
        .action(async (options) => {
        await init(options.projectRoot, options.silent);
    });
    program.parseAsync(process.argv).catch((reason) => program.error(reason));
}
main();
