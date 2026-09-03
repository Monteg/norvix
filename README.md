# Aurora

Процедурное северное сияние и звёздное небо без изображений и внешних runtime-запросов.

## Маршруты

- `/` — финальный полноэкранный вид без интерфейса;
- `/settings` — редактор сияния, неба, звёзд и сохранённых пресетов.

Редактор сохраняет browser-default через `Save to Default`. Уже открытый финальный вид получает это состояние через `BroadcastChannel` или `storage` event. `Save Settings` и `Load Settings` позволяют переносить несколько пресетов файлами `*.aurora.json`.

## Запуск

Требуется Node.js 22.13 или новее.

```text
npm install
npm run dev
```

Открыть `http://localhost:3000/` или `http://localhost:3000/settings`.

## Проверка

```text
npm run lint
npx tsc --noEmit
npm run build
node --test tests/rendered-html.test.mjs
```

## Производительность

Runtime автоматически выбирает верхнюю границу качества по `hardwareConcurrency`, `deviceMemory`, Save-Data, размеру экрана и плотности пикселей. На слабых устройствах уменьшаются число проходов WebGL, DPR, частота кадров звёзд и объём star samples. Выбранное пользователем качество остаётся верхней границей, а не обещанием принудительно перегружать устройство.

Анимация полностью останавливается вне viewport, в скрытой вкладке, при Pause и при `prefers-reduced-motion`.

## Документация

- [Архитектура](docs/ARCHITECTURE.md)
- [Настройки](docs/CONFIGURATION.md)
- [Разработка и передача](docs/DEVELOPMENT.md)
- [Лицензирование](docs/ASSETS_AND_LICENSING.md)
- [AI handoff](docs/HANDOFF.md)

Оригинальные части проекта лицензируются отдельно от производной части GLSL. Обязательные уведомления находятся в [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
