# Трекер задач CherryPlay

Короткий backlog идей и техдолга. По мере выполнения переносите пункты в историю коммитов или помечайте статус.

## Очередь

### CherryPlayList: убрать Jest-костыль `stripImportMeta`

**Суть:** `CherryPlayList/tests/transformers/stripImportMeta.cjs` подменяет Vite-`import.meta` перед `ts-jest`, иначе suites падают при резолве `@cherryplay/components` → темы (spring-cross-step и т.п.). Это обход несовместимости Jest/CJS с Vite ESM, не прод-код.

**Минимальный путь избавиться:**

1. **Предпочтительно:** перевести unit-тесты CherryPlayList на **Vitest** (тот же Vite-пайплайн, `import.meta` из коробки) → удалить transformer и запись `transform` в `jest.config.ts`.
2. **Или** не тянуть в Jest исходники Components с ассетами/`import.meta`: mock `@cherryplay/components` целиком / тонкий test-stub без тем → тогда transformer не нужен, но покрытие интеграций с темами слабее.
3. После снятия костыля — прогон `npm test` в CherryPlayList; опционально добавить шаг в CI (сейчас List unit-тесты в PR workflows нет).

**Статус:** не начато (костыль временно нужен, тесты зелёные)

---

### Унификация ответов сервера по вечеринкам темы/карточки

**Суть:** сейчас `PartyDto` и `PublicPartyDto` дублируют длинный пересечение полей; оба уже берут `CustomizationSettings` из одной сущности через `PartyMapper`, но поддерживать два record вручную рискованно. Клиенты (CherryPlayWeb, CherryPlayList) описывают типы отдельно, на вебе `customizationSettings` уже, чем фактический JSON (вложенные объекты для базовой темы). Контракт ответа `PartyDto` по `customizationSettings` для организаторского GET закрыт в `CONTRACTS.md`; этот пункт — про рефакторинг дублирования record’ов и выравнивание TS.

**Минимальный путь:**

1. **Сервер (C#):** вынести общий блок полей (тема + кастомизация + карточка мероприятия) в nested record / общий тип и собирать `PartyDto` / `PublicPartyDto` из «общая часть + специфика эндпоинта», без двух полных копий списка полей.
2. **Контракт:** зафиксировать в `CONTRACTS.md` или OpenAPI одну секцию: `partyThemeId` + опционально `customizationSettings` для всех ответов, где они есть.
3. **Фронты:** выровнять TS — общий фрагмент типов (`PartyThemeFields` и т.д.) и `customizationSettings` как `Record<string, unknown>` или явная схема для basic theme.

**Статус:** не начато

---

## Сделано

- **PartyDto / PartyMapper:** в ответ организатора снова входит `CustomizationSettings` (поле отсутствовало из‑за отката/расхождения); см. `CONTRACTS.md` → **PartyDto**.
