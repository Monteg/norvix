# Разработка, проверка и передача

## 1. Требования

- Node.js 22.13+;
- npm lockfile является source of truth;
- WebGL-capable browser.

В текущей Codex-среде использовать bundled Node:

```text
C:\Users\Gener\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe
```

## 2. Запуск

```text
npm install
npm run dev
```

- `http://localhost:3000/` — финальный вид;
- `http://localhost:3000/settings` — configurator.

Не поднимать несколько dev servers на одном порту.

## 3. Обязательные проверки

```text
npm run lint
npx tsc --noEmit
npm run build
node --test tests/rendered-html.test.mjs
```

Тесты проверяют:

1. SSR чистого корневого вида;
2. SSR редактора;
3. persistence/file preset workflow;
4. прозрачный WebGL и adaptive performance;
5. отсутствие legacy routes, shaders и bitmap assets.

## 4. Manual checklist

- `/` не содержит текста, HUD, GUI или кнопок;
- в прозрачных промежутках ауры видны небо и звёзды;
- `/settings` управляет sky, stars, shooting star и aurora;
- `Save to Default` синхронизирует уже открытый `/`;
- file `Save Settings`/`Load Settings` не публикует preset без отдельного `Save to Default`;
- Pause и reduced-motion останавливают анимацию;
- скрытая или невидимая сцена не продолжает рендер;
- performance badge показывает фактический quality cap;
- на слабом устройстве DPR и FPS ниже desktop-профиля;
- браузер не запрашивает PNG/JPG/WebP.

Browser screenshots, DOM inspection и автоматические clicks выполнять только по явной просьбе пользователя.

## 5. Производительность

При низком FPS сначала проверить фактический device tier в `app/performance.ts`. Не увеличивать compile-time loops и DPR для мобильных устройств. Обычное изменение uniform не должно менять размер drawing buffer.

Ключевые ограничения:

- low: 24 layers, 30 FPS, DPR 0.9;
- medium: 36 layers, 45 FPS, DPR 1.15;
- high: 50 layers, 60 FPS, DPR 1.5;
- stars: 18/24/30 FPS;
- star samples: 1080/1440/1800.

При устойчивом FPS ниже 72% target renderer после двух окон измерения автоматически понижает effective quality на одну ступень. Performance badge показывает результат.

## 6. Частые проблемы

### Чёрный прямоугольник

Проверить alpha context, clear alpha 0, `premultipliedAlpha: false`, `SRC_ALPHA / ONE_MINUS_SRC_ALPHA` blending и финальный sRGB-цвет с `auroraAlpha`.

### Линии превратились в туман

Проверить `curtainSharpness`, `lineSharpness`, `bandSharpness`, `bandStrength`, `intensity` и `alphaLow/high`.

### Reset возвращает неожиданный вид

`Reset Settings` использует source defaults. Reload снова загружает browser-default, пока не выполнить `Reset Settings` → `Save to Default` или не очистить `aurora-motion-study:settings:v1`.

### Финальный вид не обновился

Обе страницы должны быть на одном origin. Проверить успешный `Save to Default`; затем reload `/`. BroadcastChannel имеет fallback через storage event.

## 7. Git-гигиена

- Не коммитить `node_modules/`, `.vinext/`, `dist/`, `.wrangler/`, `*.tsbuildinfo` и `.env*`.
- Не использовать `git add -A`: untracked `norvix/` не относится к приложению.
- Legacy assets удалены осознанно; до коммита они восстановимы из Git.

## 8. Hosting

Проект сохраняет Sites/Cloudflare-compatible scaffold, но остаётся локальным. Не публиковать и не менять `.openai/hosting.json` без отдельной просьбы.
