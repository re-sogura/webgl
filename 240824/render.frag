precision mediump float;

uniform sampler2D textureUnit;
uniform vec2 resolution;
uniform vec2 mousePosition;
uniform float mosaicSize;

varying vec2 vTexCoord;

void main() {
    vec2 pixelCoord = vTexCoord * resolution;
    vec2 correctedMousePosition = vec2(mousePosition.x, 1.0 - mousePosition.y) * resolution;
    float distance = length(correctedMousePosition - pixelCoord);

    if (distance < 100.0) {
        vec2 mosaicCoord = floor(pixelCoord / mosaicSize) * mosaicSize;
        vec2 uv = mosaicCoord / resolution;
        gl_FragColor = texture2D(textureUnit, uv);
    } else {
        gl_FragColor = texture2D(textureUnit, vTexCoord);
    }
}
