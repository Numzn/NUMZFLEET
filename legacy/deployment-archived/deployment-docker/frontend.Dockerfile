FROM node:20-alpine AS builder
WORKDIR /app

COPY traccar-fleet-system/frontend/package*.json ./
COPY traccar-fleet-system/frontend/.npmrc ./
RUN npm ci

COPY traccar-fleet-system/frontend/ ./

ARG VITE_TRACCAR_PREFIX=/traccar
ENV VITE_TRACCAR_PREFIX=${VITE_TRACCAR_PREFIX}

RUN npm run build

FROM nginx:1.27-alpine
# Repo-root build: docker build -f legacy/deployment-docker/frontend.Dockerfile .
COPY legacy/deployment-docker/frontend-nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
