# Разработка, проверка и Git-handoff

## 1. Требования

- Windows/PowerShell — текущая среда проекта.
- Node.js **22.13+** по `package.json`.
- npm lockfile является source of truth для зависимостей.
- WebGL-capable browser для визуальной проверки.

На момент документации системный `node` в PATH был `v20.14.0`, то есть ниже заявленного engine. В Codex доступен bundled Node `v24.19.0`:

```powershell
$auroraNode = 'C:\Users\Gener\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
& $auroraNode --version
```

Путь Codex runtime специфичен для текущей машины. Если он изменился, использовать любой Node ≥22.13.

## 2. Установка

При уже существующем `node_modules` не переустанавливать зависимости без причины. Для чистого checkout:

```powershell
npm install
```

Не менять package manager и не удалять `package-lock.json`.

## 3. Dev server

Стандартно:

```powershell
npm run dev
```

Прямой запуск через bundled Node:

```powershell
$auroraNode = 'C:\Users\Gener\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
& $auroraNode '.\node_modules\vinext\dist\cli.js' dev
```

Основной URL:

```text
http://localhost:3000/aurora-codepen
```

Соседний URL:

```text
http://localhost:3000/aurora-prototype
```

Не поднимать несколько конкурирующих dev servers на одном проекте/порту. Для долгой работы сохранять одну живую сессию.

## 4. Проверки

### ESLint

```powershell
npm run lint
```

Прямо через runtime:

```powershell
& $auroraNode '.\node_modules\eslint\bin\eslint.js' .
```

### TypeScript

```powershell
npx tsc --noEmit
```

Прямо через runtime:

```powershell
& $auroraNode '.\node_modules\typescript\bin\tsc' --noEmit
```

### Production build

```powershell
npm run build
```

Прямо через runtime:

```powershell
& $auroraNode '.\node_modules\vinext\dist\cli.js' build
```

Build создаёт `dist/`, который игнорируется Git. Нефатальное предупреждение о chunk >500 kB допустимо, если build завершился успешно.

### Tests

После свежей build:

```powershell
node --test tests/rendered-html.test.mjs
```

Или напрямую:

```powershell
& $auroraNode --test 'tests/rendered-html.test.mjs'
```

Полный script с повторной build:

```powershell
npm test
```

## 5. Что проверяют тесты

Сейчас есть 4 test cases:

1. SSR shell `/aurora-prototype`.
2. SSR shell `/aurora-codepen` и наличие основных controls.
3. Критические свойства Nimitz implementation:
   - transparent renderer/blending;
   - shader attribution markers;
   - отсутствие shader-rendered sky/stars;
   - текущие exact defaults;
   - line/band controls;
   - draggable numeric inputs;
   - Hide-all-UI controls и CSS.
4. Критические свойства texture-driven route и наличие четырёх runtime assets.

Тесты source-oriented, а не pixel-perfect. Они не доказывают визуальное качество и не заменяют просмотр эффекта пользователем.

## 6. Минимальный manual checklist после визуальной правки

- `/aurora-codepen` загружается без static fallback.
- Background остаётся неподвижным и совпадает с canvas cover.
- В прозрачных промежутках видно чистое звёздное небо, нет чёрного/серого прямоугольника.
- Сияние не проходит поверх гор при Landscape Mask=true.
- Pause/Play работает.
- Background only, Aurora on, Show reference и Compare split работают.
- Numeric input принимает ручное значение.
- Drag по числу меняет значение; Shift замедляет изменение.
- Reset возвращает source defaults.
- Hide GUI скрывает только panel.
- Hide all UI убирает все подписи/controls.
- Esc, H и double-click возвращают UI.
- На узком viewport layout не блокирует всю сцену.
- Нет заметного падения FPS относительно состояния до правки.

Browser screenshots, DOM inspection и автоматические clicks выполнять только если пользователь явно попросил browser testing. Для обычной передачи достаточно build/tests и согласования визуала с пользователем в уже открытой странице.

## 7. Частые проблемы

### Reset возвращает старые значения

Наиболее вероятна старая dev-server сессия или старый client bundle.

1. Убедиться, что изменён `app/aurora-codepen/config.ts`.
2. Остановить старую dev session.
3. Запустить одну новую session.
4. Reload страницы.
5. Изменить Speed/Band Count и нажать Reset.

Не добавлять persistence как «исправление» этой проблемы.

### Canvas чёрный вместо прозрачного

Проверить:

- renderer `alpha: true`;
- clear alpha 0;
- `premultipliedAlpha: false`;
- material `transparent: true`;
- output `vec4(auroraColor, auroraAlpha)`;
- CSS background действительно отдельный DOM layer;
- debug mode не включён.

### Зелёная грязь в тёмных областях

Проверить `transparentLuminance`, alpha thresholds, dithering и sky mask. Не лечить это добавлением чёрного RGB/alpha фона.

### Линии снова стали туманом

Проверить связку `curtainSharpness`, `lineSharpness`, `bandSharpness`, `bandStrength`, `intensity`, `alphaLow/high`. Высокая intensity или слишком открытый alpha threshold способны заполнить пространство между линиями.

### Изменение Depth Layers ничего не делает после 50

Это ожидаемо при quality=high: compile-time maximum равен 50. Подробности в `docs/CONFIGURATION.md`.

### Низкий FPS

Сначала снизить quality или pixelRatio. Затем проверить band/field math. Не отключать mask/alpha и не упрощать визуал без сравнения.

## 8. Git-состояние перед первым коммитом

На аудите 2026-08-25:

```text
branch: main
HEAD: отсутствует
tracked files: отсутствуют
```

То есть первый commit станет полным baseline.

### Что является приложением и обычно должно войти в baseline

```text
.openai/hosting.json
.gitignore
AGENTS.md
README.md
docs/
app/
public/hero/
tests/
worker/
package.json
package-lock.json
vite.config.ts
next.config.ts
tsconfig.json
next-env.d.ts
eslint.config.mjs
postcss.config.mjs
```

### Что требует отдельного решения пользователя

- Корневые `01-reference.png` ... `04-sky-mask.png`: byte-identical копии `public/hero/`. Runtime использует только `public/hero/`. Корневые файлы могут быть source backup, поэтому агент не должен удалять их сам.
- `output/`: содержит сторонние imagegen results, не импортируется aurora app. Текущий `.gitignore` игнорирует `/outputs/`, но **не** `/output/`.
- `norvix/`: содержит вложенную `.git` metadata и не является частью import graph приложения.

Из-за этого перед первым коммитом безопаснее stage-ить явно выбранные пути, а не выполнять `git add -A`. Не удалять и не перемещать спорные файлы ради чистого status без согласия пользователя.

### Не коммитить build/cache

Текущий `.gitignore` исключает:

```text
node_modules/
.next/
.vinext/
dist/
.wrangler/
*.tsbuildinfo
.env*
```

## 9. Сборка/hosting

Проект содержит Sites/Cloudflare-compatible scaffold:

- `@openai/sites-vite-plugin`;
- `@cloudflare/vite-plugin`;
- Worker entry;
- `.openai/hosting.json`.

Но текущая пользовательская работа локальная. Не создавать deployment, D1/R2 bindings и не менять hosting config без явного запроса.

## 10. Definition of done для следующей правки

Правка считается завершённой, когда:

1. Выполнено точное визуальное/функциональное требование пользователя.
2. Не нарушены background transparency, landscape mask и выбранный default preset без разрешения.
3. GUI/Reset/debug controls продолжают работать.
4. TypeScript, ESLint, production build и 4 tests проходят.
5. Изменения defaults/architecture/controls отражены в docs.
6. Пользователю коротко сообщены результат и доступные способы управления.
