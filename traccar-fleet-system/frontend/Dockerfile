FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci --legacy-peer-deps

COPY . .
# CI passes BUILD_REF so BuildKit cannot reuse a stale `npm run build` layer for the same git SHA.
ARG BUILD_REF=local
# Baked into the SPA for production (override in CI with build-args if the public URL changes).
ARG VITE_API_BASE_URL=https://numz.site
ARG VITE_TRACCAR_PREFIX=/traccar
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_TRACCAR_PREFIX=$VITE_TRACCAR_PREFIX
RUN echo "build:${BUILD_REF}" && npm run build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
