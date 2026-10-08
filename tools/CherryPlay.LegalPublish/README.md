# CherryPlay.LegalPublish

Считает SHA-256 чистых legal `.md` и пишет JSON для фронта.

```bash
dotnet run --project tools/CherryPlay.LegalPublish -- 1.0
```

В Postgres версии документов попадают **только миграцией** (`HasData` в `LegalDocumentVersionEfConfiguration` → `dotnet ef migrations add …`). Этот tool C# seed не патчит.
