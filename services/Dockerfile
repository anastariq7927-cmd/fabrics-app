# One image recipe for every microservice: docker build --build-arg SERVICE=content -f services/Dockerfile .
FROM node:22-alpine
ARG SERVICE
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY packages/shared ./packages/shared
COPY services/${SERVICE} ./services/${SERVICE}
RUN npm install --omit=dev --no-audit --no-fund -w services/${SERVICE} --include-workspace-root=false

WORKDIR /app/services/${SERVICE}
USER node
CMD ["node", "src/server.js"]
