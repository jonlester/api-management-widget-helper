import ts from "typescript";
import fs from 'fs'

const compilerOptions = {
    target: ts.ScriptTarget.ES5,
    module: ts.ModuleKind.CommonJS
};


//const host = ts.createCompilerHost(compilerOptions);
const node = ts.createSourceFile(
    'x.ts',   // fileName
    fs.readFileSync('./deploy.js', 'utf8'), // sourceText
    ts.ScriptTarget.ES2017 // langugeVersion
  );


//let service = ts.createLanguageService(node, host);

ts.par

const declarations = node.getNamedDeclarations();

let tree = []

declarations.forEach((values, key) => {

    let rootNode = { key: key, children: []}
    tree.push(rootNode);
    recurse(values[0], rootNode);
    

});



 
  function recurse(parentNode, parentObj)
  {
    parentNode.forEachChild(childNode  => {
        
        let childObj = {
            text: childNode.text,
            kind: ts.SyntaxKind[childNode.kind]
        }


        if(childNode.kind === ts.SyntaxKind.Identifier) {
            parentObj.key = childObj.text;
        }
        else if(childNode.kind === ts.SyntaxKind.StringLiteral) {
            parentObj.value = childObj.text
            
        }
        else if(childNode.kind === ts.SyntaxKind.ObjectLiteralExpression) {
            
            parentObj.values = []
            if(childNode.properties && childNode.properties.length > 0)
            {
                childNode.properties.forEach((prop) => {
                    parentObj.values.push({
                        key: prop.name.text,
                        value: prop.initializer.text
                    });
                });
            }
        }
        
        else {
            childObj.children= [];
            recurse(childNode, childObj)
            parentObj.children.push(childObj);

            
        }
        
      });
     

  }

  console.log(JSON.stringify(tree));