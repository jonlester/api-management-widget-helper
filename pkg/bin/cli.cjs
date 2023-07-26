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
async function getTemplates(includeReact = false) {
    const sharedFiles = await getFiles(path.join(__dirname, "../", "templates/common", "**/*.*"));
    const reactFiles = await getFiles(path.join(__dirname, "../", "templates/react", "**/*.*", "**", "**", "*.*"));
    return [...sharedFiles, ...(includeReact ? reactFiles : [])];
}
async function getFiles(path) {
    const normalizedPath = path.replace(/\\/g, "/");
    return glob.glob(normalizedPath, { dot: true });
}
function getDeployConfigContent(rootPath) {
    return getFileContent(rootPath, "vite.config.ts");
}
function getNewDeployConfigContent(rootPath) {
    return getFileContent(rootPath, "deployConfig.json");
}
function getFileContent(rootPath, name) {
    const path$1 = path.join(rootPath, name);
    if (fs.existsSync(path$1))
        return fs.readFileSync(path$1, "utf8");
    else
        return "";
}
function render(file, destRootPath, backupRootPath, deployConfig) {
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
    relativePath = relativePath.replace(path.join(__dirname, "templates"), "").replace(templateSuffix, "");
    const newFilePath = path.join(destRootPath, relativePath);
    const backupFilePath = path.join(backupRootPath, relativePath);
    const dir = path.parse(newFilePath).dir;
    fs.mkdirSync(dir, { recursive: true });
    if (fs.existsSync(newFilePath)) {
        if (sameFileContents(fileData, newFilePath, encoding)) {
            gray(`Skipped: ${newFilePath}`);
        }
        else {
            fs.mkdirSync(path.parse(backupFilePath).dir, { recursive: true });
            fs.renameSync(newFilePath, backupFilePath);
            white(`Backed up: ${relativePath}`);
            fs.writeFileSync(newFilePath, fileData, { encoding });
            white(`File Updated: ${newFilePath}`);
        }
    }
    else {
        fs.writeFileSync(newFilePath, fileData, { encoding });
        white(`File Created: ${newFilePath}`);
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
function sameFileContents(newContent, oldFilePath, encoding) {
    if (fs.existsSync(oldFilePath)) {
        let bufferNew = Buffer.from(newContent);
        let bufferOld = Buffer.from(fs.readFileSync(oldFilePath, encoding));
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

async function init(projectRoot = ".", force = false) {
    const rootDir = path.resolve(projectRoot);
    const backupRootPath = getBackupPath(rootDir);
    green(`Project root path is: ${projectRoot}`);
    green("Getting deployment configuration...");
    const configSrc = getDeployConfigContent(rootDir);
    // check first for json config
    let deployConfig = getNewDeployConfigContent(rootDir);
    // fall back to js
    if (!deployConfig)
        deployConfig = JSON.stringify(parseConfigFromScript(configSrc), null, 2);
    if (!cliTypes.isDeployConfig(JSON.parse(deployConfig)))
        throw "Config does not exist in the root directory, or is not valid.";
    gray(`Found config deployConfig: ${deployConfig}`);
    let templates = await getTemplates();
    green(`Starting file copy.  Any existing/modified files will be backed up to: ${backupRootPath}`);
    for (const file of Object.values(templates)) {
        render(file, rootDir, backupRootPath, deployConfig);
    }
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
        .option("-p, --projectRoot <path>", "relative path of the project root from the current working directory", ".")
        .option("-s, --silent", "initialize without prompts, allowing files to be overwritten or modified without confirmation", false)
        .action(async (options) => {
        await init(options.projectRoot, options.silent);
    });
    await program.parseAsync(process.argv);
}
main();
