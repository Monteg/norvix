# Ассеты и лицензирование

## Runtime assets

Приложение не содержит и не загружает bitmap-изображения. Небо, звёзды, падающая звезда и сияние создаются процедурно. Каталоги старых изображений и texture-driven renderer удалены из client build.

## Оригинальный код проекта

К оригинальным частям относятся React-компоненты, procedural star canvas, CSS sky/compositing, persistence, file presets, adaptive device profiling, UI и project-specific controls. Для них может использоваться отдельная лицензия владельца проекта.

Для финального файла лицензии нужно указать:

- юридическое имя правообладателя;
- год;
- режим: закрытый `All rights reserved` или открытая лицензия, например MIT.

## Производная shader-часть

Активный GLSL сохраняет математическую структуру производной работы:

- Original: [Auroras / XtGGRt](https://www.shadertoy.com/view/XtGGRt)
- Author: Nimitz / `@stormoid`
- License: [Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported](https://creativecommons.org/licenses/by-nc-sa/3.0/)

Creative Commons требует сохранять attribution, указывать изменения, не использовать материал коммерчески без отдельного разрешения и распространять производную часть на совместимых условиях ShareAlike. Изменение имён файлов, uniforms, UI или части формул само по себе не прекращает действие лицензии.

Обязательное уведомление находится в `THIRD_PARTY_NOTICES.md`, а короткий header — в `app/aurora-renderer/shaders.ts`.

Для коммерческой передачи есть два безопасных пути:

1. получить отдельное письменное разрешение/лицензию автора;
2. полностью заменить производный shader независимо реализованным renderer-кодом, после чего повторно провести provenance review.

Остальной оригинальный код можно лицензировать отдельно, но такая лицензия не отменяет условия для производной shader-части. Этот документ не является юридической консультацией.
