const { join, resolve } = require('path');
const { writeFileSync } = require('fs');
const { commands } = require('../src/packages/piral-cli/lib/commands');
const nl = '\n';

const rootFolder = resolve(__dirname, '..', 'docs', 'commands');

function generateNewContent(command) {
  return `# \`${command}\``;
}

function getCommandPath(command) {
  return join(rootFolder, `${command}.md`);
}

function writeCommandContent(command, content) {
  const commandMdPath = getCommandPath(command);
  writeFileSync(commandMdPath, content, 'utf8');
}

function shell(content) {
  const start = '```sh';
  const end = '```';
  return `${start}${nl}${content}${nl}${end}`;
}

function printAlias(aliases) {
  if (aliases.length === 0) {
    return 'No aliases available.';
  }

  return aliases.map(alias => `- \`${alias}\``).join(nl);
}

function printValue(value) {
  if (value === resolve(__dirname, '..')) {
    return 'process.cwd()';
  } else {
    return JSON.stringify(value);
  }
}

function getCommandData(retrieve) {
  const data = {
    positionals: [],
    flags: [],
  };
  const fn = {
    positional(name, info) {
      data.positionals.push({
        ...info,
        name,
      });
      return this;
    },
    swap(name, swapper) {
      const [flag] = data.flags.filter(m => m.name === name);
      const newFlag = swapper(flag || { name });

      if (!flag) {
        data.flags.push(newFlag);
      } else {
        Object.assign(flag, newFlag);
      }

      return this;
    },
    choices(name, choices) {
      return this.swap(name, flag => ({
        ...flag,
        type: 'string',
        values: choices.map(printValue),
      }));
    },
    string(name) {
      return this.swap(name, flag => ({
        ...flag,
        type: 'string',
      }));
    },
    boolean(name) {
      return this.swap(name, flag => ({
        ...flag,
        type: 'boolean',
      }));
    },
    describe(name, value) {
      return this.swap(name, flag => ({
        ...flag,
        describe: value,
      }));
    },
    default(name, value) {
      return this.swap(name, flag => ({
        ...flag,
        default: printValue(value),
      }));
    },
    number(name) {
      return this.swap(name, flag => ({
        ...flag,
        type: 'number',
      }));
    },
    demandOption(name) {
      return this.swap(name, flag => ({
        ...flag,
        required: true,
      }));
    }
  };

  if (typeof retrieve === 'function') {
    retrieve(fn);
  }

  return data;
}

function details(args) {
  if (args.length === 0) {
    return 'Not applicable.';
  }

  return args.map(arg => `### \`${arg.name}\`

${arg.describe || 'No description available.'}

- Type: \`${arg.type}\`${arg.values ? nl + `- Choices: \`${arg.values.join('\`, \`')}\`` : ''}
- Default: \`${arg.default}\`${arg.required ? nl + '- **Caution: This flag is required!**' : ''}`).join(nl + nl);
}

function generateFrom(command) {
  const { positionals, flags } = getCommandData(command.flags);
  const hasAlt = command.name.endsWith('-piral') || command.name.endsWith('-pilet');
  const parts = command.name.split('-');
  return `
${command.description || 'No description available.'}

## Syntax

From the command line:

${shell(`pb ${command.name} ${command.arguments.join(' ')}`)}
${hasAlt ? `
Alternative:

${shell(`${parts.pop()} ${parts.join('-')} ${command.arguments.join(' ')}`)}
` : ''}
## Aliases

Instead of \`${command.name}\` you can also use:

${printAlias(command.alias)}

## Positionals

${details(positionals)}

## Flags

${details(flags.map(flag => ({ ...flag, name: `--${flag.name}` })))}
`;
}

function replaceBody(content, body) {
  return content + nl + body;
}

function generateCommandDocs() {
  for (const command of commands.all) {
    const oldContent = generateNewContent(command.name);
    const body = generateFrom(command);
    const newContent = replaceBody(oldContent, body);
    writeCommandContent(command.name, newContent);
  }
}

if (require.main === module) {
  generateCommandDocs();
  console.log('CLI commands documentation generated!');
} else {
  module.exports = generateCommandDocs;
}
