# syntax = docker/dockerfile:1

# Node runs the TypeScript in src/ directly (type stripping), so there's no
# build step. The game database lives on the Fly volume at /data.
FROM docker.io/library/node:24.21.0-slim
WORKDIR /app
RUN npm install -g pnpm@11.9.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile
COPY src ./src
COPY static ./static
COPY README.md ./
ENV NODE_ENV=production DATA_DIR=/data
CMD ["node", "src/server.ts"]
