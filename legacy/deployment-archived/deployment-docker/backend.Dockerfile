FROM node:20-alpine
WORKDIR /app

COPY fuel-api/package*.json ./
RUN npm ci --omit=dev

COPY fuel-api/ ./

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server.js"]
