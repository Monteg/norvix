# Архитектура Aurora

## 1. Стек

- React 19 и App Router-compatible API;
- Vinext/Vite и Cloudflare Worker entry;
- прямой WebGL 1 + GLSL для прозрачного слоя;
- Canvas 2D + CSS gradients для звёздного неба;
- lil-gui только на странице настроек;
- localStorage/BroadcastChannel для локального preset workflow.

Серверного хранилища, API, авторизации, изображений и внешних runtime-запросов нет.

## 2. Маршруты

| Маршрут | Компонент | Назначение |
| --- | --- | --- |
| `/` | `AuroraView` | Финальный полноэкранный output без текста и controls. |
| `/settings` | `AuroraConfigurator` | Редактор, debug и переносимые presets. |

Отдельных legacy/A-B маршрутов нет.

## 3. Карта файлов

```text
app/page.tsx
  └─ app/components/AuroraView.tsx
       ├─ app/components/ProceduralStarSky.tsx
       ├─ app/aurora-renderer/AuroraScene.ts
       └─ app/settings/savedAuroraSettings.ts

app/settings/page.tsx
  └─ app/components/AuroraConfigurator.tsx
       ├─ app/aurora-renderer/config.ts
       ├─ app/aurora-renderer/AuroraScene.ts
       ├─ app/aurora-renderer/shaders.ts
       ├─ app/components/ProceduralStarSky.tsx
       └─ app/star-sky/config.ts

app/performance.ts
  └─ общий device profile для WebGL и Canvas
```

## 4. Композиция

```text
z=1  transparent WebGL aurora
z=0  CSS sky gradients + Canvas stars
```

Fragment shader возвращает только sRGB-цвет сияния и `auroraAlpha`. Context создаётся с `alpha: true`, clear alpha `0`, `premultipliedAlpha: false` и стандартным `SRC_ALPHA / ONE_MINUS_SRC_ALPHA` blending. Небо не дублируется внутри shader.

В `/settings` добавляются HUD, performance badge и lil-gui. В `/` эти элементы не монтируются.

## 5. WebGL lifecycle

`AuroraScene`:

1. определяет device profile;
2. ограничивает пользовательскую quality возможностями устройства;
3. компилирует один shader program и создаёт fullscreen triangle-strip buffer;
4. подключает ResizeObserver, IntersectionObserver, visibility, reduced-motion и context-loss listeners;
5. запускает frame-limited RAF только когда сцена видима;
6. освобождает geometry/material/renderer и listeners при dispose.

Обычный GUI drag обновляет uniforms и один текущий кадр. Размер drawing buffer меняется только при фактическом resize, изменении pixel ratio или effective quality. Последние CSS width/height и DPR кешируются, чтобы ResizeObserver не создавал повторную GPU allocation.

## 6. Адаптивная производительность

`detectPerformanceProfile()` использует:

- `navigator.hardwareConcurrency`;
- `navigator.deviceMemory`, если доступно;
- `navigator.connection.saveData`, если доступно;
- площадь viewport;
- сочетание малого экрана и высокого DPR.

Профили:

| Tier | Effective quality cap | Aurora FPS | Aurora DPR cap | Stars FPS | Stars DPR cap | Star samples cap |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| low | low / 24 layers | 30 | 0.9 | 18 | 1.0 | 1080 |
| medium | medium / 36 layers | 45 | 1.15 | 24 | 1.25 | 1440 |
| high | high / 50 layers | 60 | 1.5 | 30 | 1.5 | 1800 |

Во время падающей звезды Canvas временно использует 30/45/60 FPS соответственно. Pause, hidden document, out-of-viewport и reduced motion полностью останавливают циклы.

Если фактический FPS два измерительных окна подряд остаётся ниже 72% target, WebGL автоматически понижает effective quality ещё на одну ступень. Автоматического повышения в рамках текущей сессии нет, чтобы избежать постоянного переключения shader programs.

## 7. Настройки и синхронизация

Mutable aurora config хранится в `configRef`, sky config — в `starSkyConfigRef` плюс React copy для Canvas/CSS.

```text
/settings refs
  → Save to Default
  → localStorage
  → CustomEvent + BroadcastChannel + storage event
  → / AuroraScene.setConfig() + sky React copy
```

File preset использует тот же validated schema, но не пишет browser-default автоматически.

## 8. Shader controls

GLSL сохраняет управляемые position, scale, masks, light, curtain sharpness, line sharpness, depth bands и quality. `layerCount` runtime-clamp-ится к compile-time пределу effective quality.

Нулевая прозрачность дополнительно защищена luminance gate; dithering умножается на alpha и не должен создавать грязь в пустых пикселях.

## 9. Лицензионная граница

Процедурный starfield, React UI, persistence, device profiling, compositing и project-specific controls являются отдельными частями проекта. Shader содержит производную third-party часть; уведомление из `THIRD_PARTY_NOTICES.md` и header `shaders.ts` должны поставляться вместе с ней. Подробности — в `docs/ASSETS_AND_LICENSING.md`.
