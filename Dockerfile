# Render builds from the Git repository root by default.
# This delegates to the API under mun-fantasy/backend (same paths as backend/Dockerfile).
FROM node:22-bookworm-slim
WORKDIR /app

COPY mun-fantasy/backend/package.json mun-fantasy/backend/package-lock.json ./
RUN npm ci

COPY mun-fantasy/backend/prisma ./prisma
COPY mun-fantasy/backend/seed ./seed
COPY mun-fantasy/backend/src ./src
COPY mun-fantasy/backend/tsconfig.json ./

RUN npx prisma generate && npm run build

EXPOSE 4000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
