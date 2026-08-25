export const auroraVertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

export const auroraFragmentShader = /* glsl */ `
  precision highp float;

  uniform sampler2D uAurora;
  uniform sampler2D uSkyMask;
  uniform float uTime;
  uniform float uViewportAspect;
  uniform float uImageAspect;
  uniform float uSpeed;
  uniform float uHorizontalDistortion;
  uniform float uVerticalDistortion;
  uniform float uWaviness;
  uniform float uVerticalFlow;
  uniform float uVerticalStretch;
  uniform float uNoiseScale;
  uniform float uNoiseStrength;
  uniform float uNoiseEvolutionSpeed;
  uniform float uBrightness;
  uniform float uBrightnessVariation;
  uniform float uGlowIntensity;
  uniform float uOpacity;
  uniform float uBreathingStrength;
  uniform float uTopMotionStrength;
  uniform float uBottomMotionStrength;
  uniform float uReducedMotion;
  uniform float uShowMask;
  uniform float uShowBounds;
  uniform float uDebugView;
  varying vec2 vUv;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);

    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));

    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    mat2 rotation = mat2(0.82, -0.57, 0.57, 0.82);

    for (int i = 0; i < 4; i++) {
      value += amplitude * valueNoise(p);
      p = rotation * p * 2.03 + 13.17;
      amplitude *= 0.5;
    }

    return clamp(value * 1.0666667, 0.0, 1.0);
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

  float auroraInfluence(vec4 sampleColor) {
    float chroma = sampleColor.g - max(sampleColor.r * 0.88, sampleColor.b * 0.72);
    float greenSignal = smoothstep(0.008, 0.17, chroma);
    float alphaSignal = smoothstep(0.006, 0.15, sampleColor.a);
    return greenSignal * alphaSignal;
  }

  float boundsLine(vec2 uv) {
    vec2 lower = vec2(0.0, 0.3110);
    vec2 upper = vec2(1.0, 0.9810);
    float thickness = 0.0025;
    float horizontal = max(
      1.0 - smoothstep(thickness, thickness * 2.0, abs(uv.y - lower.y)),
      1.0 - smoothstep(thickness, thickness * 2.0, abs(uv.y - upper.y))
    );
    float vertical = max(
      1.0 - smoothstep(thickness, thickness * 2.0, abs(uv.x - lower.x)),
      1.0 - smoothstep(thickness, thickness * 2.0, abs(uv.x - upper.x))
    );
    float insideY = step(lower.y, uv.y) * step(uv.y, upper.y);
    float insideX = step(lower.x, uv.x) * step(uv.x, upper.x);
    return max(horizontal * insideX, vertical * insideY);
  }

  void main() {
    vec2 baseUv = coverUv(vUv);
    vec4 base = texture2D(uAurora, baseUv);
    float mask = texture2D(uSkyMask, baseUv).r;
    float influence = auroraInfluence(base);

    float heightWeight = smoothstep(0.30, 0.88, baseUv.y);
    float motionProfile = mix(uBottomMotionStrength, uTopMotionStrength, heightWeight);
    float motionWeight = motionProfile * influence * (1.0 - uReducedMotion);

    float t = uTime * uSpeed * uNoiseEvolutionSpeed;
    float scale = max(uNoiseScale, 0.001);

    // Low-frequency domain warp shared only as a coordinate deformation source.
    vec2 domainCoord = baseUv * vec2(scale * 1.35, scale * 0.86);
    float warpX = fbm(domainCoord + vec2(t * 0.28, -t * 0.17));
    float warpY = fbm(domainCoord + vec2(19.4, -11.8) + vec2(-t * 0.21, t * 0.24));
    vec2 warpedUv = baseUv + (vec2(warpX, warpY) - 0.5) * 0.075;

    // A. Curtain sway: height-led FBM plus a broad noise-phased wave.
    float curtainField = fbm(vec2(
      warpedUv.y * scale * 1.36 + warpX * 0.78,
      warpedUv.x * scale * 0.52 + t * 0.74
    ));
    float curtainSecondary = fbm(vec2(
      warpedUv.y * scale * 0.82 - t * 0.38,
      warpedUv.x * scale * 0.69 + 12.7
    ));
    float curtainSigned = (curtainField - 0.5) * 2.0;
    float broadWave = sin(
      baseUv.y * 6.2 +
      t * 1.55 +
      (warpX - 0.5) * 5.2 +
      (curtainSecondary - 0.5) * 2.6
    );
    float horizontalOffset = curtainSigned * uHorizontalDistortion;
    horizontalOffset += broadWave * uHorizontalDistortion * uWaviness * 0.62;

    // B. Vertical flow: independent domain-warped fields move internal rays.
    vec2 flowCoord = vec2(
      warpedUv.x * scale * 2.85 - t * 1.08,
      warpedUv.y * scale * 1.58 + t * 0.72
    );
    float flowField = fbm(flowCoord + vec2(31.6, -17.2));
    float stretchField = fbm(vec2(
      warpedUv.x * scale * 1.72 + t * 0.43 + 7.9,
      warpedUv.y * scale * 2.46 - t * 0.67
    ));
    float flowSigned = (flowField - 0.5) * 2.0;
    float stretchSigned = (stretchField - 0.5) * 2.0;
    float verticalOffset = flowSigned * uVerticalDistortion * (0.78 + uVerticalFlow * 1.4);
    verticalOffset += stretchSigned * uVerticalDistortion * uVerticalStretch * 1.9;

    float diagnosticMultiplier = uDebugView > 3.5 ? 10.0 : 1.0;
    vec2 displacement = vec2(horizontalOffset, verticalOffset);
    displacement *= motionWeight * uNoiseStrength * diagnosticMultiplier;
    vec2 displacedUv = clamp(baseUv + displacement, vec2(0.001), vec2(0.999));

    vec4 moved = texture2D(uAurora, displacedUv);
    float mixStrength = clamp(influence * (0.58 + motionProfile * 0.42), 0.0, 1.0);
    vec4 aurora = mix(base, moved, mixStrength);

    // C. Light travel: a separate warped luminance field, independent of geometry.
    vec2 lightWarpCoord = baseUv * vec2(1.72, 1.28) + vec2(-t * 0.31, t * 0.22);
    float lightWarpX = fbm(lightWarpCoord + vec2(47.3, 6.2));
    float lightWarpY = fbm(lightWarpCoord + vec2(-23.1, 38.4));
    vec2 lightUv = baseUv + (vec2(lightWarpX, lightWarpY) - 0.5) * 0.048;
    float lightNoise = fbm(vec2(
      lightUv.x * 3.0 - t * 0.82,
      lightUv.y * 2.0 + t * 0.36
    ) + vec2(63.8, -29.4));

    vec2 glowStep = vec2(0.0024, 0.0018);
    vec4 glow = (
      texture2D(uAurora, displacedUv + vec2(glowStep.x, 0.0)) +
      texture2D(uAurora, displacedUv - vec2(glowStep.x, 0.0)) +
      texture2D(uAurora, displacedUv + vec2(0.0, glowStep.y)) +
      texture2D(uAurora, displacedUv - vec2(0.0, glowStep.y))
    ) * 0.25;

    float brightnessFlow = (lightNoise - 0.5) * 2.0 * uBrightnessVariation * influence;
    float breathing = 1.0 + sin(t * 3.0) * uBreathingStrength * (1.0 - uReducedMotion);
    float glowPulse = 1.0 + sin(t * 2.15 + 1.7) * 0.08;
    float glowMix = uGlowIntensity * 0.22 * influence * glowPulse;

    aurora.rgb = mix(aurora.rgb, max(aurora.rgb, glow.rgb), glowMix);
    aurora.rgb *= uBrightness * (1.0 + brightnessFlow) * breathing;
    aurora.a = max(aurora.a, glow.a * glowMix * 0.32);

    aurora.a *= mask * uOpacity;

    if (uShowBounds > 0.5) {
      float line = boundsLine(baseUv);
      aurora.rgb = mix(aurora.rgb, vec3(1.0, 0.42, 0.08), line * 0.92);
      aurora.a = max(aurora.a, line * 0.92);
    }

    vec4 finalColor = aurora;
    if (uShowMask > 0.5) {
      finalColor = vec4(vec3(mask), 1.0);
    } else if (uDebugView > 0.5 && uDebugView < 1.5) {
      finalColor = vec4(vec3(motionProfile * mask), 1.0);
    } else if (uDebugView > 1.5 && uDebugView < 2.5) {
      float geometryNoise = clamp(
        0.5 +
        curtainSigned * 0.92 +
        flowSigned * 0.76 +
        (warpX + warpY - 1.0) * 0.46,
        0.0,
        1.0
      );
      finalColor = vec4(vec3(geometryNoise * mask), 1.0);
    } else if (uDebugView > 2.5 && uDebugView < 3.5) {
      float lightDiagnostic = clamp(0.5 + (lightNoise - 0.5) * 2.8, 0.0, 1.0);
      finalColor = vec4(vec3(lightDiagnostic * mask), 1.0);
    }

    gl_FragColor = finalColor;
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
