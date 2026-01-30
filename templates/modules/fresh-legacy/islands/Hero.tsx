/**
 * Hero Island Component
 * Immersive hero section with animated background and interactive elements
 */

import { useEffect, useState } from "preact/hooks";

interface HeroProps {
  title?: string;
  subtitle?: string;
  ctaText?: string;
  ctaLink?: string;
}

export default function Hero(props: HeroProps) {
  const [mousePosition, setMousePosition] = useState({ x: 50, y: 50 });
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);

    const handleMouseMove = (e: Event) => {
      const target = e.target;
      if (target instanceof HTMLElement) {
        const rect = target.getBoundingClientRect();
        const win = target.ownerDocument?.defaultView || window;
        setMousePosition({
          x: (rect.left / win.innerWidth) * 100,
          y: (rect.top / win.innerHeight) * 100,
        });
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const title = props.title || "Build Future with TSera";
  const subtitle = props.subtitle ||
    "Entity-driven development with automatic code generation. Type-safe everything.";
  const ctaText = props.ctaText || "Get Started";
  const ctaLink = props.ctaLink || "/docs";

  return (
    <section class="hero-section relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Animated Background */}
      <div
        class="hero-bg absolute inset-0 grid-bg"
        style={{
          background:
            `radial-gradient(circle at ${mousePosition.x}% ${mousePosition.y}%, rgba(0, 212, 255, 0.1) 0%, transparent 50%)`,
        }}
      />

      {/* Particles */}
      <div class="particles" aria-hidden="true">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            class="particle"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 10}s`,
              animationDuration: `${10 + Math.random() * 10}s`,
            }}
          />
        ))}
      </div>

      {/* Gradient Overlay */}
      <div class="hero-gradient absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0a0a0f]" />

      {/* Content */}
      <div class="container relative z-10">
        <div
          class={`hero-content text-center max-w-4xl mx-auto ${
            isVisible ? "animate-fade-in-up" : ""
          }`}
        >
          {/* Title */}
          <h1 class="hero-title text-6xl md:text-7xl font-bold mb-6 text-gradient">
            {title}
          </h1>

          {/* Subtitle */}
          <p class="hero-subtitle text-xl md:text-2xl text-gray-400 mb-8 max-w-2xl mx-auto">
            {subtitle}
          </p>

          {/* CTA Button */}
          <div class="hero-cta flex justify-center gap-4">
            <a
              href={ctaLink}
              class="btn btn-primary btn-animate text-lg px-8 py-4"
            >
              {ctaText}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </a>
            <a
              href="https://github.com/tsera/tsera"
              target="_blank"
              rel="noopener noreferrer"
              class="btn btn-secondary text-lg px-8 py-4"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              GitHub
            </a>
          </div>

          {/* Feature Pills */}
          <div class="hero-features mt-12 flex flex-wrap justify-center gap-3">
            {[
              "Deno v2",
              "Type-Safe",
              "Auto-Generated",
              "Modern Stack",
            ].map((feature, index) => (
              <span
                key={feature}
                class={`feature-pill inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium glass-card-sm animate-fade-in`}
                style={{ animationDelay: `${600 + index * 100}ms` }}
              >
                <span class="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                {feature}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div class="scroll-indicator absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="text-gray-500"
        >
          <path d="M12 5v14" />
          <path d="m19 12-7 7-7-7" />
        </svg>
      </div>

      <style>
        {`
        .hero-section {
          background: linear-gradient(135deg, #0a0a0f 0%, #12121a 100%);
        }

        .hero-bg {
          opacity: 0.6;
          transition: background 0.3s ease;
        }

        .hero-gradient {
          background: linear-gradient(to bottom, transparent 0%, rgba(10, 10, 15, 0.8) 80%, #0a0a0f 100%);
        }

        .hero-title {
          background: linear-gradient(135deg, #00d4ff 0%, #7b2cbf 50%, #ff006e 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: gradientShift 3s ease infinite;
          background-size: 200% 200%;
        }

        .feature-pill {
          background: rgba(0, 212, 255, 0.1);
          border: 1px solid rgba(0, 212, 255, 0.2);
          color: #00d4ff;
          backdrop-filter: blur(10px);
          transition: all 0.3s ease;
        }

        .feature-pill:hover {
          background: rgba(0, 212, 255, 0.2);
          border-color: rgba(0, 212, 255, 0.4);
          transform: translateY(-2px);
        }

        .particle {
          position: absolute;
          width: 3px;
          height: 3px;
          background: #00d4ff;
          border-radius: 50%;
          opacity: 0;
          animation: particleFloat 15s infinite linear;
        }

        @keyframes particleFloat {
          0% {
            opacity: 0;
            transform: translateY(100vh) rotate(0deg);
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translateY(-100vh) rotate(360deg);
          }
        }

        @keyframes gradientShift {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }
      `}
      </style>
    </section>
  );
}
