FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json vite.config.ts ./
COPY apps/web ./apps/web
COPY assets ./assets
RUN npm run build

FROM node:24-bookworm-slim AS runtime
ARG REVISION=unknown
LABEL org.opencontainers.image.source="https://github.com/CodeAIX/LearningAgent" \
      org.opencontainers.image.description="医学学习资源门户 · 单容器、可编辑、可备份" \
      org.opencontainers.image.version="1.0.0" \
      org.opencontainers.image.revision=$REVISION
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8080 DATA_DIR=/data
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force && mkdir /data && chown node:node /data
COPY apps/api ./apps/api
COPY --from=build /app/dist/web ./dist/web
COPY assets ./assets
USER node
EXPOSE 8080
HEALTHCHECK --interval=20s --timeout=5s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:8080/health/ready').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "apps/api/server.mjs"]
