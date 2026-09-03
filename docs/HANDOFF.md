# AI handoff: Aurora

Обновлено: **2026-09-03**.

## Цель

Поддерживать финальное процедурное северное сияние с выраженными перспективными занавесями поверх отдельного звёздного неба. Bitmap layers и ранние эксперименты удалены.

## Маршруты

- `/` — клиентский output без интерфейса;
- `/settings` — настройка, debug и presets.

Других продуктовых маршрутов нет.

## Ключевые файлы

- `app/components/AuroraView.tsx` — чистый output;
- `app/components/AuroraConfigurator.tsx` — редактор;
- `app/components/ProceduralStarSky.tsx` — Canvas stars и shooting star;
- `app/aurora-renderer/AuroraScene.ts` — WebGL lifecycle;
- `app/aurora-renderer/shaders.ts` — GLSL;
- `app/aurora-renderer/config.ts` — aurora defaults/quality;
- `app/star-sky/config.ts` — sky defaults;
- `app/performance.ts` — automatic device cap;
- `app/settings/savedAuroraSettings.ts` — presets/sync;
- `THIRD_PARTY_NOTICES.md` — обязательное уведомление для производной shader-части.

## Архитектурные решения

- WebGL прозрачен и не рисует background.
- Sky — отдельные CSS gradients + Canvas 2D.
- Root page не монтирует lil-gui, HUD или debug.
- Editor и live view используют один renderer/config contract.
- Browser-default меняется только через `Save to Default`.
- File preset не публикуется автоматически.
- Визуальные numeric fields остаются unbounded и поддерживают horizontal scrub.

## Оптимизация

`app/performance.ts` выбирает low/medium/high cap по CPU cores, device memory, Save-Data, viewport и DPR.

```text
low     24 layers / 30 aurora FPS / 0.9 DPR / 18 stars FPS
medium  36 layers / 45 aurora FPS / 1.15 DPR / 24 stars FPS
high    50 layers / 60 aurora FPS / 1.5 DPR / 30 stars FPS
```

Дополнительно:

- resize GPU buffer выполняется только при реальной смене size/DPR/effective quality;
- при двух последовательных медленных FPS-окнах quality автоматически понижается ещё на ступень;
- loops останавливаются при Pause, reduced motion, hidden tab и вне viewport;
- star samples имеют tier cap;
- CSS haze больше не использует blur filter;
- root bundle не включает editor UI до перехода на `/settings`;
- texture assets и старый renderer удалены.

## Preset workflow

- `Reset Settings` — source defaults;
- `Load Settings` — загрузить `*.aurora.json` в editor;
- `Save Settings` — скачать текущий file preset;
- `Save to Default` — записать browser-default и синхронизировать `/`;
- `Load Default Settings` — вернуть browser-default в editor.

Storage contract сохраняет формат `aurora-motion-study-preset`, version `1`, чтобы ранее созданные presets и localStorage оставались совместимыми после внутреннего переименования файлов.

## Лицензирование

Нельзя удалять `THIRD_PARTY_NOTICES.md` и attribution header в GLSL, пока shader содержит производную часть. Остальной оригинальный код проекта может лицензироваться отдельно; для финального LICENSE нужны точные имя правообладателя и тип лицензии.

## Обязательная проверка

Использовать Node.js 22.13+:

```text
npm run lint
npx tsc --noEmit
npm run build
node --test tests/rendered-html.test.mjs
```

Проверить HTTP 200 для `/` и `/settings`, а удалённые старые routes — HTTP 404.

## Не трогать

- `norvix/` не относится к проекту;
- `.openai/hosting.json` не менять без просьбы о публикации;
- не возвращать изображения, texture masks или дополнительные демонстрационные routes;
- не добавлять видимый UI на `/`.
