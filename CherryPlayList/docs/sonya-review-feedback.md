Раздел статусов багов из планирования ревью Сони.

См. также [../../Соня ревью.md](../../Соня ревью.md) и [party.md](./modules/workspaces/party.md).

## 9. Баги (подтверждённые в диалоге)

Статусы обновлены после фиксов (июль 2026): B1–B7 закрыты в CherryPlayList / CherryPlayComponents. См. также [party.md](./modules/workspaces/party.md) (reset matrix, theme access).

| #   | Симптом                                              | Вероятная область                             | Статус |
| --- | ---------------------------------------------------- | --------------------------------------------- | ------ |
| B1  | «Новый проект» не сбрасывает подзаголовок / описание | `projectStore` / `resetPartyWorkspaceForFreshProject` | Исправлено |
| B2  | Залипшее demo-превью                                 | `partyPreviewScenarioStore`, demo mode        | Исправлено |
| B3  | Тема сбрасывается на Киберпанк при rename / reset    | identity key = `filePath`; hydrate after reset | Исправлено |
| B4  | Некорректные надписи entitlement (Сакура, Весенний)  | `buildThemeLockInfoMessage` / revoked copy   | Исправлено |
| B5  | Можно выбрать недоступную тему → ошибка при создании | themeAccess null gate + Create block          | Исправлено |
| B6  | Имена групп в плейлисте не переименовываются         | `ProjectItemRow` drag isolation + `setGroupName` | Исправлено |
| B7  | Иконка темы «Весенний фест» не грузится              | spring-cross-step poster asset bundling       | Исправлено |
