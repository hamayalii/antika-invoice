# syntax=docker/dockerfile:1

FROM node:20-bookworm-slim AS build
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build -w @antika/shared \
  && npx prisma generate --schema apps/api/prisma/schema.prisma \
  && npm run build -w @antika/api

FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    chromium \
    openssl \
    ca-certificates \
    fonts-noto-core \
    fonts-dejavu-core \
    fontconfig \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app /app
# The print page is served by the web container, but Chromium in this image must
# also resolve the supplied Arkan faces (local() and fallback rendering).
COPY --from=build /app/apps/web/public/fonts/arkan /usr/local/share/fonts/arkan
RUN fc-cache -f
WORKDIR /app/apps/api
EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy --schema prisma/schema.prisma && npx tsx prisma/seed.ts && node dist/index.js"]
