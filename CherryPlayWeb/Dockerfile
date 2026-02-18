FROM node:20-alpine AS build
WORKDIR /app

# Копируем package.json и package-lock.json для CherryPlayComponents
COPY CherryPlayComponents/package.json CherryPlayComponents/package-lock.json ./CherryPlayComponents/
COPY CherryPlayComponents ./CherryPlayComponents

WORKDIR /app/CherryPlayComponents
RUN npm ci

RUN npm run lint || (echo "Linting failed for CherryPlayComponents! Please fix linting errors." && exit 1)

RUN npm run build
WORKDIR /app

# Копируем package.json и package-lock.json для установки зависимостей CherryPlayWeb
# Важно: package-lock.json должен быть явно указан для гарантии одинаковых версий зависимостей
COPY CherryPlayWeb/package.json CherryPlayWeb/package-lock.json ./

# Используем --ignore-scripts чтобы пропустить prepare hook (husky не нужен в Docker)
# Скрипт prepare-husky.mjs будет скопирован позже, но он не нужен для Docker сборки
# npm ci использует package-lock.json для установки точных версий зависимостей
RUN npm ci --ignore-scripts

# Копируем остальные файлы (node_modules уже установлены и не будут перезаписаны благодаря .dockerignore)
COPY CherryPlayWeb/ .

# Передаем переменные окружения для Vite (build-time переменные)
# ARG позволяет передать переменные во время сборки образа
ARG VITE_API_URL
ARG VITE_SIGNALR_URL
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SIGNALR_URL=$VITE_SIGNALR_URL

RUN npm run lint:fix && npm run lint || (echo "Linting failed for CherryPlayWeb! Please fix linting errors." && exit 1)

RUN npm run build

FROM nginx:alpine
WORKDIR /usr/share/nginx/html

RUN rm -rf ./*

COPY --from=build /app/dist .

COPY CherryPlayWeb/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
