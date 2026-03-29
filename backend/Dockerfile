FROM node:20-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps
COPY prisma ./prisma
RUN npx prisma generate
COPY . .
RUN npm run build

FROM node:20-alpine
RUN apk add --no-cache openssl ffmpeg libreoffice-common libreoffice-writer libreoffice-calc libreoffice-impress
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/push-schema.js ./push-schema.js
RUN mkdir -p storage/avatars storage/users storage/attachments storage/clips storage/covers
EXPOSE 3001
ENV NODE_ENV=production
CMD ["sh", "-c", "node push-schema.js; exec node dist/index.js"]
