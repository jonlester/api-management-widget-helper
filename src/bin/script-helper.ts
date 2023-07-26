import ts from "typescript";

class JsonProperty {
  readonly key?: string;
  private value?: any;

  constructor(key?: string, value?: any) {
    this.key = key;
    this.value = value;
  }

  setValue(value: any): void {
    //inner value is a prop with no key
    if (isJsonProperty(value) && !value.key) value = value.getValue();

    if (value !== undefined) {
      if (this.value !== undefined) {
        if (Array.isArray(this.value)) this.value.push(value);
        else this.value = [this.value, value];
      } else this.value = value;
    }
  }
  getValue(): any {
    return this.value;
  }
}

function isJsonKeyType(node: ts.Node): node is ts.Identifier | ts.StringLiteral {
  return ts.isIdentifier(node) || ts.isStringLiteral(node);
}

function isTypeWithNameAndInitializer(node: ts.Node): node is ts.VariableDeclaration | ts.PropertyAssignment {
  return ts.isVariableDeclaration(node) || ts.isPropertyAssignment(node);
}

function isExpressionWithIdentifier(node: ts.Node): node is ts.CallExpression {
  return ts.isCallExpression(node) && ts.isIdentifier(node.expression);
}

function isJsonProperty(prop: any): prop is JsonProperty {
  return prop instanceof JsonProperty;
}

function getSourceFile(sourceString: string): ts.SourceFile {
  return ts.createSourceFile("", sourceString, ts.ScriptTarget.ES3, undefined, ts.ScriptKind.JS);
}
function rollupNodes(prop: JsonProperty): any {
  let obj: any = {};

  if (prop && prop.key) {
    const value = prop.getValue();
    if (isJsonProperty(value)) obj[prop.key] = rollupNodes(value);
    else if (Array.isArray(value)) {
      for (let element of value) {
        if (isJsonProperty(element) && element.key) obj[prop.key] = { ...obj[prop.key], ...rollupNodes(element) };
        else (obj[prop.key] ||= []).push(element);
      }
    } else obj[prop.key] = value;
  }
  return obj;
}

function isValueKind(node: ts.Node): Boolean {
  if (!node) return false;

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

function getNodeValue(node: ts.Node): any {
  if (!node) return false;

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
      if (ts.isNumericLiteral(node)) return +node.text;
      else if (ts.isStringLiteral(node)) return node.text;
      else if (ts.isIdentifier(node)) return node.text;
      else if (ts.isArrayLiteralExpression(node)) {
        let arrayValues: any[] = [];
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

function expandNode(node: ts.Node): JsonProperty | null {
  let thisProp: JsonProperty;

  try {
    if (isTypeWithNameAndInitializer(node) && isJsonKeyType(node.name)) {
      thisProp = new JsonProperty(node.name.text);

      if (node.initializer) {
        if (isValueKind(node.initializer)) thisProp.setValue(getNodeValue(node.initializer));
        else thisProp.setValue(expandNode(node.initializer));
      }
    } else {
      thisProp = new JsonProperty();
      ts.forEachChild(node, (childNode) => {
        thisProp.setValue(expandNode(childNode));
      });
    }
    return thisProp;
  } catch (error) {
    console.log(error);
  }
  return null;
}

function queryNode(node: ts.Node, query: string[]): ts.Node[] {
  let matches: ts.Node[] = [];

  if (
    !query ||
    query.length == 0 ||
    query.some((value, index, array) => {
      return !value;
    })
  )
    return matches;

  const match =
    (isTypeWithNameAndInitializer(node) && isJsonKeyType(node.name) && node.name.text == query[0]) ||
    (isExpressionWithIdentifier(node) && isJsonKeyType(node.expression) && node.expression.text == query[0]);

  if (match) console.log(node);
  //if we matched the final term, we're done
  if (match && query.length == 1) {
    matches.push(node);
  }
  //otherwise keep searching
  else {
    ts.forEachChild(node, (childNode) => {
      matches = matches.concat(queryNode(childNode, match ? query.slice(1) : query));
    });
  }
  return matches;
}

export function parseConfigFromScript(sourceString: string): any {
  const sourceFile = getSourceFile(sourceString);
  const root = new JsonProperty("__root");
  root.setValue(expandNode(sourceFile));
  return rollupNodes(root).__root;
}

export function queryHasMatch(sourceString: string, queryTerms: string[]): boolean {
  const sourceFile = getSourceFile(sourceString);
  const matches = queryNode(sourceFile, queryTerms);

  return matches && matches.length > 0;
}

export function queryNodeMatchValues(sourceString: string, queryTerms: string[]): any {
  const sourceFile = getSourceFile(sourceString);
  const matches = queryNode(sourceFile, queryTerms);

  let result: any = { matches: [] };

  matches.forEach((node: ts.Node) => {
    result.push(getNodeValue(node));
  });

  return result;
}
