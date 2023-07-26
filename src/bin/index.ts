#!/usr/bin/env node

import { Command } from "commander";
import { init } from "./init-command";

async function main() {
  const program = new Command();

  program
    .name("widget-helper")
    .usage("[command] [options]")
    .addHelpText("after", "example: foo")
    .command("init")
    .description("Initialize the current project with the widget helper features")
    .option("-p, --projectRoot <path>", "relative path of the project root from the current working directory", ".")
    .option(
      "-s, --silent",
      "initialize without prompts, allowing files to be overwritten or modified without confirmation",
      false,
    )
    .action(async (options: any) => {
      await init(options.projectRoot, options.silent);
    });

  const command = await program.parseAsync(process.argv);
}
main();
