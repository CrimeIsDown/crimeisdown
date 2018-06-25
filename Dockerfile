FROM node:8 AS build-env

RUN npm install -g yarn
RUN yarn global add ember-cli

WORKDIR /usr/src/app

COPY package.json yarn.lock ./

RUN yarn install

COPY . .

RUN ember build

FROM nginx:1-alpine

COPY --from=build-env /usr/src/app/dist /usr/share/nginx/html

