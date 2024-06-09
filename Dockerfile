FROM node:20 AS build-env

RUN npm install -g ember-cli

WORKDIR /usr/src/app

COPY package.json package-lock.json ./

RUN npm install

COPY . .

RUN ember build -e production

FROM nginx:1-alpine

COPY --from=build-env /usr/src/app/dist /usr/share/nginx/html

