FROM node:20-alpine AS builder

RUN apk add --no-cache openssl
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN npx prisma generate
RUN pnpm run build

FROM node:20-alpine

RUN apk add --no-cache openssl

WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma
COPY start.sh ./start.sh
RUN sed -i 's/\r$//' start.sh && chmod +x start.sh

RUN mkdir -p storage/avatars storage/users storage/attachments storage/clips storage/covers

EXPOSE 3001
CMD ["./start.sh"]
