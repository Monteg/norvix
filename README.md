# Aurora Motion Study

Локальный визуальный прототип северного сияния на React, Three.js и GLSL. В проекте существуют два независимых эксперимента:

- `/aurora-codepen` — текущий основной вариант: прозрачная адаптация процедурного шейдера Nimitz с управляемыми занавесями, горизонтальными/depth-полосами, масками и compositing поверх фотографии;
- `/aurora-prototype` — ранний texture-driven вариант, который анимирует готовый слой `03-aurora.png`.

Корневой маршрут `/` пока перенаправляет на `/aurora-prototype`. Пользователь в данный момент работает непосредственно с `/aurora-codepen`.

## Быстрый запуск

Требуется Node.js 22.13 или новее.

```bash
npm install
npm run dev
```

Открыть `http://localhost:3000/aurora-codepen`.

## Проверка

```bash
npm run lint
npx tsc --noEmit
npm run build
node --test tests/rendered-html.test.mjs
```

Или одной командой с повторной сборкой:

```bash
npm test
```

## Документация

- [`AGENTS.md`](./AGENTS.md) — обязательные правила для следующего AI-агента.
- [`docs/HANDOFF.md`](./docs/HANDOFF.md) — текущее состояние, история решений и точка продолжения.
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — маршруты, WebGL lifecycle, compositing и устройство шейдера.
- [`docs/CONFIGURATION.md`](./docs/CONFIGURATION.md) — полный справочник всех настроек и текущего default-пресета.
- [`docs/DEVELOPMENT.md`](./docs/DEVELOPMENT.md) — запуск, тестирование, диагностика и подготовка первого коммита.
- [`docs/ASSETS_AND_LICENSING.md`](./docs/ASSETS_AND_LICENSING.md) — изображения, контрольные суммы и лицензирование Nimitz.

## Лицензия активного шейдера

Процедурный шейдер `/aurora-codepen` является производной от “Auroras” by Nimitz и наследует лицензию Creative Commons Attribution-NonCommercial-ShareAlike 3.0. Подробности: [`app/aurora-codepen/LICENSE.md`](./app/aurora-codepen/LICENSE.md).
