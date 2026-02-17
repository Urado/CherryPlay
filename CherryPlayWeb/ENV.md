# Переменные окружения CherryPlayWeb

Переменные, доступные в приложении через Vite: префикс **`VITE_`** (см. [Vite Env Variables](https://vitejs.dev/guide/env-and-mode.html)).

---

## VITE_API_URL

- **Описание:** базовый URL API сервера (CherryPlayServer). Используется для REST-запросов и подключения к SignalR Hub (`{baseUrl}/partyHub`).
- **Пример:** `http://localhost:5000`
- **По умолчанию:** в коде может быть fallback (например, `http://localhost:5000` для разработки); для продакшена задаётся при сборке или в конфигурации окружения.
- **Задание:**
  - Локально: создать файл `.env` в корне CherryPlayWeb: `VITE_API_URL=http://localhost:5000`
  - Сборка/деплой: передать переменную в процессе сборки (`VITE_API_URL=https://api.example.com npm run build`).

После изменения переменных окружения нужна пересборка (`npm run build`) или перезапуск dev-сервера (`npm run dev`).
