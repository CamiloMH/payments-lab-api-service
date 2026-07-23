# syntax=docker/dockerfile:1
#
# Build desde la raíz de este repo:
#   docker build -t payments-lab-api .

FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS build
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM base AS runtime
ENV NODE_ENV=production
ENV NODE_OPTIONS=--max-old-space-size=256
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod
COPY --from=build /app/dist ./dist
COPY fixtures ./fixtures
EXPOSE 3001
# SWC emite preservando la carpeta `src/`, así que el entrypoint es dist/src/main.js.
CMD ["node", "dist/src/main.js"]
