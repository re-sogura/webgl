
// = 014 ======================================================================
// WebGL に限らず、CG の世界で「鬼門」と呼ばれている非常に難しい問題の１つとして
// ブレンディングがあります。
// 普段、CSS などで opacity を操作して透明度を変更したり、photoshop などのツール
// でアルファ値を扱っていたりすると誤解しやすいのですが、実は透明や半透明を正しく
// 扱うためには、色と色を混ぜ合わせるブレンド処理について深い理解が必要です。
// とはいえ、完全に理解した上で細かい調整をしなければならない場面は通常利用の範
// 囲ではそれほど多くありません。まずは定番の設定内容から覚えていきましょう。
// ============================================================================

import { WebGLUtility } from './lib/webgl.js';
import { Vec3, Mat4 } from './lib/math.js';
import { WebGLGeometry } from './lib/geometry.js';
import { WebGLOrbitCamera } from './lib/camera.js';

window.addEventListener('DOMContentLoaded', async () => {
  const app = new App();
  app.init();
  await app.load();
  app.setupGeometry();
  app.setupLocation();
  app.start();
}, false);

/**
 * アプリケーション管理クラス
 */
class App {
  canvas;            // WebGL で描画を行う canvas 要素
  gl;                // WebGLRenderingContext （WebGL コンテキスト）
  program;           // WebGLProgram （プログラムオブジェクト）
  attributeLocation; // attribute 変数のロケーション
  attributeStride;   // attribute 変数のストライド
  uniformLocation;   // uniform 変数のロケーション
  planeGeometry;     // 板ポリゴンのジオメトリ情報
  planeVBO;          // 板ポリゴンの頂点バッファ
  planeIBO;          // 板ポリゴンのインデックスバッファ
  startTime;         // レンダリング開始時のタイムスタンプ
  camera;            // WebGLOrbitCamera のインスタンス
  isRendering;       // レンダリングを行うかどうかのフラグ
  texture;           // テクスチャのインスタンス
  texture2;           // 2つ目のテクスチャを追加
  fadeAmount;         // フェードの割合を表す変数を追加

  constructor() {
    // this を固定するためのバインド処理
    this.resize = this.resize.bind(this);
    this.render = this.render.bind(this);
    this.fadeAmount = 0.0; // 初期値を 0.0 に設定（完全に最初のテクスチャが表示される状態）
  }

  /**
   * ブレンディングを設定する @@@
   * @param {boolean} flag - 設定する値
   */
  setBlending(flag) {
    const gl = this.gl;
    if (flag === true) {
      gl.enable(gl.BLEND);
    } else {
      gl.disable(gl.BLEND);
    }
  }

  /**
   * 初期化処理を行う
   */
  init() {
    // canvas エレメントの取得と WebGL コンテキストの初期化
    this.canvas = document.getElementById('webgl-canvas');
    this.gl = WebGLUtility.createWebGLContext(this.canvas);

    // カメラ制御用インスタンスを生成する
    const cameraOption = {
      distance: 5.0, // Z 軸上の初期位置までの距離
      min: 1.0,      // カメラが寄れる最小距離
      max: 10.0,     // カメラが離れられる最大距離
      move: 2.0,     // 右ボタンで平行移動する際の速度係数
    };
    this.camera = new WebGLOrbitCamera(this.canvas, cameraOption);

    // 最初に一度リサイズ処理を行っておく
    this.resize();

    // リサイズイベントの設定
    window.addEventListener('resize', this.resize, false);

    // 深度テストは初期状態で有効
    this.gl.enable(this.gl.DEPTH_TEST);
  }

  /**
   * リサイズ処理
   */
  resize() {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  /**
   * 各種リソースのロードを行う
   * @return {Promise}
   */
  load() {
    return new Promise(async (resolve, reject) => {
      const gl = this.gl;
      if (gl == null) {
        reject(new Error('not initialized'));
      } else {
        const VSSource = await WebGLUtility.loadFile('./main.vert');
        const FSSource = await WebGLUtility.loadFile('./main.frag');
        const vertexShader = WebGLUtility.createShaderObject(gl, VSSource, gl.VERTEX_SHADER);
        const fragmentShader = WebGLUtility.createShaderObject(gl, FSSource, gl.FRAGMENT_SHADER);
        this.program = WebGLUtility.createProgramObject(gl, vertexShader, fragmentShader);
  
        const image1 = await WebGLUtility.loadImage('./sample1.jpg'); // 1つ目のテクスチャ画像
        this.texture = WebGLUtility.createTexture(gl, image1);
  
        const image2 = await WebGLUtility.loadImage('./sample2.jpg'); // 2つ目のテクスチャ画像
        this.texture2 = WebGLUtility.createTexture(gl, image2);
  
        resolve();
      }
    });
  }

  /**
   * 頂点属性（頂点ジオメトリ）のセットアップを行う
   */
  setupGeometry() {
    // プレーンジオメトリの情報を取得
    const size = 3.0;
    const color = [1.0, 1.0, 1.0, 1.0];
    this.planeGeometry = WebGLGeometry.plane(size, size, color);

    // VBO と IBO を生成する
    this.planeVBO = [
      WebGLUtility.createVBO(this.gl, this.planeGeometry.position),
      WebGLUtility.createVBO(this.gl, this.planeGeometry.normal),
      WebGLUtility.createVBO(this.gl, this.planeGeometry.color),
      WebGLUtility.createVBO(this.gl, this.planeGeometry.texCoord),
    ];
    this.planeIBO = WebGLUtility.createIBO(this.gl, this.planeGeometry.index);
  }

  /**
   * 頂点属性のロケーションに関するセットアップを行う
   */
  setupLocation() {
    const gl = this.gl;
    // attribute location の取得
    this.attributeLocation = [
      gl.getAttribLocation(this.program, 'position'),
      gl.getAttribLocation(this.program, 'normal'),
      gl.getAttribLocation(this.program, 'color'),
      gl.getAttribLocation(this.program, 'texCoord'),
    ];
    // attribute のストライド
    this.attributeStride = [
      3,
      3,
      4,
      2,
    ];
    // uniform location の取得
    this.uniformLocation = {
      mvpMatrix: gl.getUniformLocation(this.program, 'mvpMatrix'),
      normalMatrix: gl.getUniformLocation(this.program, 'normalMatrix'),
      textureUnit: gl.getUniformLocation(this.program, 'textureUnit'),
      textureUnit2: gl.getUniformLocation(this.program, 'textureUnit2'),
      useTexture: gl.getUniformLocation(this.program, 'useTexture'),
      fadeAmount: gl.getUniformLocation(this.program, 'fadeAmount'), // フェード
    };
  }

  /**
   * レンダリングのためのセットアップを行う
   */
  setupRendering() {
    const gl = this.gl;
    // ビューポートを設定する
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    // クリアする色と深度を設定する
    gl.clearColor(0.3, 0.3, 0.3, 1.0);
    gl.clearDepth(1.0);
    // 色と深度をクリアする
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  }

  /**
   * 描画を開始する
   */
  start() {
    const gl = this.gl;
  
    // 1つ目のテクスチャをバインド
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
  
    // 2つ目のテクスチャをバインド
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.texture2);
  
    this.startTime = Date.now();
    this.isRendering = true;
    this.render();
  }

  /**
   * 描画を停止する
   */
  stop() {
    this.isRendering = false;
  }

  /**
   * レンダリングを行う
   */
  render() {
    const gl = this.gl;
  
    if (this.isRendering === true) {
      requestAnimationFrame(this.render);
    }
  
    const nowTime = (Date.now() - this.startTime) * 0.001;
  
    // フェードの割合を更新
    this.fadeAmount = (Math.sin(nowTime) + 1.0) / 2.0; // 0.0 ～ 1.0 の範囲で値を変動
  
    this.setupRendering();
  
    const v = this.camera.update();
    const fovy = 45;
    const aspect = window.innerWidth / window.innerHeight;
    const near = 0.1;
    const far = 10.0;
    const p = Mat4.perspective(fovy, aspect, near, far);
    const vp = Mat4.multiply(p, v);
  
    WebGLUtility.enableBuffer(gl, this.planeVBO, this.attributeLocation, this.attributeStride, this.planeIBO);
  
    gl.useProgram(this.program);
  
    // uniform 変数の設定
    gl.uniform1i(this.uniformLocation.textureUnit, 0); // 1つ目のテクスチャ
    gl.uniform1i(this.uniformLocation.textureUnit2, 1); // 2つ目のテクスチャ
    gl.uniform1f(this.uniformLocation.fadeAmount, this.fadeAmount); // フェード割合
  
    // 描画処理
    const m = Mat4.translate(Mat4.identity(), Vec3.create(0.0, 0.0, 0.0));
    const mvp = Mat4.multiply(vp, m);
    const normalMatrix = Mat4.transpose(Mat4.inverse(m));
    gl.uniformMatrix4fv(this.uniformLocation.mvpMatrix, false, mvp);
    gl.uniformMatrix4fv(this.uniformLocation.normalMatrix, false, normalMatrix);
    gl.drawElements(gl.TRIANGLES, this.planeGeometry.index.length, gl.UNSIGNED_SHORT, 0);
  }
}
