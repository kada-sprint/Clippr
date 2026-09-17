FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates openssl ffmpeg fonts-dejavu-core
WORKDIR /app/backend

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci && npm run db:generate

COPY src ./src
COPY scripts ./scripts
COPY server.js worker.js production.js ./
ENV MEDIA_ROOT=/app/backend
RUN mkdir -p uploads/videos uploads/audios certs && chown -R node:node uploads certs
USER node
EXPOSE 3000
CMD ["node", "production.js"]
