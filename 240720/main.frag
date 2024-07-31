// precision mediump float;

// varying vec4 vColor;

// void main() {
//   gl_FragColor = vColor;
// }


precision mediump float;

varying vec3 vNormal;
varying vec4 vColor;

// ライトベクトルはひとまず定数で定義する
const vec3 light = vec3(1.0, 1.0, 1.0);

void main() {

  // 変換した法線とライトベクトルで内積を取る @@@
  float d = dot(normalize(vNormal), normalize(light));

  // 色
  vec4 shaded = vec4(vColor.rgb * d, vColor.a);

  gl_FragColor = shaded;
}