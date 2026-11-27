/**
 * HD-2D Cinematic Post-Processing, Volumetric God-Rays & GPU 3D Particle Pipeline
 * ------------------------------------------------------------------------------
 * Inspired by Octopath Traveler II's signature HD-2D miniature-diorama look,
 * calibrated for the Snow-Porcelain / Royal-Blue / Ice-Cyan / Champagne-Gold palette.
 *
 * Pipeline stages:
 *   1. RenderPass          -> Linear HDR scene capture (with HalfFloatType + safe LDR fallback)
 *   2. UnrealBloomPass     -> Soft snow-porcelain highlight halo with silky knee roll-off
 *   3. TiltShiftGradePass  -> 13-tap circular Bokeh DoF (100% razor-sharp combat band)
 *                             + luminous porcelain vignette + HDR-safe warm/cool grading
 *   4. OutputPass          -> Native Three.js tone mapping & sRGB transfer
 *
 * Scene-space 3D atmospheric layers (attached to `scene`):
 *   - 6 volumetric diagonal Tyndall god-ray shafts (Fresnel edge-softening,
 *     longitudinal decay, internal sub-rays, scrolling dust-mote FBM noise, breathing)
 *   - GPU 3D depth-of-field particle system (`snow` / `iceDust` / `windMotes`)
 *     with automatic perspective sizing, foreground lens-bokeh expansion, and
 *     seamless 3D volume wrapping entirely on the GPU.
 */

import { EffectComposer } from '../vendor/three/EffectComposer.js';
import { RenderPass } from '../vendor/three/RenderPass.js';
import { UnrealBloomPass } from '../vendor/three/UnrealBloomPass.js';
import { ShaderPass } from '../vendor/three/ShaderPass.js';
import { OutputPass } from '../vendor/three/OutputPass.js';

const DEFAULT_PRESET = Object.freeze({
	particleType: 'snow',
	particleColor: 0xf2f8ff,
	particleCount: 420,
	godRayColor: 0xfff3dc,
	godRayOpacity: 0.24,
	godRayOrigin: [-9.5, 13.5, -5.5],
	bloomStrength: 0.34,
	bloomThreshold: 0.86,
	bloomRadius: 0.58,
	focusDepth: 0.56,
	blurAmount: 0.85,
	focusBandHalf: 0.185,
	vignetteStrength: 0.14
});

// 6 layered diagonal volumetric light shafts: broad cathedral veils + crisp sun-lances
const GOD_RAY_SPECS = Object.freeze([
	{ spreadX: -4.8, spreadZ: -1.8, heightJitter: 1.0,  topR: 0.72, botR: 2.55, opacityWeight: 0.72, phase: 0.00, striationFreq: 10.0 },
	{ spreadX: -2.4, spreadZ: -0.5, heightJitter: 0.4,  topR: 0.85, botR: 2.85, opacityWeight: 1.00, phase: 1.15, striationFreq: 12.0 },
	{ spreadX: -0.6, spreadZ:  0.8, heightJitter: 1.2,  topR: 0.44, botR: 1.70, opacityWeight: 0.88, phase: 2.30, striationFreq: 16.0 },
	{ spreadX:  1.1, spreadZ: -1.2, heightJitter: 0.6,  topR: 1.12, botR: 3.35, opacityWeight: 0.74, phase: 3.45, striationFreq: 8.0  },
	{ spreadX:  3.0, spreadZ:  0.3, heightJitter: 0.2,  topR: 0.54, botR: 2.05, opacityWeight: 0.90, phase: 4.55, striationFreq: 14.0 },
	{ spreadX:  5.2, spreadZ: -1.5, heightJitter: 0.9,  topR: 0.50, botR: 1.90, opacityWeight: 0.66, phase: 5.60, striationFreq: 12.0 }
]);

// ============================================================================
// Shaders
// ============================================================================

/**
 * Custom HD-2D Tilt-Shift Circular Bokeh DoF + Snow-Porcelain Color Grading Shader
 * Runs in Linear HDR space BEFORE OutputPass so bright highlights produce authentic
 * luminous circular bokeh discs and tone mapping / sRGB encoding happen cleanly once.
 */
function createTiltShiftGradeShader(THREE, width, height) {
	return {
		name: 'HD2DTiltShiftGradeShader',
		uniforms: {
			tDiffuse: { value: null },
			uResolution: { value: new THREE.Vector2(Math.max(1, width), Math.max(1, height)) },
			uFocusDepth: { value: DEFAULT_PRESET.focusDepth },
			uFocusBandHalf: { value: DEFAULT_PRESET.focusBandHalf },
			uBlurRadiusPx: { value: 4.1 },
			uTiltShiftEnabled: { value: 1.0 },
			uVignetteStrength: { value: DEFAULT_PRESET.vignetteStrength },
			uVignetteColor: { value: new THREE.Color(0.76, 0.84, 0.96) },
			uHighlightTint: { value: new THREE.Color(1.028, 1.012, 0.985) },
			uShadowTint: { value: new THREE.Color(0.968, 0.988, 1.042) },
			uContrast: { value: 1.0 },
			uVibrance: { value: 0.085 }
		},
		vertexShader: /* glsl */ `
			varying vec2 vUv;
			void main() {
				vUv = uv;
				gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
			}
		`,
		fragmentShader: /* glsl */ `
			uniform sampler2D tDiffuse;
			uniform vec2 uResolution;
			uniform float uFocusDepth;
			uniform float uFocusBandHalf;
			uniform float uBlurRadiusPx;
			uniform float uTiltShiftEnabled;
			uniform float uVignetteStrength;
			uniform vec3 uVignetteColor;
			uniform vec3 uHighlightTint;
			uniform vec3 uShadowTint;
			uniform float uContrast;
			uniform float uVibrance;

			varying vec2 vUv;

			float getLuma(vec3 c) {
				return dot(c, vec3(0.2126, 0.7152, 0.0722));
			}

			// Weighted HDR bokeh tap so specular crystals / stained glass / lamps
			// expand into creamy luminous circular bokeh orbs instead of dull gray smudges
			void accumBokehTap(
				vec2 baseUv,
				vec2 offsetUv,
				float baseWeight,
				float coc,
				inout vec3 sumColor,
				inout float sumWeight
			) {
				vec2 sampleUv = clamp(baseUv + offsetUv, vec2(0.001), vec2(0.999));
				vec3 s = texture2D(tDiffuse, sampleUv).rgb;
				float lum = getLuma(s);
				float bokehGain = 1.0 + smoothstep(0.62, 2.35, lum) * 1.10 * coc;
				float w = baseWeight * bokehGain;
				sumColor += s * w;
				sumWeight += w;
			}

			void main() {
				// Top-down screen Y: 0.0 = top sky/spires, 0.56 = combat stage band, 1.0 = bottom foreground
				float screenY = 1.0 - vUv.y;

				// Guaranteed 100% razor-sharp combat zone across full horizontal width
				float topStart = clamp(uFocusDepth - uFocusBandHalf, 0.02, 0.96);
				float topFull  = max(0.0, topStart - 0.34);
				float botStart = clamp(uFocusDepth + uFocusBandHalf, 0.04, 0.98);
				float botFull  = min(1.0, botStart + 0.24);

				// Ensure smoothstep edge0 < edge1 strictly on all WebGL/SwiftShader drivers
				float farCoc  = 1.0 - smoothstep(min(topFull, topStart - 0.001), topStart, screenY);
				float nearCoc = smoothstep(botStart, max(botStart + 0.001, botFull), screenY) * 0.92;
				float coc = max(farCoc, nearCoc) * uTiltShiftEnabled;

				// Slight miniature-lens softness at extreme upper/lower outer corners
				// (strictly 0 inside sharp focus band since coc == 0 there)
				float dx = vUv.x - 0.5;
				coc = clamp(coc * (1.0 + 0.14 * dx * dx), 0.0, 1.0);

				vec4 centerTexel = texture2D(tDiffuse, vUv);
				vec3 col = centerTexel.rgb;

				// 13-tap concentric circular bokeh disk (1 center + 4 inner @ 22.5 deg + 8 outer)
				if (coc > 0.002 && uBlurRadiusPx > 0.05) {
					float invAspect = uResolution.y / max(uResolution.x, 1.0);
					// Resolution & DPR invariant bokeh disc radius normalized to 900p reference height
					float radiusV = (coc * uBlurRadiusPx) / 900.0;
					vec2 scaleUv = vec2(radiusV * invAspect, radiusV);

					vec3 sumColor = col * 1.15;
					float sumWeight = 1.15;

					// Inner ring (4 taps, r = 0.48, rotated 22.5 deg to interleave outer ring)
					accumBokehTap(vUv, vec2( 0.4435,  0.1837) * scaleUv, 0.95, coc, sumColor, sumWeight);
					accumBokehTap(vUv, vec2(-0.1837,  0.4435) * scaleUv, 0.95, coc, sumColor, sumWeight);
					accumBokehTap(vUv, vec2(-0.4435, -0.1837) * scaleUv, 0.95, coc, sumColor, sumWeight);
					accumBokehTap(vUv, vec2( 0.1837, -0.4435) * scaleUv, 0.95, coc, sumColor, sumWeight);

					// Outer ring (8 taps, r = 0.98, circular aperture edge)
					accumBokehTap(vUv, vec2( 0.9800,  0.0000) * scaleUv, 0.78, coc, sumColor, sumWeight);
					accumBokehTap(vUv, vec2( 0.6930,  0.6930) * scaleUv, 0.78, coc, sumColor, sumWeight);
					accumBokehTap(vUv, vec2( 0.0000,  0.9800) * scaleUv, 0.78, coc, sumColor, sumWeight);
					accumBokehTap(vUv, vec2(-0.6930,  0.6930) * scaleUv, 0.78, coc, sumColor, sumWeight);
					accumBokehTap(vUv, vec2(-0.9800,  0.0000) * scaleUv, 0.78, coc, sumColor, sumWeight);
					accumBokehTap(vUv, vec2(-0.6930, -0.6930) * scaleUv, 0.78, coc, sumColor, sumWeight);
					accumBokehTap(vUv, vec2( 0.0000, -0.9800) * scaleUv, 0.78, coc, sumColor, sumWeight);
					accumBokehTap(vUv, vec2( 0.6930, -0.6930) * scaleUv, 0.78, coc, sumColor, sumWeight);

					col = sumColor / max(sumWeight, 1e-4);
				}

				// --- Delicate HDR-safe Snow-Porcelain Color Grading ---
				col = max(col, vec3(0.0));
				float lum = getLuma(col);

				// 1. Subtle warm-highlight / cool-shadow split tone
				float shadowMask = 1.0 - smoothstep(0.02, 0.30, lum);
				float hiMask     = smoothstep(0.42, 1.35, lum);
				col *= mix(vec3(1.0), uShadowTint, shadowMask * 0.75);
				col *= mix(vec3(1.0), uHighlightTint, hiMask * 0.75);

				// 2. Gentle HDR-safe micro-contrast (preserves snow highlights cleanly without clipping)
				float safeLum = max(lum, 1e-4);
				float contrastCurve = mix(0.965, 1.042, smoothstep(0.05, 0.68, safeLum));
				col *= mix(1.0, contrastCurve, uContrast);

				// 3. Delicate crystal vibrance (enhances desaturated midtones without oversaturating)
				float maxC = max(col.r, max(col.g, col.b));
				float minC = min(col.r, min(col.g, col.b));
				float sat  = (maxC - minC) / (maxC + 0.06);
				float vib  = (1.0 - sat) * uVibrance;
				vec3 lumaVec = vec3(getLuma(col));
				col = max(mix(lumaVec, col, 1.0 + vib), vec3(0.0));

				// 4. Luminous ice-porcelain vignette (never turns corners muddy black)
				vec2 vp = (vUv - 0.5) * vec2(1.06, 1.0);
				float distSq = dot(vp, vp);
				float vig = smoothstep(0.22, 0.78, distSq) * uVignetteStrength;
				col *= mix(vec3(1.0), uVignetteColor, vig);

				gl_FragColor = vec4(col, centerTexel.a);
			}
		`
	};
}

/**
 * Volumetric God-Ray Shaft Shader
 * - Fresnel edge softening (|N · V|^p) eliminates hard silhouette edges
 * - Smooth top & bottom longitudinal attenuation prevents floor intersection seams
 * - Procedural dual-octave drifting dust-mote FBM noise & fine sub-ray striations
 * - Gentle breathing pulse & close-camera fadeout
 */
function createGodRayMaterial(THREE, colorHex, opacity, phase, striationFreq) {
	return new THREE.ShaderMaterial({
		uniforms: {
			uColor: { value: new THREE.Color(colorHex) },
			uOpacity: { value: opacity },
			uTime: { value: 0.0 },
			uPhase: { value: phase },
			uStriationFreq: { value: striationFreq }
		},
		vertexShader: /* glsl */ `
			varying vec2 vUv;
			varying vec3 vViewNormal;
			varying vec3 vViewDir;
			varying vec3 vWorldPos;
			varying float vViewDist;

			void main() {
				vUv = uv;
				vec4 worldPos = modelMatrix * vec4(position, 1.0);
				vWorldPos = worldPos.xyz;
				vec4 mvPosition = viewMatrix * worldPos;
				vViewDist = length(mvPosition.xyz);
				vViewDir = normalize(-mvPosition.xyz);
				vViewNormal = normalize(normalMatrix * normal);
				gl_Position = projectionMatrix * mvPosition;
			}
		`,
		fragmentShader: /* glsl */ `
			uniform vec3 uColor;
			uniform float uOpacity;
			uniform float uTime;
			uniform float uPhase;
			uniform float uStriationFreq;

			varying vec2 vUv;
			varying vec3 vViewNormal;
			varying vec3 vViewDir;
			varying vec3 vWorldPos;
			varying float vViewDist;

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

			void main() {
				// 1. Fresnel edge softening: bright volumetric core, invisible feathered edge
				float ndotv = clamp(abs(dot(normalize(vViewNormal), normalize(vViewDir))), 0.0, 1.0);
				float edgeSoft = pow(ndotv, 1.95);

				// 2. Longitudinal decay: soft entry at window/canopy top, gentle mist dissolve near floor
				float topFade    = 1.0 - smoothstep(0.84, 1.0, vUv.y);
				float bottomFade = smoothstep(0.0, 0.28, vUv.y);
				float lengthFalloff = pow(clamp(vUv.y, 0.0, 1.0), 1.08);
				float longitudinal = topFade * bottomFade * (0.32 + 0.68 * lengthFalloff);

				// 3. Internal Tyndall sub-ray striations (subtle window mullion / canopy shafts)
				float angle = vUv.x * 6.2831853;
				float subRayA = 0.5 + 0.5 * sin(angle * (uStriationFreq * 0.5) + uPhase + uTime * 0.14);
				float subRayB = 0.5 + 0.5 * sin(angle * uStriationFreq - uPhase * 0.7 - uTime * 0.09);
				float striations = 0.68 + 0.32 * (subRayA * 0.65 + subRayB * 0.35);

				// 4. Slow drifting atmospheric mist + twinkling suspended dust motes
				vec2 mistUv = vec2(vWorldPos.x * 0.28 + uTime * 0.09, vWorldPos.y * 0.24 - uTime * 0.14);
				vec2 dustUv = vec2(vWorldPos.x * 1.15 - uTime * 0.16, vWorldPos.y * 1.05 - uTime * 0.26);
				float mistNoise = valueNoise(mistUv + uPhase);
				float dustNoise = valueNoise(dustUv + uPhase * 1.7);
				float dustSparkle = pow(dustNoise, 3.2) * 0.52;
				float atmosphere = (0.76 + 0.24 * mistNoise) + dustSparkle;

				// 5. Gentle sunlit cloud breathing + close-camera protection
				float breath = 0.86 + 0.14 * sin(uTime * 0.58 + uPhase);
				float camFade = smoothstep(1.8, 5.6, vViewDist);

				float alpha = edgeSoft * longitudinal * striations * atmosphere * breath * camFade * uOpacity;
				if (alpha < 0.002) discard;

				// Slightly brighter ivory-white core near upper light origin
				vec3 coreCol = mix(uColor, vec3(1.0, 0.99, 0.96), vUv.y * 0.34 + dustSparkle * 0.35);
				gl_FragColor = vec4(coreCol * alpha, alpha);
			}
		`,
		transparent: true,
		depthWrite: false,
		depthTest: true,
		blending: THREE.AdditiveBlending,
		side: THREE.FrontSide
	});
}

/**
 * 3D GPU Depth-of-Field Particle Shader
 * Modes:
 *   0 = snow      (light floating snowflakes, hexagonal crystal core -> soft lens bokeh)
 *   1 = iceDust   (buoyant iridescent ice-crystal starlight motes with 4-point glints)
 *   2 = windMotes (sweeping golden-cyan wind spirit embers on flowing currents)
 *   3 = embers    (rising warm gold-crimson fire sparks with gentle thermal swirl)
 */
function createParticleMaterial(THREE) {
	return new THREE.ShaderMaterial({
		uniforms: {
			uTime: { value: 0.0 },
			uMode: { value: 0.0 },
			uPrimaryColor: { value: new THREE.Color(DEFAULT_PRESET.particleColor) },
			uSecondaryColor: { value: new THREE.Color(0xc8e4ff) },
			uBoxCenter: { value: new THREE.Vector3(0.0, 5.2, 2.5) },
			uBoxSize: { value: new THREE.Vector3(28.0, 15.5, 24.0) },
			uProjScale: { value: 1100.0 },
			uPixelRatio: { value: 1.0 },
			uCameraDist: { value: 15.5 },
			uBaseWorldSize: { value: 0.145 },
			uOpacity: { value: 0.90 },
			uSpeedScale: { value: 1.0 },
			uWindScale: { value: 1.0 }
		},
		vertexShader: /* glsl */ `
			attribute float aScale;
			attribute float aPhase;
			attribute float aSpeed;
			attribute float aTint;

			uniform float uTime;
			uniform float uMode;
			uniform vec3 uBoxCenter;
			uniform vec3 uBoxSize;
			uniform float uProjScale;
			uniform float uPixelRatio;
			uniform float uCameraDist;
			uniform float uBaseWorldSize;
			uniform float uSpeedScale;
			uniform float uWindScale;

			varying float vBlurFactor;
			varying float vAlpha;
			varying float vPhase;
			varying float vTint;
			varying float vMode;
			varying float vNearBokeh;

			void main() {
				// Normalize seed into [0, boxSize] then animate smoothly per atmospheric mode
				vec3 seed = position * uBoxSize;
				vec3 drift = vec3(0.0);

				if (uMode < 0.5) {
					// Mode 0: Snow — graceful downward fall + lazy dual-frequency horizontal flutter
					float t = uTime * aSpeed * uSpeedScale;
					drift.x = t * (0.42 * uWindScale) + sin(t * 0.72 + aPhase) * 1.15 + cos(t * 0.31 + aPhase * 1.7) * 0.45;
					drift.y = -t * (1.05 + max(0.0, uWindScale - 1.0) * 0.16);
					drift.z = cos(t * 0.58 + aPhase * 1.3) * 0.85 + t * (0.14 * uWindScale);
				} else if (uMode < 1.5) {
					// Mode 1: IceDust — buoyant crystalline hover, slow upward lift & orbital shimmer
					float t = uTime * aSpeed * uSpeedScale;
					drift.x = sin(t * 0.48 + aPhase) * 1.45 + t * (0.16 * uWindScale);
					drift.y = t * 0.38 + sin(t * 0.85 + aPhase * 2.1) * 0.55;
					drift.z = cos(t * 0.44 + aPhase * 1.4) * 1.35;
				} else if (uMode < 2.5) {
					// Mode 2: WindMotes — sweeping horizontal wind streams with rolling vortex waves
					float t = uTime * aSpeed * uSpeedScale;
					drift.x = t * (2.85 * uWindScale) + sin(t * 1.15 + aPhase) * 0.90;
					drift.y = sin(t * 1.35 + aPhase * 1.5 + position.x * 6.283) * 1.35 + t * 0.18;
					drift.z = cos(t * 0.95 + aPhase * 1.2) * 1.55 - t * (0.42 * uWindScale);
				} else {
					// Mode 3: Embers — warm thermal updraft sparks swirling upward across firelit halls
					float t = uTime * aSpeed * uSpeedScale;
					drift.x = sin(t * 1.12 + aPhase) * 1.35 + cos(t * 0.54 + aPhase * 1.9) * 0.62 + t * (0.32 * uWindScale);
					drift.y = t * 1.48 + sin(t * 1.75 + aPhase * 2.2) * 0.32;
					drift.z = cos(t * 0.90 + aPhase * 1.4) * 1.12;
				}

				// Seamless 3D volume wrap entirely on GPU
				vec3 wrapped = mod(seed + drift, uBoxSize);
				vec3 localPos = wrapped - 0.5 * uBoxSize;
				vec3 worldPos = localPos + uBoxCenter;

				// Smooth boundary fade so wrapping at volume edges is completely invisible
				vec3 edgeDist = (0.5 * uBoxSize - abs(localPos)) / max(uBoxSize * 0.12, vec3(0.001));
				float boxFade = clamp(min(edgeDist.x, min(edgeDist.y, edgeDist.z)), 0.0, 1.0);
				// Gentle floor dissolve near y = -0.2
				float groundFade = smoothstep(-0.6, 0.8, worldPos.y);

				vec4 mvPosition = modelViewMatrix * vec4(worldPos, 1.0);
				float viewDist = max(-mvPosition.z, 0.2);

				// Camera-relative DoF blur factor: large creamy bokeh near camera lens, crisp at combat stage
				float nearEnd   = max(3.0, uCameraDist * 0.62);
				float nearStart = max(1.4, uCameraDist * 0.16);
				float farStart  = max(nearEnd + 2.0, uCameraDist * 1.24);
				float farEnd    = max(farStart + 4.0, uCameraDist * 2.15);

				float nearFactor = 1.0 - smoothstep(nearStart, nearEnd, viewDist);
				float farFactor  = smoothstep(farStart, farEnd, viewDist);
				float nearClipFade = smoothstep(0.95, 2.35, viewDist);

				vNearBokeh = nearFactor;
				vBlurFactor = clamp(nearFactor * 0.96 + farFactor * 0.48, 0.0, 1.0);

				// Automatic perspective size scaling + foreground bokeh disc enlargement
				float perspectivePx = (uBaseWorldSize * aScale * uProjScale) / viewDist;
				float bokehScale = 1.0 + nearFactor * 1.65 + farFactor * 0.25;
				gl_PointSize = clamp(perspectivePx * bokehScale, 2.0 * uPixelRatio, 58.0 * uPixelRatio);

				// Twinkle / shimmer modulation
				float twinkle = 0.72 + 0.28 * sin(uTime * (1.8 + aSpeed * 1.4) + aPhase * 3.0);
				// Soften alpha on very large foreground lens flakes so they never obstruct gameplay
				float fgTranslucency = mix(1.0, 0.36, nearFactor);

				vAlpha = boxFade * groundFade * nearClipFade * twinkle * fgTranslucency;
				vPhase = aPhase;
				vTint  = aTint;
				vMode  = uMode;

				gl_Position = projectionMatrix * mvPosition;
			}
		`,
		fragmentShader: /* glsl */ `
			uniform float uTime;
			uniform vec3 uPrimaryColor;
			uniform vec3 uSecondaryColor;
			uniform float uOpacity;

			varying float vBlurFactor;
			varying float vAlpha;
			varying float vPhase;
			varying float vTint;
			varying float vMode;
			varying float vNearBokeh;

			void main() {
				vec2 p = gl_PointCoord - vec2(0.5);
				float r = length(p) * 2.0; // 0 at center, 1 at circle edge
				if (r > 1.0) discard;

				// Rotate local coordinates smoothly per particle
				float rot = uTime * 0.7 + vPhase;
				float c = cos(rot);
				float s = sin(rot);
				vec2 rp = vec2(c * p.x - s * p.y, s * p.x + c * p.y) * 2.0;

				float shape = 0.0;
				vec3 col = mix(uPrimaryColor, uSecondaryColor, vTint);

				// Shared creamy out-of-focus optical bokeh disc with subtle aperture rim
				float bokehDisc = (1.0 - smoothstep(0.42, 1.0, r)) * (0.78 + 0.28 * smoothstep(0.45, 0.85, r));

				if (vMode < 0.5) {
					// Mode 0: Snow — delicate hexagonal crystal flake in focus -> soft bokeh orb near lens
					float ang = atan(rp.y, rp.x);
					float hexMod = 0.86 + 0.14 * cos(ang * 6.0);
					float sharpFlake = 1.0 - smoothstep(0.18, 0.78 * hexMod, r);
					float coreGleam  = exp(-r * r * 7.5) * 0.55;
					shape = mix(clamp(sharpFlake + coreGleam, 0.0, 1.0), bokehDisc, vBlurFactor);
					// Subtle HDR porcelain highlight at center when in focus
					col += vec3(0.16, 0.18, 0.22) * coreGleam * (1.0 - vBlurFactor);
				} else if (vMode < 1.5) {
					// Mode 1: IceDust — crisp 4-point diamond star glint + prism twinkle
					float starH = exp(-abs(rp.y) * 9.5) * exp(-abs(rp.x) * 2.4);
					float starV = exp(-abs(rp.x) * 9.5) * exp(-abs(rp.y) * 2.4);
					float core  = exp(-r * r * 9.0);
					float diamond = clamp(core * 1.15 + (starH + starV) * 0.65, 0.0, 1.0) * (1.0 - smoothstep(0.75, 1.0, r));
					float sparkle = 0.75 + 0.65 * pow(0.5 + 0.5 * sin(uTime * 3.4 + vPhase * 2.3), 3.0);
					shape = mix(diamond, bokehDisc * 0.92, vBlurFactor * 0.88);
					col *= sparkle;
					col += vec3(0.35, 0.45, 0.55) * core * (1.0 - vBlurFactor * 0.6);
				} else if (vMode < 2.5) {
					// Mode 2: WindMotes — glowing golden-cyan wind spirit ember / airy streak
					float streak = exp(-rp.y * rp.y * 8.5 - rp.x * rp.x * 2.6);
					float halo   = exp(-r * r * 3.4) * 0.65;
					float wisp   = clamp(streak + halo, 0.0, 1.0) * (1.0 - smoothstep(0.82, 1.0, r));
					float pulse  = 0.85 + 0.35 * sin(uTime * 2.6 + vPhase * 1.9);
					shape = mix(wisp, bokehDisc, vBlurFactor * 0.85);
					col *= (1.12 * pulse);
				} else {
					// Mode 3: Embers — incandescent gold-amber spark core with warm bokeh orb
					float sparkTail = exp(-rp.x * rp.x * 9.5 - rp.y * rp.y * 2.8);
					float hotCore   = exp(-r * r * 7.8);
					float spark     = clamp(hotCore * 1.12 + sparkTail * 0.55, 0.0, 1.0) * (1.0 - smoothstep(0.78, 1.0, r));
					float flicker   = 0.76 + 0.44 * sin(uTime * 4.4 + vPhase * 3.1);
					shape = mix(spark, bokehDisc * 0.94, vBlurFactor * 0.88);
					col *= (1.10 * flicker);
					col += vec3(0.45, 0.32, 0.14) * hotCore * (1.0 - vBlurFactor * 0.65);
				}

				float finalAlpha = shape * vAlpha * uOpacity;
				if (finalAlpha < 0.004) discard;

				gl_FragColor = vec4(col, finalAlpha);
			}
		`,
		transparent: true,
		depthWrite: false,
		depthTest: true,
		blending: THREE.NormalBlending
	});
}

// ============================================================================
// Helpers
// ============================================================================

function clamp(v, lo, hi) {
	return Math.max(lo, Math.min(hi, v));
}

function normalizeParticleType(rawType) {
	if (!rawType) return 'snow';
	const key = String(rawType).trim().toLowerCase().replace(/[\s_-]+/g, '');
	if (key === 'none' || key === 'off' || key === 'disabled') return 'none';
	if (key === 'icedust' || key === 'ice' || key === 'frost' || key === 'crystal' || key === 'stardust') {
		return 'iceDust';
	}
	if (key === 'windmotes' || key === 'wind' || key === 'motes' || key === 'storm' || key === 'breeze') {
		return 'windMotes';
	}
	if (key === 'embers' || key === 'ember' || key === 'sparks' || key === 'fire' || key === 'flame') {
		return 'embers';
	}
	return 'snow';
}

function toVector3(THREE, input, fallback) {
	if (!input) return fallback.clone();
	if (input.isVector3) return input.clone();
	if (Array.isArray(input) && input.length >= 3) {
		return new THREE.Vector3(Number(input[0]) || 0, Number(input[1]) || 0, Number(input[2]) || 0);
	}
	if (typeof input === 'object' && ('x' in input || 'y' in input || 'z' in input)) {
		return new THREE.Vector3(Number(input.x) || 0, Number(input.y) || 0, Number(input.z) || 0);
	}
	return fallback.clone();
}

/**
 * Calibrate `blurAmount` across common caller conventions:
 *   - 0             -> 0 px (sharp)
 *   - (0, 0.025]    -> legacy UV-space blur fraction (e.g. 0.006 -> ~3.3 px @ 900p)
 *   - (0.025, 2.2]  -> normalized HD-2D blur multiplier (1.0 -> ~4.8 px @ 900p)
 *   - > 2.2         -> direct pixel radius at 900p, safely clamped <= 9.5 px
 */
function resolveBlurRadiusPx(blurAmount) {
	const val = Number(blurAmount);
	if (!Number.isFinite(val) || val <= 0) return 0;
	if (val <= 0.025) {
		return clamp(val * 550.0, 0.5, 9.0);
	}
	if (val <= 2.2) {
		return clamp(val * 4.8, 0.5, 9.5);
	}
	return clamp(val, 2.2, 9.5);
}

const SOFTWARE_RENDERER_RE = /SwiftShader|llvmpipe|Software|Basic Render|Mesa OffScreen/i;

/**
 * Detect software WebGL renderers (SwiftShader, llvmpipe, Microsoft Basic Render, etc.)
 * or explicit `?perf=low` query override so post-processing can automatically switch to
 * lightweight direct rendering without stalling CPU-bound headless environments.
 */
function detectSoftwareRenderer(renderer) {
	try {
		if (typeof window !== 'undefined' && window.location && window.location.search) {
			const params = new URLSearchParams(window.location.search);
			if ((params.get('perf') || '').toLowerCase() === 'low') {
				return true;
			}
		}
	} catch (_) {
		// Ignore URL parsing errors in non-browser contexts
	}

	try {
		const gl = renderer && typeof renderer.getContext === 'function' ? renderer.getContext() : null;
		if (!gl) return false;
		let rendererName = '';
		const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
		if (debugInfo && debugInfo.UNMASKED_RENDERER_WEBGL) {
			const unmasked = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
			if (unmasked) rendererName = String(unmasked);
		}
		if (!rendererName) {
			const fallback = gl.getParameter(gl.RENDERER);
			if (fallback) rendererName = String(fallback);
		}
		return SOFTWARE_RENDERER_RE.test(rendererName);
	} catch (_) {
		return false;
	}
}

/**
 * Probe WebGL half-float color-buffer render target support safely.
 */
function supportsHalfFloatRenderTarget(renderer) {
	try {
		const gl = renderer && renderer.getContext ? renderer.getContext() : null;
		if (!gl) return false;
		const isWebGL2 = Boolean(renderer.capabilities && renderer.capabilities.isWebGL2);
		if (isWebGL2) {
			return Boolean(
				gl.getExtension('EXT_color_buffer_float') ||
				gl.getExtension('EXT_color_buffer_half_float')
			);
		}
		const hasHalfFloatTex = Boolean(gl.getExtension('OES_texture_half_float'));
		const hasColorBuf = Boolean(
			gl.getExtension('EXT_color_buffer_half_float') ||
			gl.getExtension('WEBGL_color_buffer_float')
		);
		return hasHalfFloatTex && hasColorBuf;
	} catch (_) {
		return false;
	}
}

/**
 * Downgrade UnrealBloomPass internal RenderTargets from HalfFloatType to UnsignedByteType
 * when running on a WebGL context lacking half-float color attachments.
 */
function convertBloomTargetsToUnsignedByte(bloomPass, THREE) {
	if (!bloomPass) return;
	const replaceRT = (rt, name) => {
		const w = Math.max(1, rt.width);
		const h = Math.max(1, rt.height);
		rt.dispose();
		const next = new THREE.WebGLRenderTarget(w, h, { type: THREE.UnsignedByteType });
		next.texture.name = name;
		next.texture.generateMipmaps = false;
		return next;
	};

	if (bloomPass.renderTargetBright) {
		bloomPass.renderTargetBright = replaceRT(bloomPass.renderTargetBright, 'UnrealBloomPass.bright.ldr');
	}
	for (let i = 0; i < bloomPass.nMips; i++) {
		if (bloomPass.renderTargetsHorizontal[i]) {
			bloomPass.renderTargetsHorizontal[i] = replaceRT(
				bloomPass.renderTargetsHorizontal[i],
				'UnrealBloomPass.h' + i + '.ldr'
			);
		}
		if (bloomPass.renderTargetsVertical[i]) {
			bloomPass.renderTargetsVertical[i] = replaceRT(
				bloomPass.renderTargetsVertical[i],
				'UnrealBloomPass.v' + i + '.ldr'
			);
			const uniformKey = 'blurTexture' + (i + 1);
			if (bloomPass.compositeMaterial && bloomPass.compositeMaterial.uniforms[uniformKey]) {
				bloomPass.compositeMaterial.uniforms[uniformKey].value = bloomPass.renderTargetsVertical[i].texture;
			}
		}
	}
}

function createParticleGeometry(THREE, capacity) {
	const count = Math.max(1, Math.floor(capacity));
	const positions = new Float32Array(count * 3);
	const scales = new Float32Array(count);
	const phases = new Float32Array(count);
	const speeds = new Float32Array(count);
	const tints = new Float32Array(count);

	// Deterministic LCG PRNG so visual composition is consistent & well-distributed
	let seed = 0x51a7c9e3;
	const rand = () => {
		seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
		return seed / 4294967296;
	};

	for (let i = 0; i < count; i++) {
		positions[i * 3 + 0] = rand();
		positions[i * 3 + 1] = rand();
		positions[i * 3 + 2] = rand();

		// Mix of fine distant flakes/motes and ~14% larger hero flakes for depth richness
		const hero = rand() < 0.14 ? 1.38 : 1.0;
		scales[i] = (0.52 + rand() * 0.92) * hero;
		phases[i] = rand() * Math.PI * 2.0;
		speeds[i] = 0.65 + rand() * 0.85;
		tints[i] = rand();
	}

	const geometry = new THREE.BufferGeometry();
	geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
	geometry.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
	geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
	geometry.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
	geometry.setAttribute('aTint', new THREE.BufferAttribute(tints, 1));
	return geometry;
}

// ============================================================================
// Main Export
// ============================================================================

/**
 * Create the full HD-2D cinematic post-processing, volumetric god-ray, and
 * GPU 3D depth-of-field particle pipeline.
 *
 * @param {object} THREE      Three.js namespace
 * @param {object} renderer   THREE.WebGLRenderer
 * @param {object} scene      THREE.Scene
 * @param {object} camera     THREE.PerspectiveCamera (or THREE.Camera)
 * @param {object} [texLib]   Optional procedural texture library (reserved / non-required)
 * @param {object} [options]  Optional pipeline options ({ qualityMode?: 'ultra' | 'software' })
 */
export function createHD2DPostPipeline(THREE, renderer, scene, camera, texLib, options) {
	void texLib; // Pure procedural GLSL shaders ensure crisp self-contained visuals

	const initSize = new THREE.Vector2(1280, 720);
	if (renderer && typeof renderer.getSize === 'function') {
		renderer.getSize(initSize);
	}
	let currentWidth = Math.max(64, Math.round(initSize.x || 1280));
	let currentHeight = Math.max(64, Math.round(initSize.y || 720));
	let currentDpr = clamp(
		(renderer && typeof renderer.getPixelRatio === 'function' ? renderer.getPixelRatio() : 1) || 1,
		0.5,
		3.0
	);

	const requestedQuality = options && typeof options === 'object' ? options.qualityMode : null;
	let qualityMode =
		requestedQuality === 'software' || requestedQuality === 'ultra'
			? requestedQuality
			: detectSoftwareRenderer(renderer)
				? 'software'
				: 'ultra';

	let disposed = false;
	let tiltShiftEnabled = true;
	let renderMode = qualityMode === 'software' ? 'direct' : 'hdr'; // 'hdr' | 'ldr' | 'direct'
	let elapsedAccum = 0;
	let loggedDirectError = false;

	// Current state snapshot (preserved seamlessly across LDR fallback rebuilds)
	const state = {
		particleType: DEFAULT_PRESET.particleType,
		particleColor: new THREE.Color(DEFAULT_PRESET.particleColor),
		particleCount: DEFAULT_PRESET.particleCount,
		particleSpeed: 1.0,
		particleWind: 1.0,
		godRayColor: new THREE.Color(DEFAULT_PRESET.godRayColor),
		godRayOpacity: DEFAULT_PRESET.godRayOpacity,
		godRayOrigin: new THREE.Vector3(...DEFAULT_PRESET.godRayOrigin),
		godRayTarget: new THREE.Vector3(0, -0.35, -0.4),
		bloomStrength: DEFAULT_PRESET.bloomStrength,
		bloomThreshold: DEFAULT_PRESET.bloomThreshold,
		bloomRadius: DEFAULT_PRESET.bloomRadius,
		focusDepth: DEFAULT_PRESET.focusDepth,
		focusBandHalf: DEFAULT_PRESET.focusBandHalf,
		blurRadiusPx: resolveBlurRadiusPx(DEFAULT_PRESET.blurAmount),
		vignetteStrength: DEFAULT_PRESET.vignetteStrength
	};

	// ------------------------------------------------------------------------
	// 1. Composer + Bloom + Tilt-Shift Grade + OutputPass
	// ------------------------------------------------------------------------
	let composer = null;
	let renderPass = null;
	let bloomPass = null;
	let tiltShiftPass = null;
	let outputPass = null;

	function applyBloomTint(godRayCol) {
		if (!bloomPass || !Array.isArray(bloomPass.bloomTintColors)) return;
		// Snow-porcelain core with delicate outer crystalline/preset hue harmony
		const r = godRayCol ? godRayCol.r : 1.0;
		const g = godRayCol ? godRayCol.g : 0.98;
		const b = godRayCol ? godRayCol.b : 1.0;
		const tints = [
			[1.00, 0.995, 1.00],
			[0.985 + (r - 0.985) * 0.08, 0.992 + (g - 0.992) * 0.08, 1.015 + (b - 1.0) * 0.08],
			[0.960 + (r - 0.960) * 0.14, 0.982 + (g - 0.982) * 0.14, 1.035 + (b - 1.0) * 0.14],
			[0.935 + (r - 0.935) * 0.18, 0.972 + (g - 0.972) * 0.18, 1.045 + (b - 1.0) * 0.18],
			[0.920 + (r - 0.920) * 0.22, 0.962 + (g - 0.962) * 0.22, 1.040 + (b - 1.0) * 0.22]
		];
		for (let i = 0; i < bloomPass.bloomTintColors.length && i < tints.length; i++) {
			bloomPass.bloomTintColors[i].set(tints[i][0], tints[i][1], tints[i][2]);
		}
	}

	function syncPostUniforms() {
		if (bloomPass) {
			bloomPass.strength = state.bloomStrength;
			bloomPass.threshold = state.bloomThreshold;
			bloomPass.radius = state.bloomRadius;
			bloomPass.enabled = state.bloomStrength > 0.001;
			if (bloomPass.highPassUniforms && bloomPass.highPassUniforms.smoothWidth) {
				bloomPass.highPassUniforms.smoothWidth.value = 0.14;
			}
			applyBloomTint(state.godRayColor);
		}
		if (tiltShiftPass && tiltShiftPass.uniforms) {
			const u = tiltShiftPass.uniforms;
			u.uResolution.value.set(currentWidth * currentDpr, currentHeight * currentDpr);
			u.uFocusDepth.value = state.focusDepth;
			u.uFocusBandHalf.value = state.focusBandHalf;
			u.uBlurRadiusPx.value = state.blurRadiusPx;
			u.uTiltShiftEnabled.value = tiltShiftEnabled ? 1.0 : 0.0;
			u.uVignetteStrength.value = state.vignetteStrength;
		}
	}

	function disposeComposerOnly() {
		try {
			if (bloomPass && typeof bloomPass.dispose === 'function') bloomPass.dispose();
		} catch (_) { /* ignore */ }
		try {
			if (tiltShiftPass && typeof tiltShiftPass.dispose === 'function') tiltShiftPass.dispose();
		} catch (_) { /* ignore */ }
		try {
			if (outputPass && typeof outputPass.dispose === 'function') outputPass.dispose();
		} catch (_) { /* ignore */ }
		try {
			if (composer && typeof composer.dispose === 'function') composer.dispose();
		} catch (_) { /* ignore */ }
		composer = null;
		renderPass = null;
		bloomPass = null;
		tiltShiftPass = null;
		outputPass = null;
	}

	function buildComposer(useHalfFloat) {
		disposeComposerOnly();

		const effW = Math.max(64, Math.round(currentWidth * currentDpr));
		const effH = Math.max(64, Math.round(currentHeight * currentDpr));
		const targetType = useHalfFloat ? THREE.HalfFloatType : THREE.UnsignedByteType;

		const rt = new THREE.WebGLRenderTarget(effW, effH, {
			type: targetType,
			minFilter: THREE.LinearFilter,
			magFilter: THREE.LinearFilter,
			depthBuffer: true,
			stencilBuffer: false
		});
		rt.texture.name = useHalfFloat ? 'HD2DComposer.hdr' : 'HD2DComposer.ldr';

		composer = new EffectComposer(renderer, rt);

		renderPass = new RenderPass(scene, camera);

		bloomPass = new UnrealBloomPass(
			new THREE.Vector2(effW, effH),
			state.bloomStrength,
			state.bloomRadius,
			state.bloomThreshold
		);
		if (!useHalfFloat) {
			convertBloomTargetsToUnsignedByte(bloomPass, THREE);
		}

		tiltShiftPass = new ShaderPass(createTiltShiftGradeShader(THREE, effW, effH));
		outputPass = new OutputPass();

		composer.addPass(renderPass);
		composer.addPass(bloomPass);
		composer.addPass(tiltShiftPass);
		composer.addPass(outputPass);

		// Explicitly sync logical width/height & pixelRatio to prevent DPR^2 sizing when passing custom RT
		composer.setPixelRatio(currentDpr);
		composer.setSize(currentWidth, currentHeight);

		renderMode = useHalfFloat ? 'hdr' : 'ldr';
		syncPostUniforms();
	}

	function initComposer() {
		try {
			const canHalfFloat = supportsHalfFloatRenderTarget(renderer);
			buildComposer(canHalfFloat);
		} catch (err) {
			console.error('[HD2D PostPipeline] HDR composer init failed, falling back to LDR:', err);
			try {
				buildComposer(false);
			} catch (err2) {
				console.error('[HD2D PostPipeline] LDR composer init failed, falling back to direct render:', err2);
				disposeComposerOnly();
				renderMode = 'direct';
			}
		}
	}

	if (qualityMode === 'software') {
		disposeComposerOnly();
		renderMode = 'direct';
	} else {
		initComposer();
	}

	// ------------------------------------------------------------------------
	// 2. 3D Volumetric Tyndall God-Ray Shafts
	// ------------------------------------------------------------------------
	const godRayGroup = new THREE.Group();
	godRayGroup.name = 'HD2D_VolumetricGodRays';
	const godRayMeshes = [];
	const godRayGeometries = [];
	const godRayMaterials = [];

	const _upVec = new THREE.Vector3(0, 1, 0);
	const _dirVec = new THREE.Vector3();
	const _perpX = new THREE.Vector3();
	const _perpZ = new THREE.Vector3();
	const _startPos = new THREE.Vector3();
	const _endPos = new THREE.Vector3();
	const _rayAxis = new THREE.Vector3();

	for (let i = 0; i < GOD_RAY_SPECS.length; i++) {
		const spec = GOD_RAY_SPECS[i];
		// Open-ended unit-height frustum: +Y = narrow light origin (vUv.y=1), -Y = wide floor mist (vUv.y=0)
		const geom = new THREE.CylinderGeometry(spec.topR, spec.botR, 1.0, 24, 1, true);
		const mat = createGodRayMaterial(
			THREE,
			state.godRayColor,
			state.godRayOpacity * spec.opacityWeight * 0.44,
			spec.phase,
			spec.striationFreq
		);
		const mesh = new THREE.Mesh(geom, mat);
		mesh.name = 'HD2D_GodRayShaft_' + i;
		mesh.renderOrder = 5;
		mesh.frustumCulled = false;
		mesh.userData.spec = spec;

		godRayGeometries.push(geom);
		godRayMaterials.push(mat);
		godRayMeshes.push(mesh);
		godRayGroup.add(mesh);
	}

	function layoutGodRays() {
		const origin = state.godRayOrigin;
		const target = state.godRayTarget;

		_dirVec.subVectors(target, origin);
		const baseDist = Math.max(4.0, _dirVec.length());
		_dirVec.divideScalar(baseDist);

		// Compute horizontal spread basis perpendicular to light direction
		_perpX.crossVectors(_upVec, _dirVec);
		if (_perpX.lengthSq() < 1e-4) {
			_perpX.set(1, 0, 0);
		} else {
			_perpX.normalize();
		}
		_perpZ.crossVectors(_dirVec, _perpX).normalize();

		const distScale = clamp(baseDist / 16.5, 0.72, 1.45);
		const radiusScale = clamp(baseDist / 16.5, 0.80, 1.32);
		const clampedOpacity = clamp(state.godRayOpacity, 0.0, 0.85);
		godRayGroup.visible = clampedOpacity > 0.002;

		for (let i = 0; i < godRayMeshes.length; i++) {
			const mesh = godRayMeshes[i];
			const spec = mesh.userData.spec;
			const mat = godRayMaterials[i];

			_startPos.copy(origin)
				.addScaledVector(_perpX, spec.spreadX * distScale)
				.addScaledVector(_perpZ, spec.spreadZ * distScale);
			_startPos.y += spec.heightJitter * distScale;

			_endPos.copy(target)
				.addScaledVector(_perpX, spec.spreadX * 1.14 * distScale)
				.addScaledVector(_perpZ, spec.spreadZ * 0.90 * distScale);

			_rayAxis.subVectors(_startPos, _endPos);
			const shaftLength = Math.max(4.0, _rayAxis.length()) * 1.08;
			_rayAxis.normalize();

			mesh.position.copy(_startPos).add(_endPos).multiplyScalar(0.5);
			mesh.quaternion.setFromUnitVectors(_upVec, _rayAxis);
			mesh.scale.set(radiusScale, shaftLength, radiusScale);

			mat.uniforms.uColor.value.copy(state.godRayColor);
			mat.uniforms.uOpacity.value = clampedOpacity * spec.opacityWeight * 0.44;
		}
	}

	layoutGodRays();
	if (scene) scene.add(godRayGroup);

	// ------------------------------------------------------------------------
	// 3. 3D GPU Depth-of-Field Particle System
	// ------------------------------------------------------------------------
	let particleCapacity = 1200;
	let particleGeometry = createParticleGeometry(THREE, particleCapacity);
	const particleMaterial = createParticleMaterial(THREE);
	const particlePoints = new THREE.Points(particleGeometry, particleMaterial);
	particlePoints.name = 'HD2D_AtmosphereParticles';
	particlePoints.renderOrder = 6;
	particlePoints.frustumCulled = false;

	function updateParticleProjectionUniforms() {
		const fovDeg = camera && Number.isFinite(camera.fov) ? camera.fov : 42;
		const halfFovRad = THREE.MathUtils.degToRad(clamp(fovDeg, 12, 110) * 0.5);
		const physHeight = currentHeight * currentDpr;
		const projScale = (physHeight * 0.5) / Math.max(0.1, Math.tan(halfFovRad));

		particleMaterial.uniforms.uProjScale.value = projScale;
		particleMaterial.uniforms.uPixelRatio.value = currentDpr;
		if (camera && camera.position) {
			particleMaterial.uniforms.uCameraDist.value = clamp(camera.position.length(), 6.0, 36.0);
		}
	}

	function syncParticleConfig(secondaryColorOverride) {
		const type = state.particleType;
		const count = type === 'none' ? 0 : clamp(Math.round(state.particleCount), 0, 4000);

		if (count > particleCapacity) {
			const nextCap = Math.min(4000, Math.max(count, particleCapacity * 2));
			const nextGeom = createParticleGeometry(THREE, nextCap);
			particlePoints.geometry = nextGeom;
			particleGeometry.dispose();
			particleGeometry = nextGeom;
			particleCapacity = nextCap;
		}

		particleGeometry.setDrawRange(0, count);
		particlePoints.visible = count > 0;

		const u = particleMaterial.uniforms;
		u.uPrimaryColor.value.copy(state.particleColor);
		u.uSpeedScale.value = state.particleSpeed;
		u.uWindScale.value = state.particleWind;

		let desiredBlending = THREE.AdditiveBlending;
		if (type === 'snow') {
			u.uMode.value = 0.0;
			u.uBaseWorldSize.value = 0.145;
			u.uOpacity.value = 0.90;
			u.uSecondaryColor.value.set(secondaryColorOverride !== undefined ? secondaryColorOverride : 0xcce5ff);
			desiredBlending = THREE.NormalBlending;
		} else if (type === 'iceDust') {
			u.uMode.value = 1.0;
			u.uBaseWorldSize.value = 0.17;
			u.uOpacity.value = 0.94;
			u.uSecondaryColor.value.set(secondaryColorOverride !== undefined ? secondaryColorOverride : 0xeef9ff);
			desiredBlending = THREE.AdditiveBlending;
		} else if (type === 'windMotes') {
			u.uMode.value = 2.0;
			u.uBaseWorldSize.value = 0.185;
			u.uOpacity.value = 0.92;
			// Signature gold-cyan dual shimmer for wind spirit motes
			u.uSecondaryColor.value.set(secondaryColorOverride !== undefined ? secondaryColorOverride : 0xffe296);
			desiredBlending = THREE.AdditiveBlending;
		} else if (type === 'embers') {
			u.uMode.value = 3.0;
			u.uBaseWorldSize.value = 0.155;
			u.uOpacity.value = 0.94;
			u.uSecondaryColor.value.set(secondaryColorOverride !== undefined ? secondaryColorOverride : 0xff5a22);
			desiredBlending = THREE.AdditiveBlending;
		}

		if (particleMaterial.blending !== desiredBlending) {
			particleMaterial.blending = desiredBlending;
			particleMaterial.needsUpdate = true;
		}

		updateParticleProjectionUniforms();
	}

	syncParticleConfig();
	if (scene) scene.add(particlePoints);

	// ------------------------------------------------------------------------
	// Public API
	// ------------------------------------------------------------------------

	/**
	 * Dynamically apply an atmospherePreset supplied by a Biome.
	 */
	function applyPreset(preset) {
		if (disposed || !preset || typeof preset !== 'object') return;

		if (preset.particleType !== undefined) {
			state.particleType = normalizeParticleType(preset.particleType);
		}
		if (preset.particleColor !== undefined && preset.particleColor !== null) {
			state.particleColor.set(preset.particleColor);
		}
		if (preset.particleCount !== undefined && Number.isFinite(Number(preset.particleCount))) {
			state.particleCount = Math.max(0, Math.round(Number(preset.particleCount)));
		}
		state.particleSpeed =
			preset.particleSpeed !== undefined && Number.isFinite(Number(preset.particleSpeed))
				? clamp(Number(preset.particleSpeed), 0.2, 4.0)
				: 1.0;
		state.particleWind =
			preset.particleWind !== undefined && Number.isFinite(Number(preset.particleWind))
				? clamp(Number(preset.particleWind), 0.2, 5.0)
				: 1.0;

		if (preset.godRayColor !== undefined && preset.godRayColor !== null) {
			state.godRayColor.set(preset.godRayColor);
		}
		if (preset.godRayOpacity !== undefined && Number.isFinite(Number(preset.godRayOpacity))) {
			state.godRayOpacity = clamp(Number(preset.godRayOpacity), 0.0, 0.85);
		}
		if (preset.godRayOrigin !== undefined && preset.godRayOrigin !== null) {
			state.godRayOrigin.copy(toVector3(THREE, preset.godRayOrigin, state.godRayOrigin));
		}
		if (preset.godRayTarget !== undefined && preset.godRayTarget !== null) {
			state.godRayTarget.copy(toVector3(THREE, preset.godRayTarget, state.godRayTarget));
		}

		if (preset.bloomStrength !== undefined && Number.isFinite(Number(preset.bloomStrength))) {
			state.bloomStrength = clamp(Number(preset.bloomStrength), 0.0, 1.35);
		}
		if (preset.bloomThreshold !== undefined && Number.isFinite(Number(preset.bloomThreshold))) {
			state.bloomThreshold = clamp(Number(preset.bloomThreshold), 0.35, 1.50);
		}
		if (preset.bloomRadius !== undefined && Number.isFinite(Number(preset.bloomRadius))) {
			state.bloomRadius = clamp(Number(preset.bloomRadius), 0.0, 1.0);
		}

		if (preset.focusDepth !== undefined && Number.isFinite(Number(preset.focusDepth))) {
			state.focusDepth = clamp(Number(preset.focusDepth), 0.15, 0.85);
		}
		if (preset.focusBandHalf !== undefined && Number.isFinite(Number(preset.focusBandHalf))) {
			state.focusBandHalf = clamp(Number(preset.focusBandHalf), 0.06, 0.34);
		}
		if (preset.blurAmount !== undefined && Number.isFinite(Number(preset.blurAmount))) {
			state.blurRadiusPx = resolveBlurRadiusPx(preset.blurAmount);
		}
		if (preset.vignetteStrength !== undefined && Number.isFinite(Number(preset.vignetteStrength))) {
			state.vignetteStrength = clamp(Number(preset.vignetteStrength), 0.0, 0.35);
		}
		if (preset.tiltShiftEnabled !== undefined) {
			tiltShiftEnabled = Boolean(preset.tiltShiftEnabled);
		}

		// Optional particle bounding box customization for special wide/tall arenas
		if (preset.particleBoxCenter) {
			particleMaterial.uniforms.uBoxCenter.value.copy(
				toVector3(THREE, preset.particleBoxCenter, particleMaterial.uniforms.uBoxCenter.value)
			);
		}
		if (preset.particleBoxSize) {
			particleMaterial.uniforms.uBoxSize.value.copy(
				toVector3(THREE, preset.particleBoxSize, particleMaterial.uniforms.uBoxSize.value)
			);
		}

		layoutGodRays();
		syncParticleConfig(preset.particleSecondaryColor);
		syncPostUniforms();
	}

	/**
	 * Toggle HD-2D tilt-shift circular Bokeh DoF on/off (default: true).
	 */
	function setTiltShiftEnabled(enabled) {
		tiltShiftEnabled = Boolean(enabled);
		if (tiltShiftPass && tiltShiftPass.uniforms && tiltShiftPass.uniforms.uTiltShiftEnabled) {
			tiltShiftPass.uniforms.uTiltShiftEnabled.value = tiltShiftEnabled ? 1.0 : 0.0;
		}
	}

	/**
	 * Switch post-processing quality mode dynamically:
	 *   - 'ultra':    Full HDR HalfFloat EffectComposer + 5-mip UnrealBloomPass + 13-tap Bokeh Tilt-Shift + OutputPass
	 *   - 'software': Lightweight direct renderer.render(scene, camera) skipping HalfFloat Bloom & 13-tap DoF
	 *                 while preserving all 3D architecture, PBR, shadows, god-rays, 3D particles & pixel sprites.
	 */
	function setQualityMode(mode) {
		if (disposed) return qualityMode;
		const nextMode = mode === 'software' ? 'software' : 'ultra';
		if (nextMode === qualityMode && (nextMode === 'software' ? renderMode === 'direct' : Boolean(composer))) {
			return qualityMode;
		}
		qualityMode = nextMode;
		if (qualityMode === 'software') {
			disposeComposerOnly();
			renderMode = 'direct';
			if (renderer && typeof renderer.setRenderTarget === 'function') {
				try {
					renderer.setRenderTarget(null);
				} catch (err) {
					console.error('[HD2D PostPipeline]', err);
				}
			}
		} else {
			initComposer();
			syncPostUniforms();
		}
		return qualityMode;
	}

	/**
	 * Synchronize composer, bloom, tilt-shift uResolution, and GPU particle projection.
	 */
	function resize(width, height, dpr) {
		if (disposed) return;

		currentWidth = Math.max(64, Math.round(Number(width) || currentWidth));
		currentHeight = Math.max(64, Math.round(Number(height) || currentHeight));
		if (dpr !== undefined && Number.isFinite(Number(dpr)) && Number(dpr) > 0) {
			currentDpr = clamp(Number(dpr), 0.5, 3.0);
		} else if (renderer && typeof renderer.getPixelRatio === 'function') {
			currentDpr = clamp(renderer.getPixelRatio() || 1, 0.5, 3.0);
		}

		if (composer) {
			try {
				composer.setPixelRatio(currentDpr);
				composer.setSize(currentWidth, currentHeight);
			} catch (err) {
				console.error('[HD2D PostPipeline] Composer resize failed:', err);
			}
		}

		if (tiltShiftPass && tiltShiftPass.uniforms && tiltShiftPass.uniforms.uResolution) {
			tiltShiftPass.uniforms.uResolution.value.set(
				currentWidth * currentDpr,
				currentHeight * currentDpr
			);
		}

		updateParticleProjectionUniforms();
	}

	/**
	 * Drive volumetric god-ray breathing/noise and GPU 3D particle motion.
	 */
	function update(elapsedSec, dtSec) {
		if (disposed) return;

		const safeDt = Number.isFinite(Number(dtSec)) ? clamp(Number(dtSec), 0, 0.1) : 1 / 60;
		if (Number.isFinite(Number(elapsedSec))) {
			elapsedAccum = Number(elapsedSec);
		} else {
			elapsedAccum += safeDt;
		}

		if (godRayGroup.visible) {
			for (let i = 0; i < godRayMaterials.length; i++) {
				godRayMaterials[i].uniforms.uTime.value = elapsedAccum;
			}
		}

		if (particlePoints.visible) {
			particleMaterial.uniforms.uTime.value = elapsedAccum;
			if (camera && camera.position) {
				particleMaterial.uniforms.uCameraDist.value = clamp(camera.position.length(), 6.0, 36.0);
			}
		}
	}

	/**
	 * Render through EffectComposer (ultra mode) or lightweight direct renderer.render(scene, camera)
	 * (software mode / fail-safe fallback):
	 *   Tier 1 (ultra):    HalfFloatType HDR EffectComposer
	 *   Tier 2 (ultra):    UnsignedByteType LDR EffectComposer
	 *   Tier 3 (software): Direct renderer.render(scene, camera)
	 */
	function render() {
		if (disposed || !renderer || !scene || !camera) return;

		if (qualityMode !== 'software' && composer && renderMode !== 'direct') {
			try {
				composer.render();
				return;
			} catch (err) {
				console.error('[HD2D PostPipeline] Composer render failed:', err);
				if (renderMode === 'hdr') {
					// Graceful step-down from HDR HalfFloatType -> LDR UnsignedByteType composer
					try {
						buildComposer(false);
						if (composer) {
							composer.render();
							return;
						}
					} catch (err2) {
						console.error('[HD2D PostPipeline] LDR fallback failed, switching to direct render:', err2);
						disposeComposerOnly();
						renderMode = 'direct';
					}
				} else {
					disposeComposerOnly();
					renderMode = 'direct';
				}
			}
		}

		// Lightweight direct WebGL render (software mode or ultimate fail-safe)
		try {
			renderer.setRenderTarget(null);
			renderer.render(scene, camera);
			loggedDirectError = false;
		} catch (err) {
			if (!loggedDirectError) {
				loggedDirectError = true;
				console.error('[HD2D PostPipeline] Direct render failed:', err);
			}
		}
	}

	/**
	 * Thoroughly release all GPU resources (composer, render targets, god-rays, particles).
	 */
	function dispose() {
		if (disposed) return;
		disposed = true;

		disposeComposerOnly();

		if (scene) {
			scene.remove(godRayGroup);
			scene.remove(particlePoints);
		}

		for (let i = 0; i < godRayGeometries.length; i++) {
			try { godRayGeometries[i].dispose(); } catch (_) { /* ignore */ }
		}
		for (let i = 0; i < godRayMaterials.length; i++) {
			try { godRayMaterials[i].dispose(); } catch (_) { /* ignore */ }
		}
		godRayMeshes.length = 0;
		godRayGeometries.length = 0;
		godRayMaterials.length = 0;

		try { particleGeometry.dispose(); } catch (_) { /* ignore */ }
		try { particleMaterial.dispose(); } catch (_) { /* ignore */ }
	}

	return {
		applyPreset,
		setTiltShiftEnabled,
		setQualityMode,
		resize,
		update,
		render,
		dispose,
		// Helpful read-only accessors for inspection/debugging
		isTiltShiftEnabled: () => tiltShiftEnabled,
		getRenderMode: () => renderMode,
		getQualityMode: () => qualityMode,
		godRayGroup,
		particlePoints
	};
}
