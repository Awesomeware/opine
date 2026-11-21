# Running and debugging locally

Complete the [local setup](../README.md#local-development) first: use the pinned Node/pnpm versions, install dependencies, configure `.env`, start PostgreSQL and apply migrations. Install Zed's [Vue extension](https://zed.dev/docs/languages/vue) for Vue editing support. Its JavaScript/TypeScript debugger is built in.

Nuxt runs the Vite frontend and Nitro backend together. PostgreSQL runs separately in Docker Compose. From the repository root:

| Command           | Behavior                                                        |
| ----------------- | --------------------------------------------------------------- |
| `pnpm dev:local`  | Start/wait for PostgreSQL, then run Nuxt.                       |
| `pnpm dev:debug`  | Start/wait for PostgreSQL, then run Nuxt with server debugging. |
| `pnpm db:up`      | Start/wait for PostgreSQL only.                                 |
| `pnpm db:migrate` | Apply pending migrations to the configured database.            |
| `pnpm db:stop`    | Stop PostgreSQL while preserving its volume.                    |

The app is at `http://localhost:3000`. Both combined run commands refuse to take over an existing Nuxt server or silently switch to another app port. Stop your existing `pnpm dev` before switching to debug mode. The database remains running after you stop Nuxt so sessions and data survive restarts.

Run commands do not apply migrations or seed data. For a fresh database, run `pnpm db:up` and `pnpm db:migrate` first; `pnpm db:seed` adds optional example content. Repeat `db:migrate` after adding or pulling migrations. See [Creating and undoing migrations](migrations.md).

## Run in Zed

Open the repository root in Zed. Use the command palette's **task: spawn** action and choose **Opine: run (database + app)**. The checked-in [.zed/tasks.json](../.zed/tasks.json) also provides database start/stop and explicit migration tasks. Task output appears in Zed's terminal.

Zed needs `node`, `pnpm` and `docker` on its task environment's `PATH`. If a desktop-launched Zed cannot find your nvm installation, launch it from a shell after `nvm use` with `zed .`. No machine-specific executable paths or credentials are checked into the project.

## Debug server and browser code

1. Run **Opine: run for debugging (database + app)** through **task: spawn**, and wait for Nuxt to be ready.
2. Press **F4** / **debugger: start** and choose **Opine: attach server**.
3. Start another debug session and choose **Opine: debug browser**. This launches Chrome/Chromium at the app URL. Use that browser for frontend breakpoints; an unrelated existing browser tab is not attached.

The two profiles live in [.zed/debug.json](../.zed/debug.json). They use Zed's [JavaScript debugger](https://zed.dev/docs/languages/javascript#debugging), selecting Node or Chrome as appropriate. Keep both sessions open to step from a browser action into its API handler, switching the active session as needed. Network requests cross debugger sessions; a single Step Into does not cross HTTP.

The browser profile maps Nuxt's `/_nuxt/` URLs to `app/` and Vite's `/_nuxt/@fs/` URLs to absolute filesystem paths. The latter is needed for feature components under `layers/`; without it, their Vue breakpoints may point at nonexistent files under `app/`.

Set breakpoints by clicking beside a source line. For a server check, put a breakpoint inside `server/api/ready.get.ts` before its database query, then request `/api/ready` in the browser. For a frontend check, put one inside a Vue event handler such as `FeedbackPostEditor.vue`'s `save()` and submit that form. Use Zed's Step Over, Step Into, Continue, variables and call-stack controls. The application waits while the relevant runtime is paused.

Server application code uses inspector port **9229**, bound to loopback. The installed Nuxt CLI uses **9230** for its own configuration/build process; attach to 9229 for API handlers and feature use cases. The server profile reconnects after Nitro replaces its server worker. Browser source maps are already enabled in Nuxt development mode, and server maps are enabled by default; production client maps do not need enabling. See [Nuxt debugging](https://nuxt.com/docs/4.x/guide/going-further/debugging).

Stopping an attached debugger disconnects it; it does not stop the run task. Stop Nuxt with **Ctrl-C** in its task terminal, and use **Opine: stop database (keep data)** when finished. No task removes database volumes.

## Troubleshooting

- An unbound breakpoint may mean its module has not loaded yet. Open the relevant page or trigger its API request. Put the breakpoint on executable TypeScript inside `<script setup>`, rather than a type declaration or CSS rule.
- If the server cannot attach, check the run task's inspector output and whether another process occupies 9229/9230. These are local debugging ports, not public listeners.
- If Chrome is not found, install Chrome/Chromium or set `runtimeExecutable` in your local browser debug profile to its executable path. Sign in inside the debugger's browser profile when testing authenticated actions.
- Keep the browser profile's URL aligned with `BETTER_AUTH_URL` and your dev port. If changing the inspector port, update both `dev:debug` and the server attach profile.
- Startup failures are visible in the task terminal. `/api/ready` separates database connectivity failures from frontend issues; a fresh but unmigrated database can pass connectivity and still fail feature queries.

Zed [tasks](https://zed.dev/docs/tasks) own the long-running dev process; [debug sessions](https://zed.dev/docs/debugger) attach separately. This keeps process startup, shutdown and debugger reconnection explicit without putting a perpetual dev server in a pre-debug build task.
