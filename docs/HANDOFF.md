# Handoff: текущее состояние Aurora Motion Study

Дата фиксации: **2026-08-25**.

Этот документ — первая точка входа для AI-агента, который продолжит работу после первого Git-коммита.

## 1. Коротко о задаче

Пользователь добивается реалистичного северного сияния поверх полностью процедурного звёздного неба. Нужны не размытые зелёные облака, а хорошо читаемые световые занавеси:

- яркое основание и вертикальные лучи;
- волнистая форма и ощущение перспективы;
- выраженная полосатая/depth-структура, которой можно управлять;
- постепенный прозрачный fade;
- чистые прозрачные промежутки, через которые видно глубокое сине-чёрное небо;
- множество процедурно распределённых звёзд с очень слабым мерцанием;
- отсутствие image layers на активном маршруте.

Текущая рабочая страница: **`http://localhost:3000/aurora-codepen`**. Чистый output без интерфейса: **`http://localhost:3000/aurora-clean`**.

## 2. Что сейчас является активной реализацией

Активный вариант — прозрачная адаптация [“Auroras” by Nimitz](https://www.shadertoy.com/view/XtGGRt). Из оригинального ShaderToy удалены его небо, звёзды, отражение в воде и mouse-camera. Поле сияния выводится с alpha, а отдельный `ProceduralStarSky` создаёт фон без изображений через CSS gradients и Canvas 2D.

Ключевые файлы:

- `app/components/CodepenAuroraPrototype.tsx` — React UI, lil-gui, display modes и управление сценой;
- `app/components/CleanAuroraView.tsx` — чистый procedural sky + WebGL output без UI;
- `app/settings/savedAuroraSettings.ts` — versioned localStorage preset и межвкладочная синхронизация;
- `app/components/ProceduralStarSky.tsx` — seeded star distribution, twinkle animation и lifecycle неба;
- `app/star-sky/config.ts` — типизированные defaults градиента, звёзд и падающей звезды;
- `app/aurora-codepen/AuroraCodepenScene.ts` — Three.js renderer, uniforms, lifecycle и производительность;
- `app/aurora-codepen/shaders.ts` — активный GLSL;
- `app/aurora-codepen/config.ts` — типы, quality presets и единственный default-пресет;
- `app/globals.css` — compositing, HUD, GUI, responsive и Hide-all-UI;
- `public/hero/` — изображения только старого `/aurora-prototype`; активный маршрут их не запрашивает;
- `tests/rendered-html.test.mjs` — smoke/regression проверки.

## 3. Готовые функции

### Визуал и compositing

- Full-screen ортографическая плоскость Three.js.
- Прозрачный WebGL renderer без premultiplied alpha.
- Обычное alpha-blending поверх чистого фона.
- Отдельный процедурный фон: CSS night gradients + детерминированные Canvas-звёзды.
- Слабое индивидуальное мерцание звёзд с частотой от 0.32 до 1.14 и малой амплитудой.
- Редкая падающая звезда с gradient trail, случайным стартом и ручной кнопкой `Launch Now`.
- Live-настройки цветов/геометрии градиента, haze, цветов/плотности/яркости/размера звёзд, vertical start/fade и twinkle.
- Контролируемые вертикальные curtain lines.
- Дополнительные периодические полосы по глубине с количеством, выравниванием, силой и резкостью.
- Регулируемые положение, масштаб, ширина, высота, горизонт, цвета, alpha, glow и качество.
- Debug-вывод alpha, horizon mask, horizontal mask и сырого поля сияния.
- При сбое WebGL остаётся процедурное небо, а статус сообщает о fallback; image fallback отсутствует.

### Управление

- Нижний HUD: Pause, Starfield only, Aurora on, Save settings, Open clean view, Hide all UI, Hide GUI/Tune.
- lil-gui содержит SKY / Gradient, Stars, Shooting Star, а также Aurora Motion, Position, Light, Mask, Nimitz Field, Render и Debug.
- Визуальные числовые поля без min/max: можно ввести любое число.
- Дополнительный scrub: зажать левую кнопку на числе и вести мышь влево/вправо.
- `Shift` во время scrub даёт точность ×0.1.
- Обычный клик по числу сохраняет ручной ввод.
- `Save settings` явно сохраняет текущие Aurora + Sky values и отправляет их во все открытые clean-view вкладки.
- `Open clean view` открывает `/aurora-clean` в новой вкладке. Там нет заголовков, HUD, GUI или подписей.
- `Reset` читает значения из `DEFAULT_CODEPEN_AURORA_CONFIG`.
- `Hide all UI` убирает заголовок, HUD, perf badge, GUI и подпись.
- Вернуть полный UI: `Esc`, `H` или двойной клик по сцене.
- `H` не перехватывается, когда пользователь печатает в input/select/textarea/contenteditable.

### Производительность и устойчивость

- Quality presets: low/medium/high.
- Device pixel ratio ограничивается одновременно настройкой `pixelRatio` и quality preset.
- На viewport ≤600 px при старте и Reset выбирается `low`.
- Анимация останавливается при Pause, `prefers-reduced-motion`, скрытой вкладке или выходе сцены из viewport.
- Star canvas мерцает не чаще 30 FPS и использует те же Pause/reduced-motion/visibility/intersection ограничения.
- ResizeObserver обновляет renderer и aspect uniforms.
- WebGL context loss переводит страницу на fallback.
- FPS/разрешение/DPR показываются в perf badge.

## 4. Текущий default-пресет

Source of truth: `DEFAULT_CODEPEN_AURORA_CONFIG` в `app/aurora-codepen/config.ts`.

```text
speed             2.16
seed             44.8
offsetX           0.003
offsetY           0.152
scaleX            0.101
scaleY            0.176
width             0.97
height            0.958
centerX           0.63
intensity         2.46
opacity           0.921
alphaLow         -0.813
alphaHigh         1.04
colorBase        #75ffbd
colorHigh        #7c6bff
colorMix          0.588
saturation        1.634
horizonY          0.238
horizonFeather   -0.15
edgeFade         20.131
centerBias        0.283
noiseScale        1
warpStrength      1
curtainSharpness  1
lineSharpness     1.27
bandCount        64
bandAlignment     4
bandStrength      0.825
bandSharpness     1.06
layerCount      184
curtainHeight     0.803
depthSpread       0.0019
lowerGlow        -1
pixelRatio        1.25
dithering         0
quality           high
```

Полные формулы, реальные clamp-ограничения GLSL и влияние каждого параметра: `docs/CONFIGURATION.md`.

Star-sky source of truth: `DEFAULT_STAR_SKY_CONFIG` в `app/star-sky/config.ts`.

```text
skyTopColor             #01040d
skyMiddleColor          #041326
skyBottomColor          #082039
gradientMidpoint        0.62
horizonGlowColor        #175278
horizonGlowPosition     1.12
horizonGlowSize         0.62
horizonGlowStrength     0.52
hazeStrength            0.72
starPrimaryColor        #dcebff
starSecondaryColor      #fff7e0
starColorMix            1
starDensity             1
starBrightness          1
starSize                1
starStartY             -0.08
starFadeStartY          0.72
starFadeEndY            1.04
twinkleAmount           1
twinkleSpeed            1
shootingStarEnabled     true
shootingStarColor       #e4f6ff
shootingStarInterval    14
shootingStarBrightness  0.92
shootingStarSpeed       850
shootingStarLength      150
shootingStarAngle       24
shootingStarThickness   1.25
```

## 5. История решений

Эти решения важны: не возвращать отвергнутые подходы без явной просьбы пользователя.

1. Сначала был сделан `/aurora-prototype`, который деформирует готовую текстуру `03-aurora.png`.
2. Затем исследовалась procedural/raymarch реализация [Sabo Sugi CodePen](https://codepen.io/sabosugi/pen/XJjoprL).
3. Для усиления полос был добавлен отдельный самодельный Ribbon-слой. Пользователю не понравилась его плоская X-ориентация и несоответствие перспективе.
4. Ribbon был полностью отменён. Возврат к Sabo Sugi тоже не дал нужной чистоты/структуры.
5. Рассматривался [jhereg00 CodePen](https://codepen.io/jhereg00/pen/JKbQyR), но он не стал финальной базой.
6. Пользователь выбрал Nimitz ShaderToy `XtGGRt` как наиболее близкий визуально вариант.
7. В Nimitz-адаптацию добавлены line sharpness и управляемые depth bands.
8. У визуальных numeric settings убраны GUI min/max и добавлен horizontal mouse scrubbing.
9. Ранняя попытка одновременно добавить Save Settings/localStorage и агрессивнее изменить прозрачность была отменена как неподходящая.
10. Текущий набор чисел был вручную признан default-пресетом и записан в source. Reset был отдельно проверен после полного перезапуска dev server.
11. Последним добавлен режим полного скрытия интерфейса с восстановлением через Esc/H/double-click.
12. После baseline-коммита пользователь попросил полностью убрать изображения из активной сцены. Background, reference, compare split и bitmap sky mask удалены из `/aurora-codepen`; добавлен отдельный процедурный star canvas со слабым мерцанием. Старый image-based route и сами PNG сохранены.
13. Затем добавлены полные SKY controls и редкая настраиваемая падающая звезда. Настройки неба получили отдельный source default и включены в общий Reset.
14. Новым отдельным требованием пользователь вернул сохранение: добавлен явный combined Save settings, versioned browser storage и чистая `/aurora-clean`, которая автоматически получает только сохранённые изменения. Это не возвращает отвергнутую правку прозрачности.

## 6. Что важно не сломать

- Не добавлять чёрный цвет в прозрачные участки WebGL.
- Не смешивать небо в Nimitz shader color: фон — отдельный procedural Canvas/CSS слой.
- Не возвращать PNG, reference overlay, compare split или bitmap sky mask в активный маршрут без новой просьбы пользователя.
- Не хардкодить новый sky-вид в Canvas/CSS мимо `StarSkyConfig`: пользователь должен иметь возможность настроить его из GUI.
- Не заменять NormalBlending на additive без визуальной проверки: это резко меняет яркость и прозрачность.
- Не размывать линии постпроцессом или CSS filter.
- Не возвращать отдельный flat Ribbon поверх Nimitz field.
- Не вводить min/max для экспериментальных numeric controls без просьбы пользователя.
- Не превращать явное сохранение в auto-save: clean view должен меняться только после `Save settings`.
- Не добавлять видимый UI или текст в `/aurora-clean`.
- Не менять default-пресет только ради «более правильных» математических диапазонов: текущие намеренно содержат значения вне обычных 0..1.
- Не забывать, что `layerCount: 184` визуально ограничивается compile-time максимумом quality preset.
- Не удалять shader debug инструменты alpha/horizon/horizontal/field.
- Сохранять virtual square coordinate mapping Nimitz field, чтобы сама аура не сместилась после удаления изображения.

## 7. Известные особенности и потенциальные улучшения

Это не автоматически одобренные задачи, а карта мест, которые следующий агент должен понимать.

- Корень `/` всё ещё ведёт на старый `/aurora-prototype`, хотя текущая работа идёт на `/aurora-codepen`.
- Название папки/компонента `CodepenAurora` историческое; фактический источник сейчас ShaderToy Nimitz.
- `layerCount` может показывать 184, но effective value равен 32/42/50 для low/medium/high. Если пользователь захочет реальные 184 слоёв, потребуется поднять compile-time loop и оценить FPS/GPU compatibility.
- Все основные numeric controllers намеренно не ограничены. Экстремальные значения способны дать NaN, чёрный кадр, инверсию маски или очень низкий FPS.
- `horizonFeather: -0.15` фактически превращается в `0.001` из-за GLSL `max()`.
- `edgeFade: 20.131` намного больше UV-диапазона и поэтому делает edge masks почти полностью открытыми.
- `bandAlignment: 4` выходит за 0..1 и заставляет GLSL `mix()` экстраполировать. Это часть текущего вида, не ошибка парсинга.
- `lowerGlow: -1` подавляет нижнее свечение; значения ниже могут приводить к отрицательному множителю до последующего pipeline.
- Reset возвращает полный visual/debug state, но не принудительно открывает panel-only `controlsVisible` после Hide GUI.
- Reset не удаляет/перезаписывает browser saved preset. Для синхронизации reset-состояния нужно отдельно нажать Save settings.
- Saved preset является same-origin/same-browser state, не серверной публикацией и не синхронизацией между устройствами.
- Количество звёзд автоматически зависит от площади viewport и ограничено 260..720; при resize позиции детерминированно пересоздаются.
- Star canvas ограничен DPR 1.5 и 30 FPS независимо от DPR/quality Nimitz renderer.
- Во время активной падающей звезды star canvas временно переходит на 60 FPS, после чего возвращается к 30 FPS.
- `shootingStarInterval` — средний интервал; фактическая задержка случайно варьируется в пределах 0.65..1.35 от него.
- Numerical SKY GUI не имеет min/max, но Canvas применяет внутренние safety clamps, описанные в `docs/CONFIGURATION.md`.
- Нет end-to-end screenshot regression; текущие тесты проверяют server HTML и критические фрагменты source.
- Production build выдаёт нефатальное предупреждение о client chunk >500 kB, главным образом из-за Three.js/lil-gui.

## 8. Как продолжить следующую пользовательскую правку

1. Спросить/прочитать конкретную новую правку пользователя; не пытаться заранее реализовать перечисленные выше потенциальные улучшения.
2. Проверить `git status` и убедиться, что рабочее дерево после пользовательского коммита чистое либо понять, какие изменения уже принадлежат пользователю.
3. Запустить dev server на Node 22.13+.
4. Настройки менять на `/aurora-codepen`; `/aurora-clean` использовать только как чистый output, если пользователь явно не просит изменить его контракт.
5. Для визуального параметра сначала найти существующий uniform/формулу в `shaders.ts`; не создавать дублирующий слой без необходимости.
6. Сохранять исходный default-пресет до тех пор, пока пользователь явно не попросит сохранить новый.
7. После изменения выполнить lint, typecheck, build и tests.
8. Если проверяется Reset, сначала убедиться, что dev server действительно перезапущен и отдаёт новый bundle.
9. Обновить эту документацию, если изменились архитектура, controls, defaults, лицензия или известные ограничения.

## 9. Статус на момент передачи

- Локальный URL `/aurora-codepen` отвечает HTTP 200.
- Последняя production build успешна.
- TypeScript и ESLint успешны.
- Все 6 тестов проходят, включая SSR чистого маршрута и source-level проверку persistence/sync.
- Публикация не выполнялась.
- Git branch: `main`.
- Baseline-коммит пользователя существует: `7971cd9 first` в branch `main`.
- Переход на procedural sky выполнен после baseline и должен быть отдельным следующим изменением/коммитом.
- Посторонняя папка `norvix/` остаётся untracked и не относится к этой правке.
