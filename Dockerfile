FROM node:26.7.0-bookworm-slim AS base

RUN npm install --global pnpm@12.21.0
WORKDIR /app

FROM base AS build

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY . .
RUN pnpm exec nuxt prepare && NITRO_PRESET=node-server pnpm build

FROM base AS runtime

ENV NODE_ENV=production
ENV HOST=0.0.0.0

COPY --from=build --chown=node:node /app/.output ./.output
COPY --from=build --chown=node:node /app/config ./config

# Keep the existing migration and operator commands available in the same image.
# They use source schemas and development tooling (including drizzle-kit).
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml /app/drizzle.config.ts ./
COPY --from=build --chown=node:node /app/drizzle ./drizzle
COPY --from=build --chown=node:node /app/server ./server
COPY --from=build --chown=node:node /app/shared ./shared
COPY --from=build --chown=node:node /app/layers ./layers
COPY --from=build --chown=node:node /app/scripts ./scripts

USER node
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
