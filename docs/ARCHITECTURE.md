# Архитектура проекта

## 1. Стек

- React 19 + App Router-compatible API.
- Vinext/Vite вместо стандартного Next.js runtime.
- Cloudflare Worker entry в `worker/index.ts`.
- Three.js для WebGL renderer, plane geometry и ShaderMaterial.
- lil-gui для экспериментальной панели параметров.
- GLSL fragment shaders для обоих вариантов сияния.
- Обычный CSS для full-screen compositing и HUD.

Серверного хранилища, API, D1, R2, авторизации и внешних runtime-запросов нет. Для явно сохранённого same-device visual preset используется browser `localStorage`; `.openai/hosting.json` по-прежнему содержит `d1: null` и `r2: null`.

## 2. Маршруты

| Маршрут | Компонент | Назначение |
| --- | --- | --- |
| `/` | `app/page.tsx` | Redirect на `/aurora-prototype`. |
| `/aurora-prototype` | `AuroraPrototype` | Старый texture-driven эксперимент. |
| `/aurora-codepen` | `CodepenAuroraPrototype` | Текущий основной Nimitz procedural prototype. |
| `/aurora-clean` | `CleanAuroraView` | Чистый output без UI; читает и слушает сохранённый combined preset. |

Route metadata задаётся в соответствующих `page.tsx`. Общий `<html lang="ru">` и глобальные стили подключены в `app/layout.tsx`.

## 3. Карта файлов активного маршрута

```text
app/aurora-codepen/page.tsx
  └─ app/components/CodepenAuroraPrototype.tsx
       ├─ app/components/ProceduralStarSky.tsx
       ├─ app/star-sky/config.ts
       ├─ app/aurora-codepen/config.ts
       ├─ app/aurora-codepen/AuroraCodepenScene.ts
       │    └─ app/aurora-codepen/shaders.ts
       └─ app/globals.css

app/aurora-clean/page.tsx
  └─ app/components/CleanAuroraView.tsx
       ├─ app/components/ProceduralStarSky.tsx
       ├─ app/aurora-codepen/AuroraCodepenScene.ts
       └─ app/settings/savedAuroraSettings.ts
```

Распределение ответственности:

- `page.tsx`: только metadata и mount client component.
- `CodepenAuroraPrototype.tsx`: React state, procedural/background + WebGL layers, toolbar, GUI и callbacks.
- `ProceduralStarSky.tsx`: seeded stars, Canvas 2D twinkle loop и background lifecycle.
- `star-sky/config.ts`: type/default для всех пользовательских SKY controls.
- `config.ts`: serializable configuration contract, default values и quality limits.
- `AuroraCodepenScene.ts`: browser-only WebGL lifecycle и преобразование config → uniforms.
- `shaders.ts`: визуальная математика и alpha output.
- `globals.css`: взаимное позиционирование DOM/WebGL слоёв, responsive и видимость интерфейса.
- `CleanAuroraView.tsx`: только procedural sky и WebGL host; без toolbar, GUI, heading или note.
- `savedAuroraSettings.ts`: versioned serialization, validation и same-device inter-tab delivery.

## 4. Слои compositing

Все видимые слои занимают один full-screen контейнер. Активный маршрут не содержит `<img>` и не загружает image textures.

```text
z=8  lil-gui
z=7  perf badge, toolbar, A/B link
z=6  heading, note
z=1  прозрачный Three.js canvas
z=0  procedural sky wrapper: CSS gradients + Canvas 2D stars
     container background/checkerboard только для aurora-only debug
```

Ключевой принцип: небо не рисуется в активном Nimitz fragment shader. Шейдер возвращает только цвет сияния и alpha. Отдельный Canvas/CSS background остаётся видимым между полосами и облегчает debug прозрачности.

CSS классы `is-background`, `is-aurora` и обычный `is-composite` меняют видимость слоёв:

- composite: procedural sky + WebGL;
- background: только procedural sky, WebGL opacity 0;
- aurora: procedural sky opacity 0, под WebGL показывается checkerboard прозрачности.

## 5. React state активного компонента

| State | Назначение |
| --- | --- |
| `ready` | Canvas/material готовы; включает fade-in WebGL. |
| `failed` | WebGL init/context failure; оставляет procedural sky без ауры. |
| `paused` | Ручная остановка RAF. |
| `reducedMotion` | Системная motion preference. |
| `metrics` | FPS, DPR, quality, drawing-buffer size, elapsed time. |
| `compositeMode` | `composite`, `background` или `aurora`. |
| `shaderDebug` | normal/alpha/horizon/horizontal/curtains. |
| `controlsVisible` | Только panel-only Hide GUI/Tune. |
| `interfaceHidden` | Hide all UI. |
| `starSkyConfig` | React copy текущего sky preset, передаваемая в Canvas/background style. |
| `shootingStarTrigger` | Счётчик ручных запусков `Launch Now`. |
| `saveStatus` | Краткая обратная связь `idle`/`saved`/`failed` для кнопки сохранения. |

Сам конфиг не хранится в React state. Он живёт в `configRef`, потому что lil-gui мутирует объект напрямую. При каждом `onChange` вызывается `scene.setConfig(config)`.

Sky config использует комбинированную схему: lil-gui мутирует `starSkyConfigRef`, затем `updateSky()` создаёт новую React copy. `ProceduralStarSky` обновляет собственный ref и перерисовывает кадр без пересоздания Canvas/observers на каждый drag event.

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

1. Создаёт ShaderMaterial для выбранного quality preset без texture loading.
2. Подключает ResizeObserver, IntersectionObserver, visibility, reduced-motion и context-loss listeners.
3. Выполняет resize и первый render.
4. Сообщает metrics/ready.
5. Запускает RAF только если `shouldAnimate()` возвращает true.

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

Останавливает RAF, отключает observers/listeners, dispose-ит material/geometry/renderer и удаляет canvas.

## 7. Процедурное звёздное небо

`ProceduralStarSky` — отдельный Canvas 2D слой под WebGL:

- CSS создаёт глубокий сине-чёрный vertical gradient, мягкое свечение у нижнего края и очень слабые radial/linear nebula gradients;
- top/middle/bottom colors, midpoint, horizon glow и haze управляются через `SKY / GRADIENT`;
- seeded PRNG `mulberry32` создаёт одинаковое поле для одинакового viewport size;
- количество звёзд зависит от площади и ограничено 260..720;
- большинство звёзд имеют radius 0.32..0.94 CSS px;
- примерно 4.5% звёзд крупнее и получают мягкий Canvas shadow glow;
- используется холодная бело-голубая палитра с редкими тёплыми точками;
- у каждой звезды индивидуальны phase, speed и малая twinkle depth;
- `SKY / STARS` меняет два цвета, color mix, density, brightness, size, начало поля, fade start/end и twinkle amount/speed;
- redraw ограничен 30 FPS и DPR 1.5;
- Pause, reduced motion, hidden document и IntersectionObserver останавливают loop;
- resize пересоздаёт детерминированное поле для новых размеров.

Падающая звезда:

- планируется через отдельный seeded random sequence;
- фактическая задержка равна interval × random(0.65..1.35);
- стартует в случайной точке верхней части экрана;
- направление задаёт angle, движение — CSS px/s;
- trail создаётся Canvas linear gradient, head — светлая точка с glow;
- life fade плавно появляется в первые 8% и исчезает после 62% полёта;
- во время полёта Canvas временно обновляется до 60 FPS;
- reduced motion и Pause полностью отключают meteor;
- `Launch Now` увеличивает trigger counter и ставит следующий запуск на ближайший frame.

Star layer не связан с quality/pixelRatio Nimitz renderer и не меняет alpha ауры.

## 8. Устройство активного GLSL

### Координаты

`coverUv(vUv)` сохраняет прежнее квадратное 1:1 design space, чтобы Nimitz field не сместился после удаления 2048×2048 изображения. Затем UV переводятся в ray plane через offset/scale/horizon controls. Камера фиксирована; есть только лёгкая time rotation луча.

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

### Композиционные маски

Последовательно применяются:

1. `insideArtwork` — UV внутри 0..1;
2. `horizontalMask` — center/width/edge fade;
3. `horizonMask` — скрывает область ниже горизонта;
4. `heightMask` — ограничивает верх;
Итог: `compositionMask`.

### Alpha и чистая прозрачность

1. `sourceAlpha = max(field alpha, color luminance)`.
2. `smoothstep(alphaLow, alphaHigh, sourceAlpha)` строит основной alpha threshold.
3. `transparentLuminance = smoothstep(0.004, 0.05, luminance)` удаляет почти чёрные части поля из alpha.
4. Alpha умножается на procedural composition mask и global opacity; bitmap mask отсутствует.
5. RGB dithering умножается на alpha, поэтому не должен загрязнять полностью прозрачные пиксели.
6. Вывод: `vec4(auroraColor, auroraAlpha)`.

Не добавлять background color в эту формулу.

## 9. Debug modes

`uDebugMode`:

| Значение | UI action | Вывод |
| --- | --- | --- |
| 0 | normal | RGB + настоящий alpha. |
| 1 | Show Alpha | Grayscale итогового alpha. |
| 2 | Show Horizon Mask | Horizon mask. |
| 3 | Show Horizontal Mask | Horizontal composition mask. |
| 4 | Show Aurora Field | Source field × composition mask. |

Debug mode принудительно возвращает `compositeMode` в composite.

## 10. GUI architecture

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

SKY numeric controls, как и Aurora numeric controls, создаются без GUI min/max и получают horizontal scrub. Safety clamps применяются только внутри Canvas renderer. Цвета и `shootingStarEnabled` используют обычные color/boolean controllers.

## 11. Hide-all-UI

Кнопка выставляет `interfaceHidden=true`; section получает `is-interface-hidden`. CSS скрывает UI через visibility/opacity/pointer-events, не размонтируя controls и не сбрасывая visual state.

Возврат:

- Escape, только когда UI скрыт;
- H как toggle, кроме момента редактирования form control;
- double-click по section, только когда UI скрыт;
- Reset также ставит `interfaceHidden=false`.

## 12. Сохранение и clean-view sync

`app/settings/savedAuroraSettings.ts` хранит один combined document:

```text
{
  version: 1,
  savedAt: number,
  aurora: CodepenAuroraConfig,
  sky: StarSkyConfig
}
```

Ключ `localStorage`: `aurora-motion-study:settings:v1`. Данные не отправляются на сервер и действуют только для того же browser origin/profile/device. Перед применением документ проверяется: неизвестные поля отбрасываются, отсутствующие или неверно типизированные primitive values заменяются соответствующими source defaults, `quality` дополнительно проверяется как `low | medium | high`.

Поток сохранения и доставки:

```text
/aurora-codepen config refs
  → явный Save settings
  → localStorage
  → same-page CustomEvent
  → BroadcastChannel + browser storage event
  → /aurora-clean scene.setConfig() + React sky config copy
```

`BroadcastChannel` даёт немедленную доставку в уже открытые вкладки. `storage` является межвкладочным fallback; custom event покрывает подписчиков в той же странице. При первом mount обе страницы читают последний сохранённый документ. Изменения GUI намеренно не транслируются до нажатия Save.

`/aurora-clean` создаёт тот же `AuroraCodepenScene` и `ProceduralStarSky`, но не монтирует никаких controls. При отсутствии/повреждении saved document используются source defaults. `Reset` работает только с текущим состоянием конфигуратора и не мутирует localStorage.

## 13. Старый texture-driven маршрут

`/aurora-prototype` использует другую архитектуру:

- загружает `03-aurora.png` и `04-sky-mask.png`;
- искажает готовую картинку через FBM displacement;
- смешивает base/moved texture;
- имеет свои config, debug views и GUI;
- не использует Nimitz shader или параметры bands.

Он сохранён как A/B/reference implementation. Изменения active route не должны случайно менять его defaults или shader.

## 14. Как добавить новый параметр

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

Для нового sky-параметра аналогичная цепочка: `StarSkyConfig` → default → `addSkyNumber`/color/boolean GUI → `ProceduralStarSky` → tests → `docs/CONFIGURATION.md`. GLSL/Three scene при этом не меняются.
