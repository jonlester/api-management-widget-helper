import ts from "rollup-plugin-ts";
import { InputOptions, Plugin, rollup } from "rollup";
import pkg from "./package.json" assert {type: "json"};
import { builtinModules } from "module";
import fs from "fs";
import MagicString from "magic-string";
import cpy from 'cpy'

const SHARED_OUTPUT_OPTIONS = {
	hoistTransitiveImports: false,
	generatedCode: "es2015",
	compact: false,
	minifyInternalExports: false
} as const;

let buildFailed = false;
try {
	await buildBin();
	await buildLib();

	console.log("Copy templates")
	await cpy('./src/templates/**', './pkg/templates')	

} catch (error) {
	buildFailed = true;
	console.error(error);
}
process.exit(buildFailed ? 1 : 0);


async function buildBin() {
	let bundle;

	const options: InputOptions = {
		input: "src/bin/index.ts",
		plugins: [
			ts({
				tsconfig: "tsconfig.bin.json"
			}),
			executable()
		],
		external: [...builtinModules, ...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})]
	}

	console.log("Starting build for /bin");
	bundle = await rollup(options)
	await bundle.write({
		file: "./pkg/bin/cli.cjs",
		format: "cjs",
		...SHARED_OUTPUT_OPTIONS
	});

	if (bundle) {
		// closes the bundle
		console.log("Closing bundle")
		await bundle.close();
	}
}
async function buildLib() {
	let bundle;

	const options: InputOptions = {
		input: "src/lib/index.ts",
		plugins: [
			ts({
				tsconfig: "tsconfig.lib.json"
			})
		],
		external: [...builtinModules, ...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})]
	}

	console.log("Starting build for /lib");
	bundle = await rollup(options)
	await bundle.write({
		file: "./pkg/lib/index.js",
		format: "cjs",
		...SHARED_OUTPUT_OPTIONS
	});

	await bundle.write({
		file: "./pkg/lib/esm/index.js",
		format: "esm",
		...SHARED_OUTPUT_OPTIONS
	});

	if (bundle) {
		// closes the bundle
		console.log("Closing /lib bundle")
		await bundle.close();
	}
}

function executable(options: any = {}): Plugin {
	let fileName: string | undefined;
	const shebangReplacements = new Map();
	return {
	  name: "rollup-plugin-executable",
	  transform(code, module) {
		let shebang;
		code = code.replace(/^#![^\n]*/, (match) => ((shebang = match), ""));
		if (!shebang) return null;
		shebangReplacements.set(module, shebang);
		return { code, map: null };
	  },
	  renderChunk(code, chunk, { sourcemap }) {
		const shebang = shebangReplacements.get(chunk.facadeModuleId);
		if (!shebang) return null;
		const s = new MagicString(code);
		s.prepend(`${options.shebang || shebang}\n`);
		return {
		  code: s.toString(),
		  map: sourcemap ? s.generateMap({ hires: true }) : null,
		};
	  },
	  generateBundle(options) {
		fileName = options.file;
	  },
	  writeBundle() {
		if (fileName && process.platform !== "win32") {
		  const stat = fs.statSync(fileName);
  
		  // chmod a+x -> 0o111
		  fs.chmodSync(fileName, stat.mode | 0o111);
		}
	  },
	};
  };


  

