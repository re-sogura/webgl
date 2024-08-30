precision mediump float;

uniform sampler2D textureUnit1; // 1つ目のテクスチャ
uniform sampler2D textureUnit2; // 2つ目のテクスチャ
uniform float fadeAmount; // フェード割合 (0.0 はtexture1、1.0 はtexture2、それ以外は両方の間の色)

varying vec4 vColor;
varying vec2 vTexCoord;

void main() {
    // それぞれのテクスチャから色を取得
    vec4 color1 = texture2D(textureUnit1, vTexCoord);
    vec4 color2 = texture2D(textureUnit2, vTexCoord);

    // fadeAmountに基づいて2つのテクスチャを線形補間 (ミックス)
    vec4 mixedColor = mix(color1, color2, fadeAmount);

    // グローバルアルファを適用して最終的な色を出力
    gl_FragColor = vColor * mixedColor * vec4(vec3(1.0), 1.0);
}
