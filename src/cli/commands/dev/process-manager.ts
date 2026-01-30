/**
 * Process manager for running multiple development servers.
 *
 * Manages child processes for backend and frontend servers,
 * capturing logs and detecting ready/error states.
 *
 * @module
 */

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
  private portCheckIntervals = new Map<string, number>();

  /**
   * Checks if a port is open and accepting connections.
   *
   * @param port - Port number to check
   * @returns True if port is open, false otherwise
   */
  private async isPortOpen(port: number): Promise<boolean> {
    try {
      const conn = await Deno.connect({
        hostname: "localhost",
        port,
        transport: "tcp",
      });
      conn.close();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Starts periodic port checking for a module.
   *
   * @param name - Module name
   * @param port - Port to check
   */
  private startPortCheck(name: string, port: number): void {
    const checkInterval = setInterval(async () => {
      const process = this.processes.get(name);
      if (!process || process.status !== "starting") {
        // Stop checking if process is no longer starting
        const interval = this.portCheckIntervals.get(name);
        if (interval !== undefined) {
          clearInterval(interval);
          this.portCheckIntervals.delete(name);
        }
        return;
      }

      const isOpen = await this.isPortOpen(port);
      if (isOpen) {
        // Port is open, mark as ready
        process.status = "ready";
        process.url = `http://localhost:${port}`;
        this.notifyStatusChange(name, "ready", process.url);

        // Stop checking
        const interval = this.portCheckIntervals.get(name);
        if (interval !== undefined) {
          clearInterval(interval);
          this.portCheckIntervals.delete(name);
        }
      }
    }, 500); // Check every 500ms

    this.portCheckIntervals.set(name, checkInterval);
  }

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

      // Start port checking for frontend (Lume)
      if (name === "frontend") {
        this.startPortCheck(name, 8001);
      }

      // Monitor process exit
      child.status.then((status) => {
        // Stop port checking if running
        const interval = this.portCheckIntervals.get(name);
        if (interval !== undefined) {
          clearInterval(interval);
          this.portCheckIntervals.delete(name);
        }

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
        // Stop port checking if running
        const interval = this.portCheckIntervals.get(name);
        if (interval !== undefined) {
          clearInterval(interval);
          this.portCheckIntervals.delete(name);
        }

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

    // Stop port checking if running
    const interval = this.portCheckIntervals.get(name);
    if (interval !== undefined) {
      clearInterval(interval);
      this.portCheckIntervals.delete(name);
    }

    try {
      process.status = "stopped";
      const child = process.child;

      // Try graceful shutdown first
      child.kill("SIGTERM");

      // Wait for graceful shutdown with timeout
      const shutdownPromise = child.status;
      const timeoutPromise = new Promise<void>((resolve) => {
        setTimeout(() => {
          // Force kill if still running after timeout
          try {
            if (child) {
              child.kill("SIGKILL");
            }
          } catch {
            // Ignore errors during force kill
          }
          resolve();
        }, 3000); // 3 second timeout
      });

      await Promise.race([shutdownPromise, timeoutPromise]);

      this.notifyStatusChange(name, "stopped");
    } catch {
      // Process already stopped or killed
      try {
        const process = this.processes.get(name);
        if (process?.child) {
          process.child.kill("SIGKILL");
        }
      } catch {
        // Ignore errors
      }
    }
  }

  /**
   * Stops all running processes.
   * Forces shutdown of all processes, using SIGKILL if necessary.
   */
  async stopAll(): Promise<void> {
    // Stop all port checking intervals
    for (const [name, interval] of this.portCheckIntervals) {
      clearInterval(interval);
      this.portCheckIntervals.delete(name);
    }

    const stops = Array.from(this.processes.keys()).map((name) => this.stopModule(name));

    // Wait for all graceful shutdowns
    await Promise.allSettled(stops);

    // Force kill any remaining processes
    for (const [_name, process] of this.processes) {
      if (process.child && process.status !== "stopped") {
        try {
          process.child.kill("SIGKILL");
          process.status = "stopped";
        } catch {
          // Ignore errors
        }
      }
    }
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
    if (!process) return;

    const readyPatterns = [
      /deno\s+serve:.*listening\s+on\s+https?:\/\/[^\s]+/i,
      /listening on/i,
      /server (?:running|started|listening)/i,
      /ready in/i,
      /local:\s*(https?:\/\/[^\s]+)/i,
      /http:\/\/[^\s]+/i,
      /https:\/\/[^\s]+/i,
      /vite.*(?:ready|running)/i,
      /deno.*(?:listening|running)/i,
    ];

    const wasReady = process.status === "ready";
    let urlExtracted = false;

    for (const pattern of readyPatterns) {
      if (pattern.test(line)) {
        if (!wasReady) {
          process.status = "ready";
        }

        // Try to extract URL with improved patterns (even if already ready)
        let urlMatch = line.match(/https?:\/\/[^\s\)]+/i);

        // If no full URL found, try to extract port and construct URL
        if (!urlMatch) {
          const portMatch = line.match(/:(\d{4,5})\b/);
          if (portMatch) {
            const port = portMatch[1];
            // Default to http://localhost if no protocol/host found
            urlMatch = [`http://localhost:${port}`];
          }
        }

        // Also try to extract from common patterns like "localhost:8000" or "127.0.0.1:5173"
        if (!urlMatch) {
          const hostPortMatch = line.match(/(localhost|127\.0\.0\.1|0\.0\.0\.0):(\d{4,5})\b/i);
          if (hostPortMatch) {
            const host = hostPortMatch[1];
            const port = hostPortMatch[2];
            urlMatch = [`http://${host}:${port}`];
          }
        }

        if (urlMatch && !process.url) {
          // Clean up URL (remove trailing punctuation)
          process.url = urlMatch[0].replace(/[.,;\)\]\}]+$/, "");
          urlExtracted = true;
        }

        // Notify status change if we just became ready or extracted a new URL
        if (!wasReady || urlExtracted) {
          this.notifyStatusChange(name, "ready", process.url);
        }
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
