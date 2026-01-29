export const layout = "layout.vto";

export default function (): string {
  return `
    <main class="page" aria-label="Hello TSera">
      <header class="hero">
        <div class="hero-bg" aria-hidden="true">
          <div class="orb o1"></div>
          <div class="orb o2"></div>
          <div class="grid"></div>
          <div class="shine"></div>
        </div>

        <div class="hero-inner">
          <div class="brand">
            <img class="logo" src="/assets/tsera-logo.png" alt="TSera logo" loading="eager" decoding="async" />
            <div class="wordmark">
              <h1 class="headline">Hello TSera</h1>
              <div class="kicker">The Next Era of TypeScript Fullstack</div>
              <p class="sub">
                Your project is initialized and ready to ship.<br>
                Unified. Simple. Automated. Full TypeScript.
              </p>
            </div>
          </div>

          <div class="cta-row" aria-label="Quick actions">
            <a class="btn primary" href="/docs/">Read the docs</a>
            <a class="btn ghost" href="https://github.com/">GitHub</a>
          </div>

          <div class="terminal" aria-label="TSera commands">
            <div class="terminal-h">
              <span class="dots" aria-hidden="true">
                <i class="dot red"></i><i class="dot yellow"></i><i class="dot green"></i>
              </span>
              <span class="terminal-title">TSera CLI</span>
              <span class="terminal-hint">Click a line to copy</span>
            </div>

            <div class="terminal-b" role="list">
              ${termLine("tsera init <name>", "tsera init demo", "Scaffold a new project")}
              ${termLine("tsera dev", "tsera dev", "Start dev watcher (plan → apply)")}
              ${termLine("tsera doctor", "tsera doctor", "Validate environment & artifacts")}
              ${termLine("tsera update", "tsera update", "Update the CLI")}
            </div>
          </div>
        </div>
      </header>

      <!-- STACK FIRST -->
      <section class="section" aria-label="Stack status">
        <div class="section-h">
          <h2>Test Stack status</h2>
          <p>Minimal by design. Scalable by default.</p>
        </div>

        <div class="cards">
          <div class="card">
            <div class="card-h"><span class="dot ok" aria-hidden="true"></span><span>Runtime</span></div>
            <div class="card-v">Deno</div>
            <div class="card-s">Detected / ready</div>
          </div>

          <div class="card">
            <div class="card-h"><span class="dot ok" aria-hidden="true"></span><span>API</span></div>
            <div class="card-v">Hono</div>
            <div class="card-s">Entry point wired</div>
          </div>

          <div class="card">
            <div class="card-h"><span class="dot ok" aria-hidden="true"></span><span>Front</span></div>
            <div class="card-v">Lume</div>
            <div class="card-s">Build & serve working</div>
          </div>

          <div class="card">
            <div class="card-h"><span class="dot warn" aria-hidden="true"></span><span>Quality Gate</span></div>
            <div class="card-v">Pending</div>
            <div class="card-s">Run <code>tsera doctor</code> to confirm</div>
          </div>
        </div>
      </section>

      <!-- PRINCIPLES / UPDATED INFO -->
      <section class="section about-s" aria-label="About TSera">
        <div class="about-grid">
          <div class="about-left">
            <div class="eyebrow">What TSera is</div>
            <h2 class="about-title">Not a framework. A TypeScript DX environment.</h2>
            <p class="about-lead">
              TSera guarantees <strong>Continuous Coherence (CC)</strong>: business code, schemas, tests, docs and deploy
              artifacts stay <strong>automatically aligned</strong> — without manual sync rituals.
            </p>

            <div class="about-points" aria-label="Highlights">
              <div class="point">
                <div class="point-k">One declaration</div>
                <div class="point-v">Entities drive types, validation, migrations, docs and smoke tests.</div>
              </div>
              <div class="point">
                <div class="point-k">Reactive dev</div>
                <div class="point-v">Watch → diff → idempotent apply. Prescriptive logs. Zero ceremony.</div>
              </div>
              <div class="point">
                <div class="point-k">Scales by design</div>
                <div class="point-v">A reactive DAG regenerates only what changed (cache + parallelism).</div>
              </div>
            </div>

            <div class="about-footnote">
              <span class="badge">Promise</span>
              <span>Industrialize without complexity. Ship fast, clean, reproducibly.</span>
            </div>
          </div>

          <div class="about-right">
            <div class="cc-panel" aria-label="Continuous Coherence">
              <div class="cc-h">
                <div class="cc-title">Continuous Coherence (CC)</div>
                <div class="cc-sub">Always aligned, measurable, enforceable.</div>
              </div>

              <div class="cc-kpis" role="list" aria-label="Key metrics">
                <div class="kpi" role="listitem">
                  <div class="kpi-k">Coherence</div>
                  <div class="kpi-v"><span class="accent">100%</span> target</div>
                </div>
                <div class="kpi" role="listitem">
                  <div class="kpi-k">Incoherence time</div>
                  <div class="kpi-v"><span class="accent">↓</span> seconds</div>
                </div>
                <div class="kpi" role="listitem">
                  <div class="kpi-k">Auto-fix rate</div>
                  <div class="kpi-v"><span class="accent">↑</span> safe fixes</div>
                </div>
              </div>

              <div class="cc-note">
                In strict environments, critical drift can block release — with a clear message and a safe fix proposal.
              </div>
            </div>
          </div>
        </div>
      </section>
      <footer class="foot">
        <span class="muted">TSera — The Next Era of TypeScript Fullstack</span>
        <span class="sep" aria-hidden="true">•</span>
        <a class="link" href="https://tsera.dev">tsera.dev</a>
      </footer>
    </main>
  `
}

function termLine(label: string, cmd: string, desc: string): string {
  return /* html */ `
    <button class="tline" type="button" data-copy="${escapeAttr(cmd)}" role="listitem" aria-label="Copy: ${escapeAttr(cmd)}">
      <span class="prompt" aria-hidden="true">$</span>
      <span class="cmd">${escapeHtml(label)}</span>
      <span class="desc">${escapeHtml(desc)}</span>
      <span class="copy" aria-hidden="true">Copy</span>
    </button>
  `;
}

function escapeAttr(input: string): string {
  return escapeHtml(input);
}

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}