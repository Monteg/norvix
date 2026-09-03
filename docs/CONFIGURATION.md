# Справочник настроек `/aurora-codepen`

## 1. Source of truth

Типы и исходные пресеты находятся в:

```text
app/aurora-codepen/config.ts
app/star-sky/config.ts
```

Runtime flow:

```text
DEFAULT_CODEPEN_AURORA_CONFIG
  → configRef в React
  → lil-gui мутирует объект
  → AuroraCodepenScene.setConfig()
  → ShaderMaterial uniforms
  → fragment shader

DEFAULT_STAR_SKY_CONFIG
  → starSkyConfigRef мутируется lil-gui
  → React copy starSkyConfig
  → ProceduralStarSky configRef
  → CSS background + Canvas 2D draw

оба runtime config refs
  → явный Save to Default
  → versioned localStorage document
  → /aurora-clean (initial load + inter-tab subscription)
```

Source defaults остаются канонической fallback-конфигурацией. Если существует сохранённый browser override, `/aurora-codepen` загружает его при mount, а `/aurora-clean` использует его при mount и при последующих явных сохранениях. Cookies и server persistence отсутствуют.

`Reset Settings` восстанавливает source defaults в текущем конфигураторе; на viewport ≤600 px дополнительно меняет aurora quality на low. Reset Settings не удаляет и не перезаписывает browser default.

## 2. Почему в GUI нет min/max

Все визуальные numeric controls добавляются через:

```ts
folder.add(config, property)
folder.add(skyConfig, property)
```

Это намеренное решение пользователя: можно вводить числа вне обычных диапазонов и экспериментировать. Внутренний drag по числу также не ограничивает значение. Но GLSL в некоторых местах всё равно применяет `max`, `abs` или `clamp`; реальные ограничения перечислены ниже.

Только технические Render settings ограничены UI:

- Pixel Ratio: 0.5..2;
- Dithering: 0..0.08;
- Quality: low/medium/high.

## 3. Полная таблица параметров

### SKY / GRADIENT

| Поле | GUI | Default | Влияние и safety clamp |
| --- | --- | ---: | --- |
| `skyTopColor` | Top Color | `#01040d` | Цвет верхней точки linear gradient. |
| `skyTopOpacity` | Top Opacity | `1` | Alpha верхней точки gradient; runtime clamp 0..1. |
| `skyMiddleColor` | Middle Color | `#041326` | Промежуточный цвет gradient. |
| `skyMiddleOpacity` | Middle Opacity | `1` | Alpha промежуточной точки gradient; runtime clamp 0..1. |
| `skyBottomColor` | Bottom Color | `#082039` | Цвет нижней точки gradient. |
| `skyBottomOpacity` | Bottom Opacity | `1` | Alpha нижней точки gradient; runtime clamp 0..1. |
| `gradientMidpoint` | Gradient Midpoint | `0.62` | Позиция middle color; Canvas style clamp 0.01..0.99. |
| `horizonGlowColor` | Horizon Glow Color | `#175278` | Цвет отдельного radial glow поверх linear gradient. |
| `horizonGlowPosition` | Glow Position | `1.12` | Вертикальный центр radial glow в долях высоты; clamp -1..2. Значение >1 помещает центр ниже viewport и создаёт мягкий подъём света снизу. |
| `horizonGlowSize` | Glow Size | `0.62` | Размер radial ellipse; берётся absolute value и clamp 0.02..2. |
| `horizonGlowStrength` | Glow Strength | `0.52` | Alpha glow; clamp 0..2, а итоговый CSS alpha ограничивается 1. |
| `hazeStrength` | Haze Strength | `0.72` | Opacity слабых pseudo-element haze gradients; runtime clamp 0..2, CSS opacity визуально насыщается на 1. |

Scrub speed: midpoint/position/size `0.001`/px; opacity/strength/haze `0.005`/px. Числа opacity в GUI не ограничены, но `rgba()` безопасно clamp-ит итог к 0..1.

### SKY / STARS

| Поле | GUI | Default | Влияние и safety clamp |
| --- | --- | ---: | --- |
| `starPrimaryColor` | Primary Color | `#dcebff` | Основной холодный цвет звёзд. |
| `starSecondaryColor` | Secondary Color | `#fff7e0` | Второй, более тёплый цвет. |
| `starColorMix` | Color Mix | `1` | Максимальная доля secondary color для индивидуального случайного tone; итоговый mix clamp 0..1. |
| `starDensity` | Density | `1` | Множитель базового количества; runtime clamp 0..3. Поле заранее содержит до 1800 samples, поэтому density меняется без regeneration. |
| `starBrightness` | Brightness | `1` | Множитель alpha всех звёзд; clamp 0..4, итоговый alpha clamp 0..1. |
| `starSize` | Size | `1` | Множитель radius; берётся absolute value и clamp 0.05..8. |
| `starStartY` | Field Start Y | `-0.08` | Нормализованная Y-точка появления поля. Звёзды плавно reveal на участке `startY..startY+0.08`. Отрицательный default полностью открывает верхний край. |
| `starFadeStartY` | Fade Start Y | `0.72` | Y, с которой начинается нижнее исчезновение звёзд. |
| `starFadeEndY` | Fade End Y | `1.04` | Y полной прозрачности звёзд. Порядок start/end нормализуется с минимумом 0.0001. Значение >1 сохраняет слабые звёзды у нижнего края. |
| `twinkleAmount` | Twinkle Amount | `1` | Множитель индивидуальной амплитуды мерцания; clamp 0..4. 0 делает звёзды статичными. |
| `twinkleSpeed` | Twinkle Speed | `1` | Общий множитель индивидуальных скоростей; absolute value, clamp 0..8. 0 фиксирует текущие phases. |

Scrub speed: colors — color picker; Y controls `0.001`/px; Color Mix `0.005`/px; остальные `0.01`/px.

### SKY / SHOOTING STAR

| Поле | GUI | Default | Влияние и safety clamp |
| --- | --- | ---: | --- |
| `shootingStarEnabled` | Enabled | `true` | Включает автоматические и ручные запуски. При Pause/reduced motion meteor не рисуется. |
| `shootingStarColor` | Color | `#e4f6ff` | Цвет trail, glow и head. |
| `shootingStarInterval` | Interval (sec) | `14` | Средняя пауза между полётами; absolute value clamp 0.5..180 s, затем умножается на random 0.65..1.35. |
| `shootingStarBrightness` | Brightness | `0.92` | Alpha multiplier trail/head; clamp 0..4. |
| `shootingStarSpeed` | Speed | `850` | Скорость head в CSS px/s; absolute value clamp 40..4000. |
| `shootingStarLength` | Trail Length | `150` | Длина хвоста в CSS px; absolute value clamp 4..1200. |
| `shootingStarAngle` | Angle | `24` | Угол в градусах, без clamp; 0 летит вправо, положительные значения — вниз. |
| `shootingStarThickness` | Thickness | `1.25` | Толщина линии в CSS px; absolute value clamp 0.2..16. |

Кнопка `Launch Now` не является config value: она увеличивает React trigger counter и ставит meteor на ближайший animation frame. Это позволяет настраивать trail без ожидания interval.

Scrub speed: Interval `0.1`/px; Brightness/Thickness `0.01`/px; Speed `5`/px; Length `1`/px; Angle `0.5`/px.

### AURORA / MOTION

| Поле | GUI | Default | Uniform | Фактическое влияние и ограничения |
| --- | --- | ---: | --- | --- |
| `speed` | Speed | `2.16` | `uSpeed` | Умножает `iTime` в noise rotation, ray rotation и band bend. Отрицательные значения обращают направление времени, 0 замораживает внутреннее движение, хотя RAF продолжает работать. |
| `seed` | Noise Seed | `44.8` | `uSeed` | Смещает noise domain и per-pixel jitter. Это не random state: одинаковое число воспроизводимо. |

Scrub speed: Speed `0.01`/px, Seed `0.1`/px.

### AURORA / POSITION

| Поле | GUI | Default | Uniform | Фактическое влияние и ограничения |
| --- | --- | ---: | --- | --- |
| `offsetX` | Position X | `0.003` | `uAuroraOffsetX` | Сдвигает центр ray-plane по X относительно artwork UV. |
| `offsetY` | Position Y | `0.152` | `uAuroraOffsetY` | Сдвигает ray-plane по Y относительно `horizonY`; меняет вертикальное положение/перспективу поля. |
| `scaleX` | Scale X | `0.101` | `uAuroraScaleX` | Делитель X в ray-plane. В GLSL применяется `max(value, 0.05)`, поэтому все значения ≤0.05 фактически равны 0.05. |
| `scaleY` | Scale Y | `0.176` | `uAuroraScaleY` | Делитель Y в ray-plane. Тот же минимум 0.05. |
| `width` | Width | `0.97` | `uAuroraWidth` | Порог `abs(artUv.x-centerX)` для horizontal mask. Это half-width в UV, а не CSS width. Не clamp-ится. |
| `height` | Height | `0.958` | `uAuroraHeight` | Верхняя граница равна `horizonY + height`; fade использует `edgeFade`. Не clamp-ится. |
| `centerX` | Center X | `0.63` | `uAuroraCenterX` | Центр horizontal mask в artwork UV. Не clamp-ится к 0..1. |

Scrub speed для всех Position controls: `0.001`/px.

### AURORA / LIGHT

| Поле | GUI | Default | Uniform | Фактическое влияние и ограничения |
| --- | --- | ---: | --- | --- |
| `intensity` | Intensity | `2.46` | `uAuroraIntensity` | Умножает accumulated volumetric color до финального `smoothstep(0..1.5)`. Большие значения насыщают поле и alpha. |
| `opacity` | Opacity | `0.921` | `uAuroraOpacity` | Последний global multiplier alpha. RGB напрямую не меняет. Может быть >1 или отрицательным, но такие значения дают нестандартный blending. |
| `alphaLow` | Alpha Low | `-0.813` | `uAlphaLow` | Нижняя граница smoothstep для source alpha. Отрицательный default делает слабые части видимее. |
| `alphaHigh` | Alpha High | `1.04` | `uAlphaHigh` | Верхняя граница alpha smoothstep. В shader используется `max(alphaHigh, alphaLow + 0.001)`. |
| `colorBase` | Primary Color | `#75ffbd` | `uColorBase` | Custom tint ближних/depth-low слоёв. |
| `colorHigh` | Secondary Color | `#7c6bff` | `uColorHigh` | Custom tint дальних/depth-high слоёв. |
| `colorMix` | Color Mix | `0.588` | `uColorMix` | `mix(nativeTint, customTint, value)`. Не clamp-ится; вне 0..1 происходит экстраполяция. |
| `saturation` | Saturation | `1.634` | `uSaturation` | `mix(grayscale, color, value)`. Значение >1 намеренно даёт oversaturation. |

Scrub speed: Intensity `0.01`/px; остальные numeric Light controls `0.001`/px.

### AURORA / MASK

| Поле | GUI | Default | Uniform | Фактическое влияние и ограничения |
| --- | --- | ---: | --- | --- |
| `horizonY` | Horizon Y | `0.238` | `uHorizonY` | Одновременно база ray-plane и нижняя граница horizon mask. Artwork UV растёт снизу вверх в shader convention. |
| `horizonFeather` | Horizon Feather | `-0.15` | `uHorizonFeather` | В smoothstep используется `max(value, 0.001)`. Текущий отрицательный default фактически даёт почти жёсткий feather 0.001. |
| `edgeFade` | Edge Fade | `20.131` | `uEdgeFade` | Общий feather для боковой и верхней масок, с минимумом 0.001. Текущий огромный относительно UV default делает края очень мягкими/почти полностью открытыми. |
| `centerBias` | Center Bias | `0.283` | `uCenterBias` | Управляет exponent horizontal mask через `mix(1, 3, value)`. Не clamp-ится, поэтому вне 0..1 exponent экстраполируется. |
Scrub speed: `0.001`/px.

### AURORA / NIMITZ FIELD

| Поле | GUI | Default | Uniform | Фактическое влияние и ограничения |
| --- | --- | ---: | --- | --- |
| `noiseScale` | Curtain Scale | `1` | `uNoiseScale` | Масштаб `samplePosition.zx` перед triangular noise. Не имеет явного clamp. |
| `warpStrength` | Warp Strength | `1` | `uWarpStrength` | Усиливает domain rotation, displacement и feedback деформацию. 0 заметно выпрямляет поле. |
| `curtainSharpness` | Curtain Sharpness | `1` | `uCurtainSharpness` | Exponent inverse triangular accumulation; минимум в shader `0.2`. Меняет общую форму/плотность curtain field. |
| `lineSharpness` | Line Sharpness | `1.27` | `uLineSharpness` | После нормализации применяется `pow(normalizedCurtain, value)`; минимум 0.05. >1 делает яркие линии уже/чётче, <1 расширяет/смягчает. |
| `bandCount` | Band Count | `64` | `uBandCount` | Частота cosine bands по depth coordinate. Используется `max(abs(value), 0.001)`, знак игнорируется. |
| `bandAlignment` | Band Alignment | `4` | `uBandAlignment` | `mix(looseBandCoordinate, depthMix, value)`. 0 — изгибы/noise, 1 — чистая depth alignment. Текущий 4 экстраполирует beyond depthMix и является частью выбранного вида. |
| `bandStrength` | Band Strength | `0.825` | `uBandStrength` | Сила modulation curtain brightness; shader применяет только нижний clamp `max(value, 0)`. Значения >1 разрешены. |
| `bandSharpness` | Band Sharpness | `1.06` | `uBandSharpness` | Exponent cosine profile; минимум 0.05. Больше — полосы уже и контрастнее. |
| `layerCount` | Depth Layers | `184` | `uLayerCount` | Runtime clamp: `1..MAX_AURORA_LAYERS`. При high реальный максимум 50, поэтому default 184 фактически равен 50. |
| `curtainHeight` | Curtain Height | `0.803` | `uCurtainHeight` | Базовая Y-высота пересечения ray с procedural layers. Сильно влияет на перспективное положение. |
| `depthSpread` | Depth Spread | `0.0019` | `uDepthSpread` | Множитель `pow(layer, 1.4)` в distance-along-ray. Малые изменения заметно меняют разнесение/форму слоёв. |
| `lowerGlow` | Lower Glow | `-1` | `uLowerGlow` | Множитель нижнего horizon glow: field умножается на `1 + exp(...) * lowerGlow`. 0 выключает correction; отрицательные значения подавляют основание. |

Scrub speed:

```text
noiseScale         0.001/px
warpStrength       0.001/px
curtainSharpness   0.001/px
lineSharpness      0.01/px
bandCount          0.05/px
bandAlignment      0.005/px
bandStrength       0.005/px
bandSharpness      0.01/px
layerCount         1/px
curtainHeight      0.001/px
depthSpread        0.0001/px
lowerGlow          0.001/px
```

### RENDER

| Поле | GUI | Default | Реальное поведение |
| --- | --- | ---: | --- |
| `quality` | Quality | `high` | Выбирает compile-time maximum layers и max DPR; смена пересоздаёт ShaderMaterial. На viewport ≤600 px старт/Reset принудительно low. |
| `pixelRatio` | Pixel Ratio | `1.25` | UI 0.5..2. Реальный DPR равен минимуму device DPR, этого значения и quality maxDpr. |
| `dithering` | Dithering | `0` | UI 0..0.08. Добавляет hash-noise к RGB, умноженный на alpha. Default полностью выключен. |

## 4. Quality presets

| Quality | `MAX_AURORA_LAYERS` | `maxDpr` | Комментарий |
| --- | ---: | ---: | --- |
| low | 32 | 1.0 | Mobile/fallback. |
| medium | 42 | 1.25 | Компромисс. |
| high | 50 | 1.75 | Текущий desktop default. |

### Важное следствие для `layerCount`

Число 184 сохранено потому, что именно оно стояло у пользователя в GUI при фиксации default. Но GLSL loop компилируется максимум на 50 итераций в high. Поэтому сейчас:

```text
effectiveLayers = clamp(layerCount, 1, MAX_AURORA_LAYERS)
```

Чтобы реально получить 184 samples, недостаточно изменить GUI/config. Нужно повысить `iterations` в `QUALITY_PRESETS`, пересобрать shader и проверить производительность/совместимость WebGL на целевых GPU.

## 5. Взаимодействия параметров

### Резкость линий

- Сначала `curtainSharpness` формирует исходный inverse-noise profile.
- Затем `lineSharpness` сужает или расширяет нормализованный профиль.
- После этого `bandStrength`/`bandSharpness` модулируют его по глубине.
- Затем intensity и final smoothstep могут снова визуально «залить» тонкие линии.

Поэтому для более чётких линий нельзя крутить только `lineSharpness`: слишком высокая `intensity`, низкий alpha threshold или сильные bands могут опять превратить поле в массу.

### Прозрачность

- `alphaLow/alphaHigh` определяют threshold source field.
- Дополнительный luminance gate `smoothstep(0.004, 0.05, luminance)` всегда удаляет почти чёрные samples.
- `opacity` — global multiplier после threshold.
- `compositionMask` из inside/horizontal/horizon/height masks полностью участвует в alpha; bitmap textures отсутствуют.
- `dithering` не должен создавать alpha сам по себе.

### Положение и перспектива

- `horizonY` влияет и на mask, и на начало ray plane.
- `offsetY` смещает только ray-plane coordinate относительно горизонта.
- `scaleX/scaleY` меняют угол/охват лучей.
- `curtainHeight/depthSpread` меняют 3D-like пересечения слоёв.
- `width/height/centerX` только обрезают итоговую композицию и не изменяют само поле.

### Bands

- `bandCount` — сколько периодов приходится на depth coordinate.
- `bandAlignment` — насколько полосы следуют чистой глубине вместо bent coordinate.
- `bandSharpness` — ширина профиля каждой полосы.
- `bandStrength` — насколько сильно profile затемняет/усиливает curtains.

## 6. Три уровня настроек

Текущая терминология UI намеренно разделяет три уровня:

1. **Source defaults** — значения из TypeScript-констант. Верхний `Reset Settings` возвращает их в редактор, но не меняет localStorage или clean view.
2. **Browser default** — один пользовательский combined preset в localStorage. Нижний HUD и DEBUG `Save to Default` перезаписывают его и синхронизируют `/aurora-clean`; DEBUG `Load Default Settings` загружает его обратно в редактор.
3. **File settings** — любое количество переносимых `*.aurora.json`. Верхние `Save Settings` и `Load Settings` скачивают/загружают файлы, не меняя browser default автоматически.

Основной способ передать вид на `/aurora-clean`:

1. Настроить оба слоя в `/aurora-codepen` либо загрузить файл через верхний `Load Settings`.
2. Нажать `Save to Default`; краткий label меняется на `Default saved` либо `Save failed`.
3. Нажать `Open clean view` или перейти на `/aurora-clean`.
4. Если clean view уже открыт, следующее `Save to Default` применяется там автоматически без reload.

Детали хранения:

- key: `aurora-motion-study:settings:v1`;
- schema version: `1`;
- format marker: `aurora-motion-study-preset`;
- содержимое: `savedAt`, полный `CodepenAuroraConfig`, полный `StarSkyConfig`;
- доставка: `BroadcastChannel`, `storage` event и same-page custom event;
- scope: текущий browser origin/profile/device;
- auto-save отсутствует: GUI drag/input сам по себе не меняет сохранённый документ.

Browser-default команды находятся в `DEBUG`:

- `Save to Default` записывает текущий combined preset в localStorage и clean view;
- `Load Default Settings` применяет последний валидный browser default;
- если browser default отсутствует или повреждён, текущие значения не меняются, а HUD кратко показывает `No saved default`;
- Load обновляет GUI, Three.js uniforms и React sky copy, но сам ничего не сохраняет и не синхронизирует;
- чтобы передать загруженный вариант в clean view, после Load нужно нажать `Save to Default`.

Старые version-1 документы без новых sky opacity fields остаются совместимыми: parser подставляет актуальный default `1` для отсутствующего primitive field.

### Несколько переносимых file settings

- верхний `Save Settings` скачивает текущий черновик как `aurora-preset-<ISO timestamp>.aurora.json`;
- каждый экспорт является независимым файлом, поэтому пользователь может хранить, переименовывать и организовывать любое количество вариантов;
- верхний `Load Settings` принимает один JSON-файл размером до 1 MB;
- импорт проверяет format, schema version и наличие объектов `aurora`/`sky`, затем нормализует все primitive fields через актуальные source defaults;
- повреждённый или чужой файл не меняет сцену; HUD кратко показывает `Invalid preset file`;
- загруженный file preset сразу виден в `/aurora-codepen`, но не записывает browser default и не меняет `/aurora-clean` до отдельного `Save to Default`.

Если пользователь просит изменить именно source default для чистого checkout/browser:

1. Зафиксировать точные текущие числа из GUI; не угадывать по изображению.
2. Изменить `DEFAULT_CODEPEN_AURORA_CONFIG`, `DEFAULT_STAR_SKY_CONFIG` или оба.
3. Обновить exact-value assertions в тестах и таблицы в документации.
4. Полностью перезапустить dev server.
5. Очистить старый browser default либо нажать `Reset Settings` → `Save to Default`, иначе при reload browser default ожидаемо перекроет новый source default.

Чтобы сделать source defaults текущим browser default без удаления storage: нажать `Reset Settings`, затем `Save to Default`.

## 7. Reset Settings state помимо чисел

`resetAll()` также делает:

```text
paused           false
shader debug     normal / 0
composite mode   composite
interfaceHidden  false
```

До обновления GUI display функция присваивает `DEFAULT_STAR_SKY_CONFIG` в mutable sky object и публикует новую React copy, поэтому Canvas и CSS gradient возвращаются одновременно.

`controlsVisible` сейчас не сбрасывается. Если GUI был скрыт через Hide GUI, его можно вернуть кнопкой Tune.

`Reset Settings` не вызывает `saveAuroraSettings()`. Уже открытый `/aurora-clean` поэтому остаётся на последнем browser default до следующего `Save to Default`.
