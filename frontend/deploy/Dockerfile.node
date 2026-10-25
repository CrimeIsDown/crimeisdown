FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY dist ./dist
ENV HOST=0.0.0.0 PORT=4321 NODE_ENV=production
USER node
EXPOSE 4321
CMD ["node", "./dist/server/entry.mjs"]
