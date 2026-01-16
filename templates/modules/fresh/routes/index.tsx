/**
 * Homepage Route
 * Main landing page for TSera with hero, dashboard, and features sections
 */

import Hero from "../islands/Hero.tsx";
import Dashboard from "../islands/Dashboard.tsx";

export default function Home() {
  return (
    <>
      <head>
        <title>TSera - Entity-Driven Development Framework</title>
        <meta name="description" content="Build future-ready applications with TSera. Entity-driven development with automatic code generation, type-safe everything, and modern Deno v2 stack." />
        <meta name="keywords" content="TSera, Deno, Fresh, Hono, Entity-Driven, Code Generation, TypeScript" />
        <link rel="stylesheet" href="/static/styles.css" />
        <link rel="stylesheet" href="/static/animations.css" />
      </head>

      {/* Hero Section */}
      <Hero />

      {/* Dashboard Section */}
      <Dashboard />

      {/* Features Section */}
      <section class="features-section py-16">
        <div class="container">
          {/* Section Header */}
          <div class="features-header mb-12 text-center">
            <h2 class="text-4xl font-bold mb-4 text-gradient">
              Why TSera?
            </h2>
            <p class="text-lg text-gray-400 max-w-2xl mx-auto">
              A modern framework that combines entity-driven development with automatic code generation
            </p>
          </div>

          {/* Features Grid */}
          <div class="features-grid grid grid-3 gap-8">
            {/* Feature 1 */}
            <FeatureCard
              icon={
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              }
              title="Entity-Driven Development"
              description="Define your entities once and let TSera generate everything else automatically. Your entities become the single source of truth for your entire application."
            />

            {/* Feature 2 */}
            <FeatureCard
              icon={
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <polyline points="16 18 22 12 16 6" />
                  <polyline points="8 6 2 12 8 18" />
                </svg>
              }
              title="Automatic Code Generation"
              description="TSera automatically generates validation schemas, database migrations, API specifications, documentation, and tests from your entity definitions."
            />

            {/* Feature 3 */}
            <FeatureCard
              icon={
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <polygon points="12 2 2 7 12 12 22 7 12 2" />
                  <polyline points="2 17 12 22 22 17" />
                  <polyline points="2 12 12 17 22 12" />
                </svg>
              }
              title="Type-Safe Everything"
              description="From entity definitions to API endpoints, everything is type-safe. Catch errors at compile time, not runtime. Full TypeScript support with Zod validation."
            />

            {/* Feature 4 */}
            <FeatureCard
              icon={
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1 4 10" />
                </svg>
              }
              title="Modern Deno v2 Stack"
              description="Built on Deno v2 with modern JavaScript standards. ESM-only, no Node.js compatibility layers, and native TypeScript support out of the box."
            />

            {/* Feature 5 */}
            <FeatureCard
              icon={
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  <path d="M18 12H6" />
                </svg>
              }
              title="Built-in CI/CD"
              description="Generate complete CI/CD pipelines for GitHub Actions, Docker, Cloudflare, Deno Deploy, and Vercel. Deploy your applications with a single command."
            />

            {/* Feature 6 */}
            <FeatureCard
              icon={
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              }
              title="Secure Secrets Management"
              description="Type-safe environment configuration with encrypted KV store. Securely manage secrets across development, staging, and production environments."
            />
          </div>
        </div>

        <style>{`
          .features-section {
            background: linear-gradient(135deg, #12121a 0%, #0a0a0f 100%);
          }

          .features-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
            gap: 2rem;
          }

          @media (max-width: 1024px) {
            .features-grid {
              grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            }
          }

          @media (max-width: 768px) {
            .features-grid {
              grid-template-columns: 1fr;
            }
          }
        `}</style>
      </section>

      {/* CTA Section */}
      <section class="cta-section py-16">
        <div class="container">
          <div class="cta-content glass-card p-12 text-center">
            <h2 class="text-3xl font-bold mb-4 text-gradient">
              Ready to Build the Future?
            </h2>
            <p class="text-lg text-gray-400 mb-8 max-w-2xl mx-auto">
              Get started with TSera today and experience the power of entity-driven development
            </p>
            <div class="cta-buttons flex justify-center gap-4">
              <a
                href="/docs"
                class="btn btn-primary btn-lg"
              >
                Get Started
              </a>
              <a
                href="https://github.com/tsera/tsera"
                target="_blank"
                rel="noopener noreferrer"
                class="btn btn-secondary btn-lg"
              >
                View on GitHub
              </a>
            </div>
          </div>
        </div>

        <style>{`
          .cta-section {
            background: linear-gradient(135deg, #0a0a0f 0%, #12121a 100%);
          }

          .cta-content {
            max-width: 800px;
            margin: 0 auto;
          }

          .cta-buttons {
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            gap: 1rem;
          }

          @media (max-width: 640px) {
            .cta-buttons {
              flex-direction: column;
            }

            .cta-buttons .btn {
              width: 100%;
            }
          }
        `}</style>
      </section>

      {/* Footer */}
      <footer class="footer py-8 border-t border-gray-800">
        <div class="container">
          <div class="footer-content flex flex-col md:flex-row items-center justify-between gap-4">
            <div class="footer-brand flex items-center gap-2">
              <span class="text-xl font-bold text-gradient">
                TSera
              </span>
              <span class="text-gray-500">
                © 2024
              </span>
            </div>
            <div class="footer-links flex items-center gap-6 text-sm text-gray-400">
              <a href="/docs" class="hover:text-white transition-colors">
                Documentation
              </a>
              <a
                href="https://github.com/tsera/tsera"
                target="_blank"
                rel="noopener noreferrer"
                class="hover:text-white transition-colors"
              >
                GitHub
              </a>
              <a
                href="https://github.com/tsera/tsera/issues"
                target="_blank"
                rel="noopener noreferrer"
                class="hover:text-white transition-colors"
              >
                Issues
              </a>
            </div>
          </div>
        </div>

        <style>{`
          .footer {
            background: #0a0a0f;
          }

          .footer-brand {
            font-weight: 600;
          }

          .footer-links a {
            transition: color 0.2s ease;
          }

          @media (max-width: 768px) {
            .footer-content {
              text-align: center;
            }

            .footer-links {
              flex-direction: column;
              gap: 0.5rem;
            }
          }
        `}</style>
      </footer>
    </>
  );
}

interface FeatureCardProps {
  icon: any;
  title: string;
  description: string;
}

function FeatureCard(props: FeatureCardProps) {
  const { icon, title, description } = props;

  return (
    <div class="feature-card glass-card p-8 card-hover scroll-reveal">
      {/* Icon */}
      <div
        class="feature-icon flex items-center justify-center w-16 h-16 rounded-2xl mb-6"
        style={{
          background: "linear-gradient(135deg, rgba(0, 212, 255, 0.1), rgba(123, 44, 191, 0.1))",
          border: "1px solid rgba(0, 212, 255, 0.2)",
        }}
      >
        <span
          style={{
            color: "var(--color-accent-primary)",
          }}
        >
          {icon}
        </span>
      </div>

      {/* Title */}
      <h3 class="text-xl font-bold mb-4 text-white">
        {title}
      </h3>

      {/* Description */}
      <p class="text-gray-400 leading-relaxed">
        {description}
      </p>
    </div>
  );
}
