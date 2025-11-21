/**
 * Process manager for running multiple development servers.
 *
 * Manages child processes for backend and frontend servers,
 * capturing logs and detecting ready/error states.
 *
 * @module
 */

// import { join } from "../../../shared/path.ts";

/**
 * Status of a managed process.
 */
export type ProcessStatus = "starting" | "ready" | "error" | "stopped";

/**
 * Represents a managed module process.
 */
export interface ModuleProcess {
  /** Module name (e.g., "backend", "frontend") */
  name: string;
  /** Current status of the process */
  status: ProcessStatus;
  /** Captured stdout/stderr logs */
  logs: string[];
  /** Captured error messages */
  errors: string[];
  /** The child process (if running) */
  child?: Deno.ChildProcess;
  /** URL where the server is running (if detected) */
  url?: string;
}

/**
 * Callback invoked when a module's status changes.
 */
export type StatusChangeCallback = (name: string, status: ProcessStatus, url?: string) => void;

/**
 * Options for starting a module.
 */
export interface StartModuleOptions {
  /** Module name */
  name: string;
  /** Command to run (e.g., "deno", "vite") */
  command: string;
  /** Command arguments */
  args: string[];
  /** Working directory for the command */
  cwd: string;
  /** Show logs in real-time to console */
  showLogs?: boolean;
}

/**
 * Manages child processes for development servers.
 *
 * Handles starting, stopping, and monitoring multiple processes,
 * capturing their output and detecting ready/error states.
 *
 * @example
 * ```typescript
 * const manager = new ProcessManager();
 *
 * manager.onStatusChange((name, status, url) => {
 *   console.log(`${name} is ${status} at ${url}`);
 * });
 *
 * await manager.startModule({
 *   name: "backend",
 *   command: "deno",
 *   args: ["run", "-A", "--watch", "app/back/main.ts"],
 *   cwd: "/path/to/project",
 * });
 * ```
 */
export class ProcessManager {
  private processes = new Map<string, ModuleProcess>();
  private statusCallbacks: StatusChangeCallback[] = [];
  private textDecoder = new TextDecoder();

  /**
   * Starts a module process.
   *
   * @param options - Module start options
   */
  async startModule(options: StartModuleOptions): Promise<void> {
    const { name, command, args, cwd, showLogs = false } = options;

    // Stop existing process if running
    if (this.processes.has(name)) {
      await this.stopModule(name);
    }

    const process: ModuleProcess = {
      name,
      status: "starting",
      logs: [],
      errors: [],
    };

    this.processes.set(name, process);
    this.notifyStatusChange(name, "starting");

    try {
      const cmd = new Deno.Command(command, {
        args,
        cwd,
        stdout: "piped",
        stderr: "piped",
        stdin: "null",
      });

      const child = cmd.spawn();
      process.child = child;

      // Read stdout
      this.readStream(child.stdout, (line) => {
        process.logs.push(line);
        if (showLogs) {
          console.log(`[${name}] ${line}`);
        }
        this.detectReadyState(name, line);
      });

      // Read stderr
      this.readStream(child.stderr, (line) => {
        process.logs.push(line);
        if (showLogs) {
          console.error(`[${name}] ${line}`);
        }
        this.detectErrorState(name, line);
      });

      // Monitor process exit
      child.status.then((status) => {
        if (process.status !== "stopped") {
          if (status.success) {
            process.status = "stopped";
          } else {
            process.status = "error";
            process.errors.push(`Process exited with code ${status.code}`);
          }
          this.notifyStatusChange(name, process.status);
        }
      }).catch((error) => {
        process.status = "error";
        process.errors.push(`Process error: ${error.message}`);
        this.notifyStatusChange(name, "error");
      });
    } catch (error) {
      process.status = "error";
      const message = error instanceof Error ? error.message : String(error);
      process.errors.push(`Failed to start: ${message}`);
      this.notifyStatusChange(name, "error");
      throw error;
    }
  }

  /**
   * Stops a module process.
   *
   * @param name - Module name
   */
  async stopModule(name: string): Promise<void> {
    const process = this.processes.get(name);
    if (!process || !process.child) {
      return;
    }

    try {
      process.status = "stopped";
      process.child.kill("SIGTERM");

      // Wait a bit for graceful shutdown
      const timeout = setTimeout(() => {
        if (process.child) {
          process.child.kill("SIGKILL");
        }
      }, 5000);

      await process.child.status;
      clearTimeout(timeout);

      this.notifyStatusChange(name, "stopped");
    } catch {
      // Process already stopped or killed
    }
  }

  /**
   * Stops all running processes.
   */
  async stopAll(): Promise<void> {
    const stops = Array.from(this.processes.keys()).map((name) => this.stopModule(name));
    await Promise.all(stops);
  }

  /**
   * Gets the status of a module.
   *
   * @param name - Module name
   * @returns Module status or undefined if not found
   */
  getStatus(name: string): ProcessStatus | undefined {
    return this.processes.get(name)?.status;
  }

  /**
   * Gets the logs for a module.
   *
   * @param name - Module name
   * @returns Array of log lines
   */
  getLogs(name: string): string[] {
    return this.processes.get(name)?.logs ?? [];
  }

  /**
   * Gets the errors for a module.
   *
   * @param name - Module name
   * @returns Array of error messages
   */
  getErrors(name: string): string[] {
    return this.processes.get(name)?.errors ?? [];
  }

  /**
   * Gets the URL where a module is running.
   *
   * @param name - Module name
   * @returns URL if detected, undefined otherwise
   */
  getUrl(name: string): string | undefined {
    return this.processes.get(name)?.url;
  }

  /**
   * Registers a callback for status changes.
   *
   * @param callback - Callback function
   */
  onStatusChange(callback: StatusChangeCallback): void {
    this.statusCallbacks.push(callback);
  }

  /**
   * Gets all managed processes.
   *
   * @returns Map of process name to ModuleProcess
   */
  getAll(): Map<string, ModuleProcess> {
    return new Map(this.processes);
  }

  /**
   * Reads a stream line by line and invokes callback for each line.
   */
  private async readStream(
    stream: ReadableStream<Uint8Array>,
    onLine: (line: string) => void,
  ): Promise<void> {
    try {
      let buffer = "";
      const reader = stream.getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += this.textDecoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.trim()) {
            onLine(line);
          }
        }
      }

      // Process remaining buffer
      if (buffer.trim()) {
        onLine(buffer);
      }
    } catch {
      // Stream closed or error
    }
  }

  /**
   * Detects if a log line indicates the server is ready.
   */
  private detectReadyState(name: string, line: string): void {
    const process = this.processes.get(name);
    if (!process || process.status === "ready") return;

    // const lowerLine = line.toLowerCase(); // Unused
    const readyPatterns = [
      /listening on/i,
      /server (?:running|started|listening)/i,
      /ready in/i,
      /local:\s*(https?:\/\/[^\s]+)/i,
      /http:\/\/[^\s]+/i,
    ];

    for (const pattern of readyPatterns) {
      if (pattern.test(line)) {
        process.status = "ready";

        // Try to extract URL
        const urlMatch = line.match(/https?:\/\/[^\s]+/i);
        if (urlMatch) {
          process.url = urlMatch[0];
        }

        this.notifyStatusChange(name, "ready", process.url);
        break;
      }
    }
  }

  /**
   * Detects if a log line indicates an error.
   */
  private detectErrorState(name: string, line: string): void {
    const process = this.processes.get(name);
    if (!process) return;

    // const lowerLine = line.toLowerCase(); // Unused
    const errorPatterns = [
      /error:/i,
      /exception/i,
      /failed to/i,
      /cannot find/i,
      /eaddrinuse/i,
    ];

    for (const pattern of errorPatterns) {
      if (pattern.test(line)) {
        process.errors.push(line);
        if (process.status !== "error") {
          process.status = "error";
          this.notifyStatusChange(name, "error");
        }
        break;
      }
    }
  }

  /**
   * Notifies all callbacks of a status change.
   */
  private notifyStatusChange(name: string, status: ProcessStatus, url?: string): void {
    for (const callback of this.statusCallbacks) {
      try {
        callback(name, status, url);
      } catch {
        // Ignore callback errors
      }
    }
  }
}
