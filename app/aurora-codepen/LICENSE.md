# Aurora shader attribution

The active aurora shader is a transparent WebGL adaptation of **“Auroras” by
Nimitz (2017)**:

- Original: https://www.shadertoy.com/view/XtGGRt
- Author: Nimitz / @stormoid
- License: Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported
- License text: https://creativecommons.org/licenses/by-nc-sa/3.0/

The adaptation removes the original sky, stars, water reflection and mouse
camera, then adds project-specific transparent compositing, procedural
composition masks, line/depth-band controls, and an independently implemented
procedural star canvas behind the shader. This derivative shader remains subject to the same
Attribution-NonCommercial-ShareAlike license.

The former Sabo Sugi raymarch implementation was removed from this route.
