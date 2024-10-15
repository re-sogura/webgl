precision mediump float;

uniform sampler2D textureUnit;
varying vec3 vNormal;
varying vec2 vTexCoord;

void main() {
  // テクスチャの色
  vec4 samplerColor = texture2D(textureUnit, vTexCoord);
  // 平行光源による拡散光
  vec3 normal = normalize(vNormal);

  // RGB の各チャンネルの単純な平均 @@@
  // ※ここでは内積を使っていますが、そうしなければ実現できない処理というわけではありません
  float gray = dot(vec3(1.0), samplerColor.rgb) / 3.0;

  // テクスチャの色と拡散光の合成
  gl_FragColor = samplerColor * vec4(1.0);

  // すべての係数を合成して出力
  gl_FragColor = vec4(vec3(gray), samplerColor.a);
}

