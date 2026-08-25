/*
 * Transparent WebGL adaptation of "Auroras" by Nimitz (2017).
 * Original: https://www.shadertoy.com/view/XtGGRt
 * Author: Nimitz / @stormoid
 * License: Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported.
 *
 * The original sky, stars, reflection pass and mouse camera were removed so the
 * aurora can be composited over the project's existing landscape photograph.
 */

export const codepenAuroraVertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

export const codepenAuroraFragmentShader = /* glsl */ `
  precision highp float;

  uniform vec2 iResolution;
  uniform float iTime;
  uniform float uDithering;
  uniform float uSpeed;
  uniform float uSeed;
  uniform vec3 uColorBase;
  uniform vec3 uColorHigh;
  uniform float uColorMix;
  uniform float uSaturation;
  uniform float uImageAspect;
  uniform float uViewportAspect;
  uniform float uAuroraOffsetX;
  uniform float uAuroraOffsetY;
  uniform float uAuroraScaleX;
  uniform float uAuroraScaleY;
  uniform float uAuroraWidth;
  uniform float uAuroraHeight;
  uniform float uAuroraCenterX;
  uniform float uAuroraIntensity;
  uniform float uAuroraOpacity;
  uniform float uAlphaLow;
  uniform float uAlphaHigh;
  uniform float uHorizonY;
  uniform float uHorizonFeather;
  uniform float uEdgeFade;
  uniform float uCenterBias;
  uniform float uNoiseScale;
  uniform float uWarpStrength;
  uniform float uCurtainSharpness;
  uniform float uLineSharpness;
  uniform float uBandCount;
  uniform float uBandAlignment;
  uniform float uBandStrength;
  uniform float uBandSharpness;
  uniform float uLayerCount;
  uniform float uCurtainHeight;
  uniform float uDepthSpread;
  uniform float uLowerGlow;
  uniform float uUseSkyMask;
  uniform sampler2D uSkyMask;
  uniform float uDebugMode;

  varying vec2 vUv;

  const mat2 NIMITZ_ROTATION = mat2(0.95534, -0.29552, 0.29552, 0.95534);

  mat2 rotate2d(float angle) {
    float cosine = cos(angle);
    float sine = sin(angle);
    return mat2(cosine, sine, -sine, cosine);
  }

  float triangleWave(float value) {
    return clamp(abs(fract(value) - 0.5), 0.01, 0.49);
  }

  vec2 trianglePair(vec2 point) {
    return vec2(
      triangleWave(point.x) + triangleWave(point.y),
      triangleWave(point.y + triangleWave(point.x))
    );
  }

  float hash21(vec2 point) {
    return fract(sin(dot(point, vec2(12.9898, 4.1414))) * 43758.5453);
  }

  float triangularCurtainNoise(vec2 point) {
    float amplitude = 1.8;
    float displacementScale = 2.5;
    float accumulated = 0.0;
    point *= rotate2d(point.x * 0.06 * uWarpStrength);
    vec2 basePoint = point;
    mat2 timeRotation = rotate2d(iTime * uSpeed * 0.06);

    for (int octave = 0; octave < 5; octave++) {
      vec2 displacement = trianglePair(basePoint * 1.85) * 0.75;
      displacement *= timeRotation;
      point -= displacement / displacementScale * uWarpStrength;

      basePoint *= 1.3;
      displacementScale *= 0.45;
      amplitude *= 0.42;
      point *= 1.21 + (accumulated - 1.0) * 0.02 * uWarpStrength;
      accumulated += triangleWave(point.x + triangleWave(point.y)) * amplitude;
      point = point * -NIMITZ_ROTATION;
    }

    return clamp(
      1.0 / pow(max(accumulated * 29.0, 0.0001), max(uCurtainSharpness, 0.2)),
      0.0,
      0.55
    );
  }

  vec4 renderNimitzAurora(vec3 rayOrigin, vec3 rayDirection, vec2 fragCoord) {
    vec4 accumulatedColor = vec4(0.0);
    vec4 averagedColor = vec4(0.0);
    float effectiveLayers = clamp(uLayerCount, 1.0, float(MAX_AURORA_LAYERS));
    float layerStep = 50.0 / effectiveLayers;
    float pixelJitter = hash21(fragCoord + vec2(uSeed * 17.0, uSeed * 29.0));
    vec2 seedOffset = vec2(
      fract(uSeed * 0.173) * 37.0,
      fract(uSeed * 0.291) * 53.0
    );

    for (int layerIndex = 0; layerIndex < MAX_AURORA_LAYERS; layerIndex++) {
      if (float(layerIndex) >= effectiveLayers) break;

      float layer = (float(layerIndex) + pixelJitter) * layerStep;
      float depthJitter = 0.006 * pixelJitter * smoothstep(0.0, 15.0, layer);
      float distanceAlongRay = (
        uCurtainHeight + pow(layer, 1.4) * uDepthSpread - rayOrigin.y
      ) / max(rayDirection.y * 2.0 + 0.4, 0.02);
      distanceAlongRay -= depthJitter;

      vec3 samplePosition = rayOrigin + distanceAlongRay * rayDirection;
      vec2 noisePoint = samplePosition.zx * uNoiseScale + seedOffset;
      float curtain = triangularCurtainNoise(noisePoint);
      float normalizedCurtain = clamp(curtain / 0.55, 0.0, 1.0);
      curtain = pow(normalizedCurtain, max(uLineSharpness, 0.05)) * 0.55;
      float depthMix = clamp(layer / 50.0, 0.0, 1.0);
      float bandBend =
        sin(noisePoint.y * 0.16 + iTime * uSpeed * 0.04 + uSeed * 0.01) * 0.045 +
        sin(noisePoint.y * 0.41 - iTime * uSpeed * 0.025) * 0.018;
      float looseBandCoordinate = depthMix + bandBend + (pixelJitter - 0.5) * 0.012;
      float bandCoordinate = mix(looseBandCoordinate, depthMix, uBandAlignment);
      float bandWave = 0.5 + 0.5 * cos(
        bandCoordinate * 6.2831853 * max(abs(uBandCount), 0.001)
      );
      float bandProfile = pow(max(bandWave, 0.0), max(uBandSharpness, 0.05));
      float bandWeight = max(
        0.0,
        mix(1.0, mix(0.1, 1.8, bandProfile), max(uBandStrength, 0.0))
      );
      curtain *= bandWeight;
      vec3 nativeTint = (
        sin(1.0 - vec3(2.15, -0.5, 1.2) + layer * 0.043) * 0.5 + 0.5
      );
      vec3 customTint = mix(uColorBase, uColorHigh, pow(depthMix, 0.72));
      vec3 tint = mix(nativeTint, customTint, uColorMix);
      vec4 layerColor = vec4(tint * curtain, curtain);

      averagedColor = mix(averagedColor, layerColor, 0.5);
      float layerWeight = exp2(-layer * 0.065 - 2.5) * smoothstep(0.0, 5.0, layer);
      accumulatedColor += averagedColor * layerWeight * layerStep;
    }

    float horizonVisibility = clamp(rayDirection.y * 15.0 + 0.4, 0.0, 1.0);
    float lowerGlow = exp(-max(rayDirection.y, 0.0) * 19.0) * uLowerGlow;
    accumulatedColor *= horizonVisibility * (1.0 + lowerGlow);
    return accumulatedColor * uAuroraIntensity;
  }

  vec2 coverUv(vec2 uv) {
    vec2 centered = uv - 0.5;
    if (uViewportAspect > uImageAspect) {
      centered.y *= uImageAspect / uViewportAspect;
    } else {
      centered.x *= uViewportAspect / uImageAspect;
    }
    return centered + 0.5;
  }

  void main() {
    vec2 fragCoord = gl_FragCoord.xy;
    vec2 artUv = coverUv(vUv);
    float insideArtwork =
      step(0.0, artUv.x) * step(artUv.x, 1.0) *
      step(0.0, artUv.y) * step(artUv.y, 1.0);

    vec2 rayPlane = vec2(
      (artUv.x - (0.5 + uAuroraOffsetX)) / max(uAuroraScaleX, 0.05),
      (artUv.y - (uHorizonY + uAuroraOffsetY)) / max(uAuroraScaleY, 0.05)
    );
    vec3 rayDirection = normalize(vec3(rayPlane, 1.3));
    rayDirection.xz *= rotate2d(sin(iTime * uSpeed * 0.05) * 0.08);
    vec3 rayOrigin = vec3(0.0, 0.0, -6.7);

    vec4 auroraField = vec4(0.0);
    if (rayDirection.y > 0.0) {
      auroraField = renderNimitzAurora(rayOrigin, rayDirection, fragCoord);
    }
    auroraField = smoothstep(vec4(0.0), vec4(1.5), auroraField);

    vec3 auroraColor = auroraField.rgb;
    float colorLuma = dot(auroraColor, vec3(0.2126, 0.7152, 0.0722));
    auroraColor = mix(vec3(colorLuma), auroraColor, uSaturation);

    float centerDistance = abs(artUv.x - uAuroraCenterX);
    float horizontalMask = 1.0 - smoothstep(
      uAuroraWidth,
      uAuroraWidth + max(uEdgeFade, 0.001),
      centerDistance
    );
    horizontalMask = pow(clamp(horizontalMask, 0.0, 1.0), mix(1.0, 3.0, uCenterBias));

    float horizonMask = smoothstep(
      uHorizonY,
      uHorizonY + max(uHorizonFeather, 0.001),
      artUv.y
    );
    float topEdge = uHorizonY + uAuroraHeight;
    float heightMask = 1.0 - smoothstep(
      topEdge,
      topEdge + max(uEdgeFade, 0.001),
      artUv.y
    );
    float skyMask = mix(1.0, texture2D(uSkyMask, clamp(artUv, 0.0, 1.0)).r, uUseSkyMask);
    float compositionMask = insideArtwork * horizontalMask * horizonMask * heightMask * skyMask;

    float luminance = dot(auroraColor, vec3(0.2126, 0.7152, 0.0722));
    float sourceAlpha = max(auroraField.a, luminance);
    float auroraAlpha = smoothstep(
      uAlphaLow,
      max(uAlphaHigh, uAlphaLow + 0.001),
      sourceAlpha
    );
    float transparentLuminance = smoothstep(0.004, 0.05, luminance);
    auroraAlpha *= transparentLuminance * compositionMask * uAuroraOpacity;

    float cleanNoise = hash21(fragCoord + vec2(iTime * 17.0, -iTime * 11.0));
    auroraColor = clamp(
      auroraColor + (cleanNoise - 0.5) * uDithering * auroraAlpha,
      0.0,
      1.0
    );

    if (uDebugMode > 0.5 && uDebugMode < 1.5) {
      gl_FragColor = vec4(vec3(auroraAlpha), 1.0);
      return;
    }
    if (uDebugMode > 1.5 && uDebugMode < 2.5) {
      gl_FragColor = vec4(vec3(horizonMask * skyMask), 1.0);
      return;
    }
    if (uDebugMode > 2.5 && uDebugMode < 3.5) {
      gl_FragColor = vec4(vec3(horizontalMask), 1.0);
      return;
    }
    if (uDebugMode > 3.5) {
      gl_FragColor = vec4(vec3(sourceAlpha * compositionMask), 1.0);
      return;
    }

    gl_FragColor = vec4(auroraColor, auroraAlpha);
    #include <colorspace_fragment>
  }
`;
