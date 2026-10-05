FROM node:20-alpine AS build
WORKDIR /app

COPY CherryPlayComponents/package.json CherryPlayComponents/package-lock.json ./CherryPlayComponents/
COPY CherryPlayComponents ./CherryPlayComponents
COPY eslint-config-cherryplay ./eslint-config-cherryplay

WORKDIR /app/eslint-config-cherryplay
RUN npm ci

WORKDIR /app/CherryPlayComponents
RUN npm ci

RUN npm run lint || (echo "Linting failed for CherryPlayComponents! Please fix linting errors." && exit 1)

RUN npm run build
WORKDIR /app

COPY CherryPlayWeb/package.json CherryPlayWeb/package-lock.json ./CherryPlayWeb/

COPY CherryPlayServer/appsettings.json ./CherryPlayServer/appsettings.json

COPY CherryPlayWeb/ ./CherryPlayWeb/

ARG CLIENT_COMPATIBILITY_SERVER_VERSION
RUN if [ -n "$CLIENT_COMPATIBILITY_SERVER_VERSION" ]; then sed -i -E "s/(\"ServerVersion\"[[:space:]]*:[[:space:]]*\")[^\"]*(\")/\\1${CLIENT_COMPATIBILITY_SERVER_VERSION}\\2/" /app/CherryPlayServer/appsettings.json; fi

WORKDIR /app/CherryPlayWeb

RUN npm ci --ignore-scripts

ARG VITE_API_URL
ARG VITE_SIGNALR_URL
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SIGNALR_URL=$VITE_SIGNALR_URL

RUN npm run lint:fix && npm run lint || (echo "Linting failed for CherryPlayWeb! Please fix linting errors." && exit 1)

RUN npm run build

FROM nginx:alpine
WORKDIR /usr/share/nginx/html

RUN rm -rf ./*

COPY --from=build /app/CherryPlayWeb/dist .

COPY CherryPlayWeb/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
