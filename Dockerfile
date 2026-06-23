# Production image for the Next.js web tier (all-in-one VPS deploy).
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
# ca-certificates for TLS to Postgres if you later use a managed DB.
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY --from=build /app ./
EXPOSE 3000
# Apply DB migrations (idempotent) then start the server.
CMD ["sh", "-c", "npm run db:migrate && npm run start -- -p 3000 -H 0.0.0.0"]
