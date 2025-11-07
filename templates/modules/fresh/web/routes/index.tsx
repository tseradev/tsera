/** @jsx h */
import { h } from "npm:preact@10";
import { PageProps } from "jsr:@fresh/core@2";
import Counter from "../islands/Counter.tsx";

export default function Home(props: PageProps) {
  return (
    <html>
      <head>
        <title>TSera App</title>
        <link rel="stylesheet" href="/styles.css" />
      </head>
      <body>
        <main>
          <h1>Welcome to TSera</h1>
          <p>
            This is a Fresh-powered frontend with TSera backend integration.
          </p>

          <section>
            <h2>Interactive Island</h2>
            <Counter start={0} />
          </section>

          <section>
            <h2>API Integration</h2>
            <p>
              Your backend API is available at <code>/api</code>. Try the health check:{" "}
              <a href="/health">/health</a>
            </p>
          </section>

          <section>
            <h3>Learn More</h3>
            <ul>
              <li>
                <a href="https://fresh.deno.dev">Fresh Documentation</a>
              </li>
              <li>
                <a href="https://github.com/yourusername/tsera">TSera Documentation</a>
              </li>
            </ul>
          </section>
        </main>
      </body>
    </html>
  );
}
