# Ассеты и лицензирование

## 1. Runtime assets

Приложение читает изображения только из `public/hero/` по URL `/hero/<name>`.

Все четыре изображения имеют размер **2048×2048** и общую систему координат. Это критично: фон, reference, extracted aurora и sky mask должны совпадать пиксель-в-пиксель до применения общего `cover` transform.

| Файл | Размер | SHA-256 | Назначение |
| --- | ---: | --- | --- |
| `01-reference.png` | 4,296,730 B | `72E0282F54476FEF70C7E0B2926C7A271EC0435344DA58E420F22E1CB31C3925` | Полный целевой/reference кадр с сиянием. Используется overlay, compare split и WebGL fallback. |
| `02-background-clean.png` | 4,180,234 B | `9839E651342891C62D6C83C2E5559C3FAD8169F0A4B2A6A78167E497DA5770A6` | Пейзаж и звёздное небо без активного сияния. Базовый DOM background обоих маршрутов. |
| `03-aurora.png` | 4,183,853 B | `5DC3F5E021B7A6924291BB45D1E86642C1171975EB240ABC60C391A596EB6BB1` | Извлечённый texture-driven слой сияния. Используется только `/aurora-prototype`; активный Nimitz route его не использует. |
| `04-sky-mask.png` | 65,717 B | `F9AFA2F86B79BC878531857A8BA4B76B3523DA762F0213D752BCEEDC222EFB0C` | Grayscale mask, разрешающая сияние в небе и защищающая ландшафт. Используется обоими маршрутами. |

Контрольные суммы сняты 2026-08-25. Если изменяется любой asset, обновить эту таблицу и проверить оба маршрута.

## 2. Корневые копии

В корне репозитория также лежат:

```text
01-reference.png
02-background-clean.png
03-aurora.png
04-sky-mask.png
```

На момент аудита они byte-identical соответствующим `public/hero/` файлам. Код их не импортирует. Вероятно, это исходные/резервные копии пользователя. Не удалять автоматически; перед первым Git-коммитом пользователь должен решить, нужны ли обе копии.

## 3. Координатное совпадение

DOM images используют:

```css
object-fit: cover;
object-position: 50% 50%;
```

Active shader повторяет этот transform в `coverUv()` для квадратного `uImageAspect = 1`. Sky mask sampling использует те же artwork UV.

Следствия:

- нельзя независимо менять object-position background/reference;
- нельзя ресайзить mask отдельно от остальных source images;
- при замене изображений с другим aspect нужно обновить `IMAGE_ASPECT`/asset metadata и проверить cover formula;
- CSS/GLSL mismatch сразу проявится зелёным сиянием поверх гор или смещённым compare split.

## 4. Texture configuration

Sky mask в активной сцене:

- `THREE.NoColorSpace`;
- Linear min/mag filters;
- ClampToEdge по S/T;
- без mipmaps.

Если mask не загрузилась, создаётся белая 1×1 DataTexture. Это сохраняет визуал сияния, но временно перестаёт защищать ландшафт; component не считает такой fallback полной WebGL failure.

Texture-driven route дополнительно загружает `03-aurora.png` в sRGB и свою mask в NoColorSpace.

## 5. Лицензия активного GLSL

Активный shader — производная работа:

- Original: [Auroras / ShaderToy XtGGRt](https://www.shadertoy.com/view/XtGGRt)
- Author: Nimitz / `@stormoid`
- Year: 2017
- License: [Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported](https://creativecommons.org/licenses/by-nc-sa/3.0/)

Локальный attribution также хранится в:

```text
app/aurora-codepen/LICENSE.md
app/aurora-codepen/shaders.ts (header comment)
```

### Обязательные последствия

- Attribution Nimitz нельзя удалять.
- Производная shader-работа остаётся ShareAlike.
- Лицензия NonCommercial: перед коммерческим использованием требуется отдельная юридическая/лицензионная оценка и, возможно, разрешение автора.
- При переносе shader в другой проект переносить attribution и license notice вместе с кодом.

Этот документ не является юридической консультацией.

## 6. Что изменено относительно оригинального Nimitz shader

Удалено:

- procedural sky;
- stars;
- water/reflection pass;
- original camera/mouse interaction;
- непрозрачный итоговый фон.

Добавлено/адаптировано:

- transparent alpha output;
- DOM compositing с пользовательской фотографией;
- artwork-cover coordinate mapping;
- bitmap landscape mask;
- position/scale/mask/light controls;
- custom colors;
- configurable quality/layers/DPR;
- curtain and line sharpness;
- controllable depth bands;
- debug modes;
- pause/reduced-motion/visibility lifecycle.

## 7. Исторические визуальные источники

Они использовались для исследования, но не являются активной codebase foundation:

- [Sabo Sugi “Northern Lights (Aurora Borealis)”](https://codepen.io/sabosugi/pen/XJjoprL) — ранняя raymarch/CodePen база, позднее отвергнута.
- [jhereg00 CodePen JKbQyR](https://codepen.io/jhereg00/pen/JKbQyR) — рассматривался как источник дополнительной структуры, но не стал финальным runtime implementation.

Не копировать из этих источников новый код без проверки их текущей лицензии и явной необходимости.

## 8. Права на пользовательские изображения

Отдельных license-файлов для четырёх PNG в репозитории нет. Они были предоставлены пользователем для этого проекта. Не публиковать, перепродавать и не переносить их в другой проект, предполагая свободную лицензию. Если проект будет деплоиться публично или коммерчески, отдельно подтвердить права на изображения.

## 9. Посторонние локальные изображения

`output/imagegen/` содержит несколько PNG, не связанных import graph с aurora app. На момент аудита они не используются ни одним маршрутом. Не переносить их в `public/` и не включать в baseline commit без отдельного решения пользователя.
