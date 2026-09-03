# Инструкции для AI-агентов

Область действия — весь репозиторий.

## Перед изменениями

1. Полностью прочитать `docs/HANDOFF.md`.
2. Для визуала прочитать `docs/ARCHITECTURE.md` и `docs/CONFIGURATION.md`.
3. Для запуска или подготовки коммита прочитать `docs/DEVELOPMENT.md`.
4. Для shader/licensing прочитать `docs/ASSETS_AND_LICENSING.md`.

## Текущий продукт

- `/` — финальный output: только процедурное небо и сияние, без интерфейса.
- `/settings` — единственный configurator с HUD и lil-gui.
- Bitmap assets, texture-driven renderer и исследовательские маршруты удалены. Не возвращать их без явной просьбы.
- Небо и прозрачная WebGL-аура остаются отдельными слоями.
- В промежутках сияния должны быть видны глубокое небо и звёзды; непрозрачный прямоугольник WebGL недопустим.

## Настройки

- Source defaults: `DEFAULT_AURORA_CONFIG` и `DEFAULT_STAR_SKY_CONFIG`.
- `Reset Settings` возвращает source defaults только в редакторе.
- `Save to Default` пишет combined preset в versioned localStorage и синхронизирует `/`.
- `Load Default Settings` читает browser-default только в редактор.
- `Save Settings`/`Load Settings` скачивают и загружают `*.aurora.json`; file load не публикуется до `Save to Default`.
- Визуальные numeric controls не имеют min/max и поддерживают horizontal scrub. Ограничены только технические Render controls.

## Производительность

- `app/performance.ts` определяет device tier и ограничивает фактические quality, DPR, FPS и star samples.
- Пользовательская `quality` — верхняя граница; фактическое качество может быть ниже на слабом устройстве.
- Не удалять pause/reduced-motion/visibility/intersection lifecycle.
- Не вызывать resize WebGL при обычном изменении uniform: resize нужен только для размера, DPR или effective quality.
- Compile-time loops: 24/36/50 для low/medium/high.

## Лицензирование

- Активный GLSL содержит производную часть с обязательной CC BY-NC-SA 3.0 attribution.
- Не удалять header из `app/aurora-renderer/shaders.ts` и `THIRD_PARTY_NOTICES.md` без документально подтверждённого разрешения правообладателя или полной независимой замены shader-кода.
- Новые оригинальные части могут иметь отдельную лицензию владельца проекта, но она не отменяет third-party terms.

## Правила изменений

- Не публиковать и не менять `.openai/hosting.json` без явной просьбы.
- Не трогать `norvix/`.
- Новую aurora-настройку проводить через type/default → GUI → uniform → `updateUniforms()` → GLSL → test → docs.
- Новую sky-настройку проводить через `StarSkyConfig`/default → GUI → React config → `ProceduralStarSky` → test → docs.
- При изменении defaults обновлять assertions и `docs/CONFIGURATION.md`.
- Не добавлять UI или текст на `/`.

## Обязательная проверка

Использовать Node.js 22.13+:

```text
npm run lint
npx tsc --noEmit
npm run build
node --test tests/rendered-html.test.mjs
```

Не использовать `git add -A`: `norvix/` не относится к приложению.
