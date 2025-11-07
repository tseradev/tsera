type OptionValueParser = (value: string) => unknown;

type OptionDefinition = {
  flagName: string;
  propertyName: string;
  shortName?: string;
  expectsValue: boolean;
  defaultValue: unknown;
  global: boolean;
  negatable: boolean;
  description: string;
  displayName: string;
  valueParser?: OptionValueParser;
};

interface OptionConfig<T> {
  default?: T;
  global?: boolean;
  negatable?: boolean;
  value?: OptionValueParser;
}

type ActionHandler<TOptions> = (
  options: TOptions,
  ...args: string[]
) => unknown | Promise<unknown>;

interface ArgumentSpec {
  name: string;
  required: boolean;
}

/**
 * Polyfill implementation of Cliffy's Command class for environments where
 * the JSR package is not available.
 *
 * Provides a minimal command-line argument parser with support for options,
 * arguments, subcommands, and action handlers.
 */
export class Command<TOptions = Record<string, unknown>> {
  private readonly options: OptionDefinition[] = [];
  private readonly subcommands = new Map<string, Command<unknown>>();
  private actionHandler?: ActionHandler<TOptions>;
  private argumentSpec?: ArgumentSpec;
  private shouldThrow = false;
  private commandName = "command";
  private commandDescription = "";
  private commandVersion?: string;

  name(_value: string): this {
    this.commandName = _value.trim() || this.commandName;
    return this;
  }

  description(_value: string): this {
    this.commandDescription = _value.trim();
    return this;
  }

  version(_value: string): this {
    this.commandVersion = _value.trim();
    return this;
  }

  arguments(spec: string): this {
    const trimmed = spec.trim();
    if (!trimmed) {
      return this;
    }

    const required = trimmed.startsWith("<") && trimmed.endsWith(">");
    const name = trimmed.replace(/[<>\[\]]/g, "").trim() || "arg";
    this.argumentSpec = { name, required };
    return this;
  }

  option<TValue = unknown>(
    spec: string,
    _description: string,
    config: OptionConfig<TValue> = {},
  ): this {
    const parts = spec.split(",");
    let longName = "";
    let shortName: string | undefined;

    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed.startsWith("--")) {
        const [flag] = trimmed.split(/\s+/);
        longName = flag.replace(/^--/, "");
      } else if (trimmed.startsWith("-")) {
        shortName = trimmed.replace(/^-+/, "");
      }
    }

    if (!longName) {
      throw new Error(`Invalid option: ${spec}`);
    }

    const expectsValue = /<.+>/.test(spec);
    const propertyName = toPropertyName(longName);

    this.options.push({
      flagName: longName,
      propertyName,
      shortName,
      expectsValue,
      defaultValue: config.default,
      global: Boolean(config.global),
      negatable: Boolean(config.negatable),
      description: _description.trim(),
      displayName: spec.trim(),
      valueParser: config.value,
    });

    return this;
  }

  globalOption<TValue = unknown>(
    spec: string,
    description: string,
    config: OptionConfig<TValue> = {},
  ): this {
    return this.option(spec, description, { ...config, global: true });
  }

  command<TChildOptions>(name: string, command: Command<TChildOptions>): this {
    command.name(name);
    this.subcommands.set(name, command as Command<unknown>);
    return this;
  }

  action(handler: ActionHandler<TOptions>): this {
    this.actionHandler = handler;
    return this;
  }

  throwErrors(): this {
    this.shouldThrow = true;
    return this;
  }

  showHelp(): void {
    const lines: string[] = [];
    const usage: string[] = [this.commandName || "command"];

    if (this.subcommands.size > 0) {
      usage.push("<command>");
    }

    if (this.argumentSpec) {
      const arg = this.argumentSpec.required
        ? `<${this.argumentSpec.name}>`
        : `[${this.argumentSpec.name}]`;
      usage.push(arg);
    }

    lines.push(`Usage: ${usage.join(" ")}`.trim());

    if (this.commandDescription) {
      lines.push("", this.commandDescription);
    }

    if (this.commandVersion) {
      lines.push("", `Version: ${this.commandVersion}`);
    }

    if (this.options.length > 0) {
      lines.push("", "Options:");
      const formatted = this.options.map((option) => {
        const label = option.displayName || `--${option.flagName}`;
        const description = option.description ? option.description : "";
        return { label, description };
      });
      const maxLabelLength = formatted.reduce(
        (length, entry) => Math.max(length, entry.label.length),
        0,
      );

      for (const entry of formatted) {
        const padded = entry.label.padEnd(maxLabelLength + 2, " ");
        lines.push(`  ${padded}${entry.description}`.trimEnd());
      }
    }

    if (this.subcommands.size > 0) {
      lines.push("", "Commands:");
      const entries = Array.from(this.subcommands.entries()).map(([name, command]) => ({
        name,
        description: command.commandDescription,
      }));
      const longest = entries.reduce(
        (length, entry) => Math.max(length, entry.name.length),
        0,
      );
      for (const entry of entries) {
        const padded = entry.name.padEnd(longest + 2, " ");
        const description = entry.description ?? "";
        lines.push(`  ${padded}${description}`.trimEnd());
      }
    }

    console.log(lines.join("\n"));
  }

  async parse(args: string[]): Promise<void> {
    try {
      await this.execute(args, {});
    } catch (error) {
      if (this.shouldThrow) {
        throw error;
      }
      console.error(error instanceof Error ? error.message : String(error));
    }
  }

  private async execute(args: string[], inheritedGlobals: Record<string, unknown>): Promise<void> {
    const globalValues: Record<string, unknown> = { ...inheritedGlobals };
    const localValues: Record<string, unknown> = {};

    for (const option of this.options) {
      if (option.global) {
        if (!(option.propertyName in globalValues)) {
          globalValues[option.propertyName] = option.defaultValue;
        }
      } else if (!(option.propertyName in localValues)) {
        localValues[option.propertyName] = option.defaultValue;
      }
    }

    const positionals: string[] = [];
    let index = 0;
    let subcommandName: string | undefined;

    while (index < args.length) {
      const arg = args[index];

      if (arg === "--") {
        index++;
        while (index < args.length) {
          positionals.push(args[index]);
          index++;
        }
        break;
      }

      if (arg === "--help" || arg === "-h") {
        this.showHelp();
        return;
      }

      if (arg.startsWith("--")) {
        const consumed = this.handleLongOption(arg, args, index, globalValues, localValues);
        index = consumed;
        continue;
      }

      if (arg.startsWith("-")) {
        const consumed = this.handleShortOption(arg, args, index, globalValues, localValues);
        index = consumed;
        continue;
      }

      if (!subcommandName && this.subcommands.has(arg)) {
        subcommandName = arg;
        index++;
        break;
      }

      positionals.push(arg);
      index++;
    }

    const rest = args.slice(index);

    if (subcommandName) {
      const sub = this.subcommands.get(subcommandName);
      if (!sub) {
        throw new Error(`Unknown subcommand: ${subcommandName}`);
      }
      await sub.execute(rest, globalValues);
      return;
    }

    if (!this.actionHandler) {
      if (this.subcommands.size > 0) {
        this.showHelp();
        return;
      }
      return;
    }

    if (this.argumentSpec?.required && positionals.length === 0) {
      throw new Error(`Missing required argument: ${this.argumentSpec.name}`);
    }

    const options = { ...globalValues, ...localValues } as unknown as TOptions;
    await this.actionHandler(options, ...positionals);
  }

  private handleLongOption(
    arg: string,
    args: string[],
    index: number,
    globalValues: Record<string, unknown>,
    localValues: Record<string, unknown>,
  ): number {
    const negated = arg.startsWith("--no-");
    const name = negated ? arg.slice(5) : arg.slice(2).split("=")[0];
    const option = this.options.find((opt) => opt.flagName === name);
    if (!option) {
      throw new Error(`Unknown option: --${name}`);
    }

    const target = option.global ? globalValues : localValues;

    if (negated) {
      if (!option.negatable) {
        throw new Error(`Non-negatable option: --${name}`);
      }
      target[option.propertyName] = false;
      return index + 1;
    }

    if (option.expectsValue) {
      let value: string | undefined;
      const equalsIndex = arg.indexOf("=");
      if (equalsIndex !== -1) {
        value = arg.slice(equalsIndex + 1);
      } else {
        value = args[index + 1];
        if (value === undefined) {
          throw new Error(`Missing value for --${name}`);
        }
        index += 1;
      }
      target[option.propertyName] = option.valueParser ? option.valueParser(value) : value;
      return index + 1;
    }

    target[option.propertyName] = true;
    return index + 1;
  }

  private handleShortOption(
    arg: string,
    args: string[],
    index: number,
    globalValues: Record<string, unknown>,
    localValues: Record<string, unknown>,
  ): number {
    const name = arg.replace(/^-+/, "");
    const option = this.options.find((opt) => opt.shortName === name);
    if (!option) {
      throw new Error(`Unknown option: -${name}`);
    }

    const target = option.global ? globalValues : localValues;

    if (option.expectsValue) {
      const value = args[index + 1];
      if (value === undefined) {
        throw new Error(`Valeur manquante pour -${name}`);
      }
      target[option.propertyName] = option.valueParser ? option.valueParser(value) : value;
      return index + 2;
    }

    target[option.propertyName] = true;
    return index + 1;
  }
}

function toPropertyName(flagName: string): string {
  return flagName.replace(/-([a-z])/g, (_match, char: string) => char.toUpperCase());
}
