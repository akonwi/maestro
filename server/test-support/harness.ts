import { Database } from "bun:sqlite";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";

// Per-file harness. Bun runs test files in parallel, so each file gets
// its own port + DB path + server subprocess to stay isolated. The
// server binary is built once by the `pretest` script and reused here.

const SERVER_DIR = dirname(import.meta.dir); // .../server
const TMP_DIR = join(SERVER_DIR, "tmp");
const BIN_PATH = join(TMP_DIR, "maestro-server-test");

export type ApiResponse<T = unknown> = {
  status: number;
  text: string;
  json: T | null;
  headers: Headers;
};

export type HarnessOptions = {
  /** Unique per test file. Used to derive the port and DB path. */
  id: string;
  /**
   * Base port. Each file picks a stable offset from this to avoid
   * collisions between parallel test files.
   */
  port: number;
  /** When true, /auth/request will call Resend. Default false. */
  resendEnabled?: boolean;
};

export function createHarness(opts: HarnessOptions) {
  const resendEnabled = opts.resendEnabled ?? false;
  const dbPath = join(TMP_DIR, `maestro-test-${opts.id}.db`);
  const port = String(opts.port);
  const base = `http://127.0.0.1:${port}`;
  let serverProc: Bun.Subprocess | null = null;
  let db: Database | null = null;

  function ensureBinary() {
    if (!existsSync(BIN_PATH)) {
      throw new Error(
        `Server binary not found at ${BIN_PATH}. Run 'bun run pretest' first (or use 'bun test' which does it for you).`,
      );
    }
  }

  // File-based reset: unlink the DB file, re-run migrations, reopen.
  // Only safe BEFORE the server subprocess is up — once it holds an open
  // handle, unlinking the file leaves the server writing to a ghost
  // inode while readers see a fresh empty file.
  function initDb() {
    if (db) {
      db.close();
      db = null;
    }
    for (const suffix of ["", "-shm", "-wal"]) {
      const p = dbPath + suffix;
      if (existsSync(p)) rmSync(p);
    }
    if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true });
    const proc = Bun.spawnSync(["migr", "up"], {
      cwd: SERVER_DIR,
      env: { ...process.env, DATABASE_URL: dbPath },
      stderr: "pipe",
      stdout: "pipe",
    });
    if (proc.exitCode !== 0) {
      throw new Error(
        `migr up failed:\n${new TextDecoder().decode(proc.stderr)}`,
      );
    }
    db = new Database(dbPath);
  }

  // In-place reset: truncate all app tables via the shared connection.
  // The server subprocess sees the same file, so no restart needed.
  // Preserves the schema and the `competitions` seed row.
  function resetDb() {
    if (!db) throw new Error("harness not set up");
    // Order matters only if we had FK enforcement on; SQLite defaults to
    // off, but we still delete children before parents for clarity.
    db.exec(`
      DELETE FROM sessions;
      DELETE FROM group_members;
      DELETE FROM groups;
      DELETE FROM predictions;
      DELETE FROM fixtures;
      DELETE FROM teams;
      DELETE FROM magic_links;
      DELETE FROM users;
      DELETE FROM sqlite_sequence WHERE name IN (
        'users','groups','predictions'
      );
    `);
  }

  async function startServer() {
    serverProc = Bun.spawn([BIN_PATH], {
      env: {
        ...process.env,
        DATABASE_URL: dbPath,
        PORT: port,
        RESEND_ENABLED: String(resendEnabled),
        RESEND_FROM_EMAIL: "onboarding@resend.dev",
        SERVER_BASE_URL: base,
        APP_BASE_URL: "http://web.test",
      },
      stdout: "pipe",
      stderr: "pipe",
    });

    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      try {
        const res = await fetch(`${base}/health`);
        if (res.status === 200) return;
      } catch {
        // not ready yet
      }
      await Bun.sleep(50);
    }
    throw new Error(`server on port ${port} did not become healthy within 5s`);
  }

  async function stopServer() {
    if (!serverProc) return;
    serverProc.kill("SIGINT");
    await serverProc.exited;
    serverProc = null;
  }

  async function setup() {
    ensureBinary();
    initDb();
    await startServer();
  }

  async function teardown() {
    await stopServer();
    if (db) {
      db.close();
      db = null;
    }
  }

  async function api<T = unknown>(
    method: string,
    path: string,
    init: { body?: unknown; headers?: Record<string, string>; redirect?: RequestRedirect } = {},
  ): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = { ...(init.headers ?? {}) };
    let body: string | undefined;
    if (init.body !== undefined) {
      body = typeof init.body === "string" ? init.body : JSON.stringify(init.body);
      headers["Content-Type"] ??= "application/json";
    }
    const res = await fetch(`${base}${path}`, {
      method,
      body,
      headers,
      redirect: init.redirect ?? "manual",
    });
    const text = await res.text();
    let json: T | null = null;
    if (text.length > 0) {
      try {
        json = JSON.parse(text) as T;
      } catch {
        json = null;
      }
    }
    return { status: res.status, text, json, headers: res.headers };
  }

  function sqlOne<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T | null {
    if (!db) throw new Error("harness not set up");
    return db.query(sql).get(...(params as any)) as T | null;
  }

  function sqlAll<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T[] {
    if (!db) throw new Error("harness not set up");
    return db.query(sql).all(...(params as any)) as T[];
  }

  return {
    base,
    setup,
    teardown,
    resetDb,
    api,
    sqlOne,
    sqlAll,
  };
}
