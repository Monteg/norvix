# Архитектура проекта

## 1. Стек

- React 19 + App Router-compatible API.
- Vinext/Vite вместо стандартного Next.js runtime.
- Cloudflare Worker entry в `worker/index.ts`.
- Three.js для WebGL renderer, plane geometry и ShaderMaterial.
- lil-gui для экспериментальной панели параметров.
- GLSL fragment shaders для обоих вариантов сияния.
- Обычный CSS для full-screen compositing и HUD.

Постоянного хранилища, API, D1, R2, авторизации и внешних runtime-запросов нет. `.openai/hosting.json` содержит `d1: null` и `r2: null`.

## 2. Маршруты

| Маршрут | Компонент | Назначение |
| --- | --- | --- |
| `/` | `app/page.tsx` | Redirect на `/aurora-prototype`. |
| `/aurora-prototype` | `AuroraPrototype` | Старый texture-driven эксперимент. |
| `/aurora-codepen` | `CodepenAuroraPrototype` | Текущий основной Nimitz procedural prototype. |

Route metadata задаётся в соответствующих `page.tsx`. Общий `<html lang="ru">` и глобальные стили подключены в `app/layout.tsx`.

## 3. Карта файлов активного маршрута

```text
app/aurora-codepen/page.tsx
  └─ app/components/CodepenAuroraPrototype.tsx
       ├─ app/aurora-codepen/config.ts
       ├─ app/aurora-codepen/AuroraCodepenScene.ts
       │    └─ app/aurora-codepen/shaders.ts
       ├─ app/globals.css
       └─ public/hero/*.png
```

Распределение ответственности:

- `page.tsx`: только metadata и mount client component.
- `CodepenAuroraPrototype.tsx`: React state, DOM layers, toolbar, GUI и callbacks.
- `config.ts`: serializable configuration contract, default values и quality limits.
- `AuroraCodepenScene.ts`: browser-only WebGL lifecycle и преобразование config → uniforms.
- `shaders.ts`: визуальная математика и alpha output.
- `globals.css`: взаимное позиционирование DOM/WebGL слоёв, responsive и видимость интерфейса.

## 4. Слои compositing

Все видимые слои занимают один full-screen контейнер и используют одинаковый cover layout.

```text
z=8  lil-gui
z=7  perf badge, toolbar, A/B link, compare slider
z=6  heading, note
z=5  compare divider
z=4  reference split crop
z=3  full reference overlay или static fallback
z=1  прозрачный Three.js canvas
z=0  02-background-clean.png
     container background/checkerboard только для aurora-only debug
```

Ключевой принцип: фотография никогда не рисуется в активном fragment shader. Шейдер возвращает только цвет сияния и alpha. Это даёт чистую видимость звёзд между полосами и облегчает debug прозрачности.

CSS классы `is-background`, `is-aurora` и обычный `is-composite` меняют видимость слоёв:

- composite: background + WebGL;
- background: WebGL opacity 0;
- aurora: background opacity 0, под canvas показывается checkerboard прозрачности.

## 5. React state активного компонента

| State | Назначение |
| --- | --- |
| `ready` | Canvas/material готовы; включает fade-in WebGL. |
| `failed` | WebGL init/context failure; показывает static reference fallback. |
| `paused` | Ручная остановка RAF. |
| `reducedMotion` | Системная motion preference. |
| `metrics` | FPS, DPR, quality, drawing-buffer size, elapsed time. |
| `compositeMode` | `composite`, `background` или `aurora`. |
| `shaderDebug` | normal/alpha/horizon/horizontal/curtains. |
| `showReference` | Полупрозрачный full reference overlay. |
| `referenceOpacity` | Alpha reference overlay. |
| `compareSplit` | Включает reference crop слева. |
| `splitPosition` | Положение split 5–95%. |
| `controlsVisible` | Только panel-only Hide GUI/Tune. |
| `interfaceHidden` | Hide all UI. |

Сам конфиг не хранится в React state. Он живёт в `configRef`, потому что lil-gui мутирует объект напрямую. При каждом `onChange` вызывается `scene.setConfig(config)`.

## 6. Three.js lifecycle

### Constructor

1. Копирует initial config.
2. Читает `prefers-reduced-motion`.
3. Создаёт `WebGLRenderer` с:
   - `alpha: true`;
   - `antialias: false`;
   - `premultipliedAlpha: false`;
   - `powerPreference: high-performance`.
4. Устанавливает clear color `(0x000000, 0)` и sRGB output.
5. Добавляет canvas в host.

### `init()`

1. Загружает `04-sky-mask.png`; если загрузка не удалась, создаёт белую 1×1 mask texture.
2. Создаёт ShaderMaterial для выбранного quality preset.
3. Подключает ResizeObserver, IntersectionObserver, visibility, reduced-motion и context-loss listeners.
4. Выполняет resize и первый render.
5. Сообщает metrics/ready.
6. Запускает RAF только если `shouldAnimate()` возвращает true.

### RAF loop

- Delta ограничен 0.05 s, чтобы возвращение к вкладке не дало большого скачка.
- `elapsed` увеличивается на реальный delta; `uSpeed` применяется внутри GLSL.
- FPS считается окном примерно 750 ms.
- Metrics дополнительно throttled до 250 ms.
- Loop не работает при pause, reduced motion, невидимой вкладке, вне viewport и после dispose.

### Resize

Фактический DPR:

```text
min(window.devicePixelRatio, config.pixelRatio, QUALITY_PRESETS[quality].maxDpr)
```

`iResolution` получает drawing-buffer size, а `uViewportAspect` — CSS width/height host.

### Config updates

- Обычное изменение обновляет uniforms, resize и текущий frame.
- Изменение `quality` пересоздаёт ShaderMaterial, потому что `MAX_AURORA_LAYERS` является compile-time define.
- Старый material dispose-ится после замены.

### Dispose

Останавливает RAF, отключает observers/listeners, dispose-ит material/geometry/texture/renderer и удаляет canvas.

## 7. Устройство активного GLSL

### Координаты

`coverUv(vUv)` повторяет CSS `object-fit: cover` для квадратного 2048×2048 artwork. Затем UV переводятся в ray plane через offset/scale/horizon controls. Камера фиксирована; есть только лёгкая time rotation луча.

### Procedural curtain field

Основа сохранена из Nimitz:

- triangle-wave noise;
- несколько octave-деформаций;
- time rotation;
- raymarch-подобное накопление слоёв по глубине;
- native tint по глубине.

Проектные расширения:

- `uWarpStrength` регулирует domain deformation;
- `uCurtainSharpness` меняет форму inverse-noise;
- `uLineSharpness` усиливает/ослабляет уже нормализованные curtain lines;
- custom primary/secondary colors и `uColorMix`;
- `uLayerCount`, `uCurtainHeight`, `uDepthSpread`, `uLowerGlow`.

### Depth bands

После вычисления каждой curtain sample строится `depthMix = layer / 50`. К нему добавляется небольшой time/noise bend. `uBandAlignment` смешивает bent coordinate с чистой глубиной. Cosine создаёт периодические полосы; `uBandCount` задаёт частоту, `uBandSharpness` профиль, `uBandStrength` амплитуду влияния.

Это не отдельная 2D ribbon geometry. Полосы модулируют яркость каждого volumetric/depth layer и поэтому наследуют перспективу Nimitz field.

### Маски

Последовательно применяются:

1. `insideArtwork` — UV внутри 0..1;
2. `horizontalMask` — center/width/edge fade;
3. `horizonMask` — скрывает область ниже горизонта;
4. `heightMask` — ограничивает верх;
5. `skyMask` — bitmap landscape protection.

Итог: `compositionMask`.

### Alpha и чистая прозрачность

1. `sourceAlpha = max(field alpha, color luminance)`.
2. `smoothstep(alphaLow, alphaHigh, sourceAlpha)` строит основной alpha threshold.
3. `transparentLuminance = smoothstep(0.004, 0.05, luminance)` удаляет почти чёрные части поля из alpha.
4. Alpha умножается на composition mask и global opacity.
5. RGB dithering умножается на alpha, поэтому не должен загрязнять полностью прозрачные пиксели.
6. Вывод: `vec4(auroraColor, auroraAlpha)`.

Не добавлять background color в эту формулу.

## 8. Debug modes

`uDebugMode`:

| Значение | UI action | Вывод |
| --- | --- | --- |
| 0 | normal | RGB + настоящий alpha. |
| 1 | Show Alpha | Grayscale итогового alpha. |
| 2 | Show Horizon Mask | Horizon × sky mask. |
| 3 | Show Horizontal Mask | Horizontal composition mask. |
| 4 | Show Aurora Field | Source field × composition mask. |

Debug mode принудительно возвращает `compositeMode` в composite.

## 9. GUI architecture

`addNumber()` намеренно вызывает `folder.add(config, property)` без min/max. Возвращённый NumberController получает:

- label;
- `onChange(update)`;
- mouse scrub handler на внутреннем `$input`;
- title и aria-description.

Scrub начинается только после горизонтального смещения ≥3 px. До этого interaction остаётся кликом для ручного ввода. Cleanup каждого custom listener хранится и вызывается при unmount.

Render-контролы остаются обычными bounded sliders:

- Pixel Ratio: 0.5..2, step 0.05;
- Dithering: 0..0.08, step 0.001;
- Quality: enum.

## 10. Hide-all-UI

Кнопка выставляет `interfaceHidden=true`; section получает `is-interface-hidden`. CSS скрывает UI через visibility/opacity/pointer-events, не размонтируя controls и не сбрасывая visual state.

Возврат:

- Escape, только когда UI скрыт;
- H как toggle, кроме момента редактирования form control;
- double-click по section, только когда UI скрыт;
- Reset также ставит `interfaceHidden=false`.

## 11. Старый texture-driven маршрут

`/aurora-prototype` использует другую архитектуру:

- загружает `03-aurora.png` и `04-sky-mask.png`;
- искажает готовую картинку через FBM displacement;
- смешивает base/moved texture;
- имеет свои config, debug views и GUI;
- не использует Nimitz shader или параметры bands.

Он сохранён как A/B/reference implementation. Изменения active route не должны случайно менять его defaults или shader.

## 12. Как добавить новый параметр

Пример обязательной цепочки:

1. Добавить поле в `CodepenAuroraConfig`.
2. Добавить default в `DEFAULT_CODEPEN_AURORA_CONFIG`.
3. Добавить uniform declaration в GLSL.
4. Создать uniform в `createMaterial()`.
5. Обновлять его в `updateUniforms()`.
6. Использовать uniform в формуле шейдера.
7. Добавить control в подходящую GUI folder через `addNumber()` или typed control.
8. Добавить regression assertions в test.
9. Описать параметр и его реальные clamp/interactions в `docs/CONFIGURATION.md`.
10. Проверить крайние значения, Reset, transparent gaps, mask и FPS.
