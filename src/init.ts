import * as THREE from "three";
import {
  DepthOfFieldEffect,
  DepthEffect,
  VignetteEffect,
  TextureEffect,
  BlendFunction,
  EdgeDetectionMode,
  KernelSize,
  SMAAImageLoader,
  SMAAPreset,
  SMAAEffect,
  GodRaysEffect,
  BloomEffect,
  EffectComposer,
  EffectPass,
  RenderPass,
  SelectiveBloomEffect,
} from "postprocessing";

const params = {
  color: 0xffffff,
  transmission: 1,
  opacity: 1,
  metalness: 0,
  roughness: 0,
  ior: 1.4,
  thickness: 1.5,
  attenuationColor: 0xffffff,
  attenuationDistance: 1,
  specularIntensity: 1,
  specularColor: 0xffffff,
  envMapIntensity: 1,
  lightIntensity: 1,
  exposure: 1,
};

const arrayPresetShaders = [
  "uniform float time;\nvarying vec2 vUv;\nvarying vec3 vNormal;\n\nvoid main(){\n\n  gl_FragColor = vec4(0.5 + 0.5 * cos(time + vUv.xyx + vec3(0.,2.,4.)), 1.);\n\n}",
  `uniform float time;
varying vec2 vUv;
varying vec3 vNormal;

void main()	{

  vec3 color = 0.5 + 0.5 * cos(time + vec3(vUv, 0.0) + vec3(0.0, 2.0, 4.0)); 
  if(mod(vUv.x + sin(time / 10.), 0.05) < 0.01 + abs(sin(time)/40.))
  gl_FragColor = vec4(color, 1.); 

}`,

  `uniform float time;
varying vec2 vUv;
varying vec3 vNormal;

    

const mat2 m = mat2( 0.80,  0.60, -0.60,  0.80 );

float noise( in vec2 p )
{
	return sin(p.x)*sin(p.y);
}

float fbm4( vec2 p )
{
  float f = 0.0;
  f += 0.5000*noise( p ); p = m*p*2.02;
  f += 0.2500*noise( p ); p = m*p*2.02;
  f += 0.1250*noise( p ); p = m*p*2.02;
  f += 0.0625*noise( p );
  return f/0.9375;
}

float fbm6( vec2 p )
{
  float f = 0.0;
  f += 0.500000*(0.5+0.5*noise( p )); p = m*p*2.02;
  f += 0.500000*(0.5+0.5*noise( p )); p = m*p*2.02;
  f += 0.500000*(0.5+0.5*noise( p )); p = m*p*2.02;
  f += 0.250000*(0.5+0.5*noise( p )); p = m*p*2.02;
  return f/0.96875;
}

vec2 fbm4_2( vec2 p )
{
    return vec2(fbm4(p), fbm4(p+vec2(7.8)));
}

vec2 fbm6_2( vec2 p )
{
    return vec2(fbm6(p+vec2(16.8)), fbm6(p+vec2(11.5)));
}

float func( vec2 q, out vec4 ron )
{
  q += 0.03*sin( vec2(0.27,0.23)* time *4. + length(q)*vec2(4.1,4.3));
	vec2 o = fbm4_2( 0.9*q );
  o += 0.04*sin( vec2(0.12,0.14)*time * 4. + length(o));
  vec2 n = fbm6_2( 3.0*o );
	ron = vec4( o, n );
  float f = 0.5 + 0.5*fbm4( 1.8*q + 6.0*n );
  return mix( f, f*f*f*3.5, f*abs(n.x) );
}

void main()
{
  vec2 p = 10. * vUv; // (2.0*fragCoord-iResolution.xy)/iResolution.y;
  vec4 on = vec4(0.0);
  float f = func(p, on);
  vec3 col = f * (0.5 + 0.5*cos(time+vUv.xyx+vec3(0.,2.,4.)));
  gl_FragColor = vec4(col, 1.);
}
`,
  `
uniform float time;
varying vec2 vUv;
varying vec3 vNormal;
// https://www.shadertoy.com/view/Dt3BW4

vec3 ezPalette(float t, vec3 z) {
  vec3 a = vec3(0.5, 0.5, 0.5);
  vec3 b = vec3(0.5, 0.5, 0.5);
  vec3 c = vec3(1., 1., 1.);
  vec3 d = vec3(0.263, 0.416, 0.557);
  return z * (a + b * cos(6.28318 * (c * t + d)));
}

float distanceField(vec3 position) {
  vec3 newPosition = position * 2. + time;
  return length(position) * log(length(position) + 1.) +
    sin(newPosition.x + sin(newPosition.z + sin(newPosition.y))) * 0.5 - 1.;
}

void main() {
  vec2 uv = vUv * vec2(14., 7.); 
  float dist = length(uv);
  vec3 accColor = vec3(0.);
  float offset = 2.5;

  for (int i = 0; i < 5; i++) {
    vec3 uv0 = vec3(0., 0., 5.) + normalize(vec3(fract(uv * 1.5) - 0.5, -1.)) * offset;
    float dist0 = distanceField(uv0);
    accColor = (accColor + smoothstep(2., 0., dist0) * 0.7) * 
      (vec3(0.1, 0.3, 0.4) + vec3(5.0, 2.5, 3.) 
      * clamp((dist0 - distanceField(uv0 + 0.1)) * 0.5, -0.1, 1.));

    offset += min(dist0, 1.); 
  }

  gl_FragColor = vec4(2.*ezPalette(dist, accColor), 1.);
}`,
  `
// Shader from https://www.shadertoy.com/user/BigWIngs
uniform float time;
varying vec2 vUv;
varying vec3 vNormal;

// "Smiley Tutorial" by Martijn Steinrucken aka BigWings - 2017
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// Email:countfrolic@gmail.com Twitter:@The_ArtOfCode
//
// This Smiley is part of my ShaderToy Tutorial series on YouTube:
// Part 1 - Creating the Smiley - https://www.youtube.com/watch?v=ZlNnrpM0TRg
// Part 2 - Animating the Smiley - https://www.youtube.com/watch?v=vlD_KOrzGDc&t=83s

#define S(a, b, t) smoothstep(a, b, t)
#define B(a, b, blur, t) S(a-blur, a+blur, t)*S(b+blur, b-blur, t)
#define sat(x) clamp(x, 0., 1.)

float remap01(float a, float b, float t) {
return sat((t-a)/(b-a));
}

float remap(float a, float b, float c, float d, float t) {
return sat((t-a)/(b-a)) * (d-c) + c;
}

vec2 within(vec2 uv, vec4 rect) {
return (uv-rect.xy)/(rect.zw-rect.xy);
}

vec4 Brow(vec2 uv, float smile) {
  float offs = mix(.2, 0., smile);
  uv.y += offs;
  
  float y = uv.y;
  uv.y += uv.x*mix(.5, .8, smile)-mix(.1, .3, smile);
  uv.x -= mix(.0, .1, smile);
  uv -= .5;
  
  vec4 col = vec4(0.);
  
  float blur = .1;
  
  float d1 = length(uv);
  float s1 = S(.45, .45-blur, d1);
  float d2 = length(uv-vec2(.1, -.2)*.7);
  float s2 = S(.5, .5-blur, d2);
  
  float browMask = sat(s1-s2);
  
  float colMask = remap01(.7, .8, y)*.75;
  colMask *= S(.6, .9, browMask);
  colMask *= smile;
  vec4 browCol = mix(vec4(.4, .2, .2, 1.), vec4(1., .75, .5, 1.), colMask); 
  
  uv.y += .15-offs*.5;
  blur += mix(.0, .1, smile);
  d1 = length(uv);
  s1 = S(.45, .45-blur, d1);
  d2 = length(uv-vec2(.1, -.2)*.7);
  s2 = S(.5, .5-blur, d2);
  float shadowMask = sat(s1-s2);
  
  col = mix(col, vec4(0.,0.,0.,1.), S(.0, 1., shadowMask)*.5);
  
  col = mix(col, browCol, S(.2, .4, browMask));
  
  return col;
}

vec4 Eye(vec2 uv, float side, vec2 m, float smile) {
  uv -= .5;
  uv.x *= side;
  
float d = length(uv);
  vec4 irisCol = vec4(.3, .5, 1., 1.);
  vec4 col = mix(vec4(1.), irisCol, S(.1, .7, d)*.5);		// gradient in eye-white
  col.a = S(.5, .48, d);									// eye mask
  
  col.rgb *= 1. - S(.45, .5, d)*.5*sat(-uv.y-uv.x*side); 	// eye shadow
  
  d = length(uv-m*.4);									// offset iris pos to look at mouse cursor
  col.rgb = mix(col.rgb, vec3(0.), S(.3, .28, d)); 		// iris outline
  
  irisCol.rgb *= 1. + S(.3, .05, d);						// iris lighter in center
  float irisMask = S(.28, .25, d);
  col.rgb = mix(col.rgb, irisCol.rgb, irisMask);			// blend in iris
  
  d = length(uv-m*.45);									// offset pupile to look at mouse cursor
  
  float pupilSize = mix(.4, .16, smile);
  float pupilMask = S(pupilSize, pupilSize*.85, d);
  pupilMask *= irisMask;
  col.rgb = mix(col.rgb, vec3(0.), pupilMask);		// blend in pupil
  
  float t = time*3.;
  vec2 offs = vec2(sin(t+uv.y*25.), sin(t+uv.x*25.));
  offs *= .01*(1.-smile);
  
  uv += offs;
  float highlight = S(.1, .09, length(uv-vec2(-.15, .15)));
  highlight += S(.07, .05, length(uv+vec2(-.08, .08)));
  col.rgb = mix(col.rgb, vec3(1.), highlight);			// blend in highlight
  
  return col;
}

vec4 Mouth(vec2 uv, float smile) {
  uv -= .5;
vec4 col = vec4(.5, .18, .05, 1.);
  
  uv.y *= 1.5;
  uv.y -= uv.x*uv.x*2.*smile;
  
  uv.x *= mix(2.5, 1., smile);
  
  float d = length(uv);
  col.a = S(.5, .48, d);
  
  vec2 tUv = uv;
  tUv.y += (abs(uv.x)*.5+.1)*(1.-smile);
  float td = length(tUv-vec2(0., .6));
  
  vec3 toothCol = vec3(1.)*S(.6, .35, d);
  col.rgb = mix(col.rgb, toothCol, S(.4, .37, td));
  
  td = length(uv+vec2(0., .5));
  col.rgb = mix(col.rgb, vec3(1., .5, .5), S(.5, .2, td));
  return col;
}

vec4 Head(vec2 uv) {
vec4 col = vec4(.9, .65, .1, 1.);
  
  float d = length(uv);
  
  col.a = S(.5, .49, d);
  
  float edgeShade = remap01(.35, .5, d);
  edgeShade *= edgeShade;
  col.rgb *= 1.-edgeShade*.5;
  
  col.rgb = mix(col.rgb, vec3(.6, .3, .1), S(.47, .48, d));
  
  float highlight = S(.41, .405, d);
  highlight *= remap(.41, -.1, .75, 0., uv.y);
  highlight *= S(.18, .19, length(uv-vec2(.21, .08)));
  col.rgb = mix(col.rgb, vec3(1.), highlight);
  
  d = length(uv-vec2(.25, -.2));
  float cheek = S(.2,.01, d)*.4;
  cheek *= S(.17, .16, d);
  col.rgb = mix(col.rgb, vec3(1., .1, .1), cheek);
  
  return col;
}

vec4 Smiley(vec2 uv, vec2 m, float smile) {
vec4 col = vec4(0.);
  
  if(length(uv)<.5) {					// only bother about pixels that are actually inside the head
      float side = sign(uv.x);
      uv.x = abs(uv.x);
      vec4 head = Head(uv);
      col = mix(col, head, head.a);

      if(length(uv-vec2(.2, .075))<.175) {
          vec4 eye = Eye(within(uv, vec4(.03, -.1, .37, .25)), side, m, smile);
          col = mix(col, eye, eye.a);
      }

      if(length(uv-vec2(.0, -.15))<.3) {
          vec4 mouth = Mouth(within(uv, vec4(-.3, -.43, .3, -.13)), smile);
          col = mix(col, mouth, mouth.a);
      }

      if(length(uv-vec2(.185, .325))<.18) {
          vec4 brow = Brow(within(uv, vec4(.03, .2, .4, .45)), smile);
          col = mix(col, brow, brow.a);
      }
  }
  
  return col;
}

void main()
{
float t = time;
  
  vec2 uv = vUv * 1.6;
  uv -= 0.44;
  uv.x *= 2.2;
  uv.y -= 0.5;
  
  vec2 m = vec2(0.4, 0.3);
  m -= .5;
  
  if(m.x<-.49 && m.y<-.49) {			// make it that he looks around when the mouse hasn't been used
    float s = sin(t*.5);
      float c = cos(t*.38);
      
      m = vec2(s, c)*.4;
  }
  
  if(length(m) > .707) m *= 0.;		// fix bug when coming back from fullscreen
  
  float d = dot(uv, uv);
  uv -= m*sat(.23-d);
  
  float smile = sin(t*.5)*.5+.5;
gl_FragColor = Smiley(uv, m, smile);
}`,
];

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const geometry = new THREE.SphereGeometry(2.6, 64, 64);
const material = new THREE.MeshBasicMaterial({
  color: 0x00ff00,
  transparent: true,
  opacity: 0.5,
});
const sphere = new THREE.Mesh(geometry, material);
//sphere.position.set(0.27, -0.43, 0);
sphere.position.set(0.27, -0.37, 0);
scene.add(sphere);

camera.position.z = 5;

let video = document.getElementById("video");
video.play();
const texture = new THREE.VideoTexture(video); // 1586 × 892
texture.encoding = THREE.sRGBEncoding;
let planeGeo = new THREE.PlaneGeometry(15.86, 8.92);
let planeVidMat = new THREE.MeshBasicMaterial({ map: texture });
let planeVideo = new THREE.Mesh(planeGeo, planeVidMat);
scene.add(planeVideo);
let time = 0;

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(
  new EffectPass(
    camera,
    new BloomEffect({
      intensity: 2.0,
      radius: 0.8,
      luminanceThreshold: 0.1,
      luminanceSmoothing: 0.89,
      // blendFunction: BlendFunction.ADD,
      mipmapBlur: true,
    }),
  ),
);

setShaders();
setShaderFromTextInput();
addEventListener("keyup", (event) => {
  console.log("change mat");
  setShaderFromTextInput();
});

let select = document.getElementById("dropdown");
select.addEventListener("change", presetShader);

function presetShader() {
  let optionValue = document.getElementById("dropdown").value;
  let shader = arrayPresetShaders[optionValue - 1];
  console.log("Set preset shader", optionValue, shader);

  // console.log(glslTextarea);
  let glslTextarea = document.getElementById("glslCode");
  glslTextarea.value = shader;

  setShaderFromTextInput();
}

function animate() {
  requestAnimationFrame(animate);

  time += 0.01;
  sphere.rotation.y = (-0.3 * video.currentTime) / video.duration; // -= 0.00012;
  // Max - 0.30 rad

  sphere.material.uniforms.time.value = time;
  composer.render();
  //renderer.render(scene, camera);
}

window.addEventListener("resize", onWindowResize, false);

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
}

function setShaders() {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 1.0 },
      resolution: { value: new THREE.Vector2() },
    },

    vertexShader: document.getElementById("vertexShader").textContent,
    fragmentShader: document.getElementById("fragmentShader").textContent,
  });
  material.transparent = true;

  sphere.material = material;
}

const textarea = document.querySelector("textarea");

textarea.addEventListener("keydown", (e) => {
  if (e.keyCode === 9) {
    e.preventDefault();

    textarea.setRangeText(
      "  ",
      textarea.selectionStart,
      textarea.selectionStart,
      "end",
    );
  }
});

function setShaderFromTextInput() {
  let glslTextarea = document.getElementById("glslCode");
  // console.log(glslTextarea);
  let glslCode = glslTextarea.value;

  let poslastBrace = glslCode.lastIndexOf("}");
  glslCode =
    glslCode.substring(0, poslastBrace) +
    "if (vUv.y + vUv.x / 10. < 0.42 ) discard;}";

  const material = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 1.0 },
      resolution: { value: new THREE.Vector2() },
    },

    vertexShader: document.getElementById("vertexShader").textContent,
    fragmentShader: glslCode,
  });
  material.transparent = true;
  sphere.material = material;
}

animate();
