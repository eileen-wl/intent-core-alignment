FROM node:20-slim

RUN corepack enable

WORKDIR /repo
COPY . .

RUN pnpm install --frozen-lockfile

WORKDIR /repo/apps/web
EXPOSE 3000
CMD ["pnpm", "dev"]
