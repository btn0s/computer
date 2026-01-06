import type { FastifyInstance } from 'fastify'
import { env } from '../../env.js'

export async function landingRoutes(fastify: FastifyInstance) {
  fastify.get('/', async (_request, reply) => {
    return reply.type('text/html').send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Computer</title>
          <style>
            * { box-sizing: border-box; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              max-width: 800px;
              margin: 0 auto;
              padding: 60px 20px;
              background: #fafafa;
              color: #1a1a1a;
            }
            h1 { font-size: 2.5rem; margin-bottom: 0.5rem; }
            .subtitle { color: #666; font-size: 1.2rem; margin-bottom: 2rem; }
            .install-btn {
              display: inline-block;
              background: #4A154B;
              color: white;
              padding: 14px 28px;
              border-radius: 8px;
              text-decoration: none;
              font-weight: 600;
              font-size: 1.1rem;
              transition: background 0.2s;
            }
            .install-btn:hover { background: #611f69; }
            .features {
              margin-top: 3rem;
              display: grid;
              gap: 1.5rem;
            }
            .feature {
              background: white;
              padding: 1.5rem;
              border-radius: 8px;
              border: 1px solid #e0e0e0;
            }
            .feature h3 { margin-top: 0; }
            .feature p { color: #666; margin-bottom: 0; }
            code {
              background: #f0f0f0;
              padding: 2px 6px;
              border-radius: 4px;
              font-size: 0.9em;
            }
            footer {
              margin-top: 4rem;
              color: #999;
              font-size: 0.9rem;
            }
            footer a { color: #666; }
          </style>
        </head>
        <body>
          <h1>Computer</h1>
          <p class="subtitle">Slack-native agent harness for Cursor Background Agents</p>

          <a href="${env.BASE_URL}/slack/oauth/install" class="install-btn">
            Add to Slack
          </a>

          <div class="features">
            <div class="feature">
              <h3>Channel-bound repos</h3>
              <p>Bind each Slack channel to a GitHub repo. Messages automatically resolve to the right context.</p>
            </div>
            <div class="feature">
              <h3>Just mention @Computer</h3>
              <p>Describe what you want and Computer dispatches a Cursor agent to implement it and open a PR.</p>
            </div>
            <div class="feature">
              <h3>Your Cursor API key</h3>
              <p>Each workspace uses their own Cursor API key. Run <code>/computer connect</code> after install.</p>
            </div>
          </div>

          <footer>
            <p>Open source on <a href="https://github.com/your-org/computer">GitHub</a></p>
          </footer>
        </body>
      </html>
    `)
  })
}
