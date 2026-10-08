# Build Resources

## Иконка CherryPashka

`icon.png` — утверждённый PNG-мастер 1024×1024 с прозрачными внешними углами (круглый знак с профилем черепашки в наушниках, вишнями и тёмной плиткой). Вокруг знака оставлено безопасное поле, чтобы он не обрезался в системных масках и маленьких размерах.

- `icon.ico` — Windows, 16/24/32/48/64/128/256 px.
- `icon.icns` — macOS, представления до 1024 px.
- `icon.png` — Linux и macOS Dock, мастер 1024×1024.

`icon.ico` и `icon.icns` сгенерированы из круглого PNG-мастера; desktop-иконки для Windows, Linux и macOS и веб-иконки в `public/` обновлены.

ICO и PNG дополнительно копируются в `resources/icons/` для иконки окна Electron. В разработке — файлы из `build/`.

Готовые веб-ресурсы находятся в `public/` обоих приложений: `favicon.ico` (16/32/48 px), `favicon-32x32.png`, `icon-192.png` и `apple-touch-icon.png` (180 px). При замене изображения обновляйте весь комплект одновременно и сохраняйте безопасное поле мастера.

## Другие ресурсы

`entitlements.mac.plist` — **опционален и в репозитории отсутствует**: `package.json` указывает `build.mac.entitlements` / `entitlementsInherit` → `build/entitlements.mac.plist`, но `*.plist` в `build/` игнорируется git. Файл нужен только для **подписанной** macOS-сборки (`hardenedRuntime: true`). Unsigned `dist` и локальная разработка без codesign его не требуют. Для signed-релиза создайте локальный `build/entitlements.mac.plist` по шаблону electron-builder; в git не коммитьте, пока явно не снимете ignore. Иконки не заменяют настройку подписи.
