FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder /app/shared ./shared

ENV NODE_ENV=production
ENV PORT=5001

EXPOSE 5001

CMD ["sh", "-c", "npm run db:push >/tmp/db-push.log 2>&1 || { echo '[ERROR] db:push failed'; cat /tmp/db-push.log; exit 1; }; rm -f /tmp/db-push.log; npm start"]
