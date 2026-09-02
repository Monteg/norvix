# Ассеты и лицензирование

## 1. Runtime assets

Активный `/aurora-codepen` больше не читает изображения вообще. Файлы `public/hero/` сохранены для старого `/aurora-prototype`, который обращается к ним по URL `/hero/<name>`.

Все четыре изображения имеют размер **2048×2048** и общую систему координат. Это критично: фон, reference, extracted aurora и sky mask должны совпадать пиксель-в-пиксель до применения общего `cover` transform.

| Файл | Размер | SHA-256 | Назначение |
| --- | ---: | --- | --- |
| `01-reference.png` | 4,296,730 B | `72E0282F54476FEF70C7E0B2926C7A271EC0435344DA58E420F22E1CB31C3925` | Reference/overlay/fallback только старого route. |
| `02-background-clean.png` | 4,180,234 B | `9839E651342891C62D6C83C2E5559C3FAD8169F0A4B2A6A78167E497DA5770A6` | DOM background только старого route. |
| `03-aurora.png` | 4,183,853 B | `5DC3F5E021B7A6924291BB45D1E86642C1171975EB240ABC60C391A596EB6BB1` | Извлечённый texture-driven слой сияния только старого route. |
| `04-sky-mask.png` | 65,717 B | `F9AFA2F86B79BC878531857A8BA4B76B3523DA762F0213D752BCEEDC222EFB0C` | Grayscale landscape mask только старого route. |

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

## 3. Координатное совпадение старого маршрута

DOM images используют:

```css
object-fit: cover;
object-position: 50% 50%;
```

Старый shader повторяет этот transform в `coverUv()`, а его sky mask sampling использует те же artwork UV. Активный Nimitz shader сохраняет квадратное `uImageAspect = 1` только как virtual design space, чтобы внешний вид ауры не сместился после удаления PNG.

Следствия:

- нельзя независимо менять object-position background/reference;
- нельзя ресайзить mask отдельно от остальных source images;
- при замене изображений старого route с другим aspect нужно обновить его asset mapping и проверить cover formula.

## 4. Texture configuration

Активная Nimitz scene не создаёт `TextureLoader`, `DataTexture`, sampler uniforms или image requests.

Texture-driven route загружает `03-aurora.png` в sRGB и `04-sky-mask.png` в NoColorSpace с linear filtering, ClampToEdge и без mipmaps.

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
- compositing с отдельным процедурным star canvas;
- сохранённое virtual-square coordinate mapping;
- полностью texture-free active route;
- position/scale/mask/light controls;
- custom colors;
- configurable quality/layers/DPR;
- curtain and line sharpness;
- controllable depth bands;
- debug modes;
- pause/reduced-motion/visibility lifecycle.

Процедурное звёздное небо является новым локальным кодом проекта, а не возвращённым starfield из оригинального Nimitz ShaderToy.

## 7. Исторические визуальные источники

Они использовались для исследования, но не являются активной codebase foundation:

- [Sabo Sugi “Northern Lights (Aurora Borealis)”](https://codepen.io/sabosugi/pen/XJjoprL) — ранняя raymarch/CodePen база, позднее отвергнута.
- [jhereg00 CodePen JKbQyR](https://codepen.io/jhereg00/pen/JKbQyR) — рассматривался как источник дополнительной структуры, но не стал финальным runtime implementation.

Не копировать из этих источников новый код без проверки их текущей лицензии и явной необходимости.

## 8. Права на пользовательские изображения

Отдельных license-файлов для четырёх PNG в репозитории нет. Они были предоставлены пользователем и сохранены для старого маршрута/истории. Не публиковать, перепродавать и не переносить их в другой проект, предполагая свободную лицензию. Активный `/aurora-codepen` теперь можно запускать без этих изображений.

## 9. Посторонние локальные изображения

`output/imagegen/` содержит несколько PNG, не связанных import graph с aurora app. На момент аудита они не используются ни одним маршрутом. Не переносить их в `public/` и не включать в baseline commit без отдельного решения пользователя.
