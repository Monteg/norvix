# Справочник настроек `/aurora-codepen`

## 1. Source of truth

Тип и исходный пресет находятся в:

```text
app/aurora-codepen/config.ts
```

Runtime flow:

```text
DEFAULT_CODEPEN_AURORA_CONFIG
  → configRef в React
  → lil-gui мутирует объект
  → AuroraCodepenScene.setConfig()
  → ShaderMaterial uniforms
  → fragment shader
```

Нет localStorage, cookies, server persistence или Save Settings. Reload создаёт новую копию source default. `Reset` также создаёт новую копию source default; на viewport ≤600 px дополнительно меняет quality на low.

## 2. Почему в GUI нет min/max

Все визуальные numeric controls добавляются через:

```ts
folder.add(config, property)
```

Это намеренное решение пользователя: можно вводить числа вне обычных диапазонов и экспериментировать. Внутренний drag по числу также не ограничивает значение. Но GLSL в некоторых местах всё равно применяет `max`, `abs` или `clamp`; реальные ограничения перечислены ниже.

Только технические Render settings ограничены UI:

- Pixel Ratio: 0.5..2;
- Dithering: 0..0.08;
- Quality: low/medium/high.

## 3. Полная таблица параметров

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
| `useSkyMask` | Landscape Mask | `true` | `uUseSkyMask` | Смешивает белую маску с bitmap `04-sky-mask.png`. `true` защищает горы/воду. |

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
- `compositionMask` и sky bitmap полностью участвуют в alpha.
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

## 6. Как сохранить новый default по просьбе пользователя

Сейчас кнопки Save Settings нет. Если пользователь говорит «сохрани текущие настройки по умолчанию»:

1. Зафиксировать точные текущие числа из GUI; не угадывать по изображению.
2. Изменить только `DEFAULT_CODEPEN_AURORA_CONFIG`.
3. Обновить exact-value assertions в `tests/rendered-html.test.mjs`.
4. Обновить таблицу default в этом файле и краткий список в `docs/HANDOFF.md`.
5. Полностью перезапустить dev server.
6. Изменить одно заметное значение в GUI, нажать Reset и проверить, что вернулся новый source default.
7. Перезагрузить страницу и проверить тот же preset.

Не добавлять localStorage или auto-save, если пользователь отдельно не вернул это требование.

## 7. Reset state помимо чисел

`resetAll()` также делает:

```text
paused           false
shader debug     normal / 0
composite mode   composite
reference        hidden
reference alpha  0.5
compare split    off
split position   50
interfaceHidden  false
```

`controlsVisible` сейчас не сбрасывается. Если GUI был скрыт через Hide GUI, его можно вернуть кнопкой Tune.
