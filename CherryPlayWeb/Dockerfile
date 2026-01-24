FROM node:20-alpine AS build
WORKDIR /app

COPY CherryPlayComponents/package*.json ./CherryPlayComponents/
COPY CherryPlayComponents ./CherryPlayComponents

WORKDIR /app/CherryPlayComponents
RUN npm ci

RUN npm run lint || (echo "Linting failed for CherryPlayComponents! Please fix linting errors." && exit 1)

RUN npm run build
WORKDIR /app

COPY CherryPlayWeb/package*.json ./

RUN npm ci

COPY CherryPlayWeb/ .

RUN npm run lint || (echo "Linting failed for CherryPlayWeb! Please fix linting errors." && exit 1)

RUN npm run build

FROM nginx:alpine
WORKDIR /usr/share/nginx/html

RUN rm -rf ./*

COPY --from=build /app/dist .

COPY CherryPlayWeb/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
