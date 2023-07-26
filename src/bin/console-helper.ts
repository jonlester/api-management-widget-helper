import chalk from "chalk";

export type Log = (msg: string) => void;
export const white: Log = (msg) => console.log(chalk.white(msg));
export const green: Log = (msg) => console.log(chalk.green(msg));
export const red: Log = (msg) => console.log(chalk.red(msg));
export const gray: Log = (msg) => console.log(chalk.gray(msg));
