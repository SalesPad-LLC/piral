import { inquirer } from './external';
import { commands } from './commands';
import { ToolCommand } from './types';

type FlagType = 'string' | 'number' | 'boolean' | 'object';

interface Flag {
  name: string;
  type?: FlagType;
  alias: Array<string>;
  values?: Array<any>;
  describe?: string;
  default?: any;
  required?: boolean;
}

function getCommandData(retrieve: any) {
  const instructions: Array<Flag> = [];
  const fn = {
    alias(name: string, altName: string) {
      return this.swap(name, (flag) => ({
        ...flag,
        alias: [...flag.alias, altName],
      }));
    },
    positional(name: string, info: Flag) {
      instructions.push({
        ...info,
        alias: [],
        name,
      });
      return this;
    },
    swap(name: string, swapper: (flag: Flag) => Flag) {
      const [flag] = instructions.filter((m) => m.name === name);
      const newFlag = swapper(flag || { name, alias: [] });

      if (!flag) {
        instructions.push(newFlag);
      } else {
        Object.assign(flag, newFlag);
      }

      return this;
    },
    option(name: string) {
      return this.swap(name, (flag) => ({
        ...flag,
        value: {},
        type: 'object',
      }));
    },
    choices(name: string, choices: Array<any>) {
      return this.swap(name, (flag) => ({
        ...flag,
        type: 'string',
        values: choices,
      }));
    },
    string(name: string) {
      return this.swap(name, (flag) => ({
        ...flag,
        type: 'string',
      }));
    },
    boolean(name: string) {
      return this.swap(name, (flag) => ({
        ...flag,
        type: 'boolean',
      }));
    },
    describe(name: string, value: string) {
      return this.swap(name, (flag) => ({
        ...flag,
        describe: value,
      }));
    },
    default(name: string, value: any) {
      return this.swap(name, (flag) => ({
        ...flag,
        default: value,
      }));
    },
    number(name: string) {
      return this.swap(name, (flag) => ({
        ...flag,
        type: 'number',
      }));
    },
    demandOption(name: string) {
      return this.swap(name, (flag) => ({
        ...flag,
        required: true,
      }));
    },
  };

  if (typeof retrieve === 'function') {
    retrieve(fn);
  }

  return instructions;
}

function getValue(type: FlagType, value: string) {
  switch (type) {
    case 'boolean':
      return !!value;
    case 'number':
      return +value;
    case 'string':
      return value;
    case 'object':
      return value;
  }
}

function getType(flag: Flag) {
  switch (flag.type) {
    case 'string':
      if (flag.values) {
        return 'list';
      }

      return 'input';
    case 'number':
      return 'input';
    case 'boolean':
      return 'confirm';
  }
}

export type IgnoredInstructions = Array<string> | Record<string, string>;

export function runQuestionnaireFor(
  command: ToolCommand<any, any>,
  args: Record<string, any>,
  ignoredInstructions: IgnoredInstructions = ['base', 'log-level'],
) {
  const acceptAll = args.y === true || args.defaults === true;
  const instructions = getCommandData(command.flags);
  const ignored = Array.isArray(ignoredInstructions) ? ignoredInstructions : Object.keys(ignoredInstructions);
  const questions = instructions
    .filter((instruction) => !ignored.includes(instruction.name))
    .filter((instruction) => !acceptAll || (instruction.default === undefined && instruction.required))
    .filter((instruction) => [...instruction.alias, instruction.name].every((m) => args[m] === undefined))
    .filter((instruction) => instruction.type !== 'object')
    .map((instruction) => ({
      name: instruction.name,
      default: instruction.values ? instruction.values.indexOf(instruction.default) : instruction.default,
      message: instruction.describe,
      type: getType(instruction),
      choices: instruction.values,
      validate: instruction.type === 'number' ? (input: string) => !isNaN(+input) : () => true,
    }));


  return inquirer.prompt(questions).then((answers) => {
    const parameters: any = {};

    for (const instruction of instructions) {
      const name = instruction.name;
      const value =
        answers[name] ??
        ignoredInstructions[name] ??
        [...instruction.alias, instruction.name].map((m) => args[m]).find((v) => v !== undefined);
      parameters[name] = value !== undefined ? getValue(instruction.type, value as any) : instruction.default;
    }

    return command.run(parameters);
  });
}

export function runQuestionnaire(
  commandName: string,
  ignoredInstructions: IgnoredInstructions = ['base', 'log-level'],
) {
  const { argv } = require('yargs');
  const [command] = commands.all.filter((m) => m.name === commandName);
  return runQuestionnaireFor(command, argv, ignoredInstructions);
}
