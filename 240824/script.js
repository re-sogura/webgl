
// = 018 ======================================================================
// ポストエフェクトには、たくさんのバリエーションがあります。
// というより、やれることは無限にあるので、まずは基本的なところから少しずつ感覚
// を掴んでいくのがよいでしょう。
// ここでは一度オフスクリーンでシーンをレンダリング（スフィアを使った描画）を行
// い、続いてこれを「画面全体を覆う板ポリゴン」に貼り付けて画面に出しています。
// この板ポリゴンが描画される２度目のレンダリングにおいて、シェーダでポストエフ
// ェクトを掛けている形になっています。（render.frag）
// 具体的なエフェクトの内容としては、ベクトルの内積を活用したグレイスケール化と、
// 画面の四隅が暗くなるような効果（ヴィネット）をポストエフェクトで実装していま
// す。いずれも、ベクトルが絡んできますので数学的思考が要求されますが、落ち着い
// て読み解きましょう。
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
  canvas;               // WebGL で描画を行う canvas 要素
  gl;                   // WebGLRenderingContext （WebGL コンテキスト）
  renderProgram;        // 最終シーン用プログラムオブジェクト
  renderAttLocation;    // 最終シーン用の attribute 変数のロケーション
  renderAttStride;      // 最終シーン用の attribute 変数のストライド
  renderUniLocation;    // 最終シーン用の uniform 変数のロケーション
  offscreenProgram;     // オフスクリーン用のプログラムオブジェクト
  offscreenAttLocation; // オフスクリーン用の attribute 変数のロケーション
  offscreenAttStride;   // オフスクリーン用の attribute 変数のストライド
  offscreenUniLocation; // オフスクリーン用の uniform 変数のロケーション
  planeGeometry;        // 板ポリゴンのジオメトリ情報
  planeVBO;             // 板ポリゴンの頂点バッファ
  planeIBO;             // 板ポリゴンのインデックスバッファ
  sphereGeometry;       // 球体のジオメトリ情報
  sphereVBO;            // 球体の頂点バッファ
  sphereIBO;            // 球体のインデックスバッファ
  startTime;            // レンダリング開始時のタイムスタンプ
  camera;               // WebGLOrbitCamera のインスタンス
  isRendering;          // レンダリングを行うかどうかのフラグ
  isRotation;           // 球体を回転させるかどうかのフラグ
  framebufferObject;    // フレームバッファに関連するオブジェクト
  texture;              // 画像を割り当てるテクスチャ @@@

  constructor() {
    // this を固定するためのバインド処理
    this.resize = this.resize.bind(this);
    this.render = this.render.bind(this);
    this.mouseMove = this.mouseMove.bind(this);
    this.mosaicSize = 14.0; // モザイク初期
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

    // 最初に一度リサイズ処理を行っておく（ここで結果的にフレームバッファが生成される） @@@
    this.resize();

    // リサイズイベントの設定
    window.addEventListener('resize', this.resize, false);

    // バックフェイスカリングと深度テストは初期状態で有効
    this.gl.enable(this.gl.CULL_FACE);
    this.gl.enable(this.gl.DEPTH_TEST);

    // 初期状態では球体が回転するように設定する
    this.isRotation = true;

    // マウスイベント
    this.canvas.addEventListener('mousemove', this.mouseMove, false);
    this.mousePosition = [0, 0]; // 初期値を設定
  }

  /**
   * リサイズ処理
   */
  resize() {
    const gl = this.gl;

    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;

    // フレームバッファもリサイズ処理の対象とする @@@
    if (this.framebufferObject == null) {
      // まだ生成されていない場合は、生成する
      this.framebufferObject = WebGLUtility.createFramebuffer(gl, this.canvas.width, this.canvas.height);
    } else {
      // 生成済みのフレームバッファもキャンバスにサイズを合わせる
      // ※フレームバッファを構成する要素のうち、RenderBuffer と Texture にはサイズの概念がある
      WebGLUtility.resizeFramebuffer(
        this.gl,
        this.canvas.width,
        this.canvas.height,
        this.framebufferObject.depthRenderbuffer,
        this.framebufferObject.texture,
      );
    }
  }

  /**
 * マウス動かした時
 */
  mouseMove(event) {
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
  
    // マウス座標
    this.mousePosition = [
      (mouseX / rect.width),
      (rect.height - mouseY) / rect.height // Y座標を反転
    ];
  }

  /**
   * 各種リソースのロードを行う
   * @return {Promise}
   */
  load() {
    return new Promise(async (resolve, reject) => {
      const gl = this.gl;
      if (gl == null) {
        // もし WebGL コンテキストがない場合はエラーとして Promise を reject する
        const error = new Error('not initialized');
        reject(error);
      } else {
        // 最終シーン用のシェーダ
        const renderVSSource = await WebGLUtility.loadFile('./render.vert')
        const renderFSSource = await WebGLUtility.loadFile('./render.frag')
        const renderVertexShader = WebGLUtility.createShaderObject(gl, renderVSSource, gl.VERTEX_SHADER);
        const renderFragmentShader = WebGLUtility.createShaderObject(gl, renderFSSource, gl.FRAGMENT_SHADER);
        this.renderProgram = WebGLUtility.createProgramObject(gl, renderVertexShader, renderFragmentShader);
        // オフスクリーン用のシェーダ
        const offscreenVSSource = await WebGLUtility.loadFile('./offscreen.vert')
        const offscreenFSSource = await WebGLUtility.loadFile('./offscreen.frag')
        const offscreenVertexShader = WebGLUtility.createShaderObject(gl, offscreenVSSource, gl.VERTEX_SHADER);
        const offscreenFragmentShader = WebGLUtility.createShaderObject(gl, offscreenFSSource, gl.FRAGMENT_SHADER);
        this.offscreenProgram = WebGLUtility.createProgramObject(gl, offscreenVertexShader, offscreenFragmentShader);
        // 画像を読み込み、テクスチャを初期化する
        const image = await WebGLUtility.loadImage('./sample.jpg');
        this.texture = WebGLUtility.createTexture(gl, image);
        // Promsie を解決
        resolve();
      }
    });
  }

  /**
   * 頂点属性（頂点ジオメトリ）のセットアップを行う
   */
  setupGeometry() {
    const color = [1.0, 1.0, 1.0, 1.0];

    // plane は this.renderProgram と一緒に使う @@@
    const size = 2.0;
    this.planeGeometry = WebGLGeometry.plane(size, size, color);
    this.planeVBO = [
      WebGLUtility.createVBO(this.gl, this.planeGeometry.position),
      WebGLUtility.createVBO(this.gl, this.planeGeometry.texCoord),
    ];
    this.planeIBO = WebGLUtility.createIBO(this.gl, this.planeGeometry.index);

    // sphere は this.offscreenProgram と一緒に使う @@@
    const segment = 64;
    const radius = 1.0;
    this.sphereGeometry = WebGLGeometry.sphere(segment, segment, radius, color);
    this.sphereVBO = [
      WebGLUtility.createVBO(this.gl, this.sphereGeometry.position),
      WebGLUtility.createVBO(this.gl, this.sphereGeometry.normal),
      WebGLUtility.createVBO(this.gl, this.sphereGeometry.texCoord),
    ];
    this.sphereIBO = WebGLUtility.createIBO(this.gl, this.sphereGeometry.index);
  }

  /**
   * 頂点属性のロケーションに関するセットアップを行う
   */
  setupLocation() {
    const gl = this.gl;
    // レンダリング用のセットアップ
    this.renderAttLocation = [
      gl.getAttribLocation(this.renderProgram, 'position'),
      gl.getAttribLocation(this.renderProgram, 'texCoord'),
    ];
    this.renderAttStride = [3, 2];
    this.renderUniLocation = {
      textureUnit: gl.getUniformLocation(this.renderProgram, 'textureUnit'), // テクスチャユニット
      // mosaicSizeのuniformを取得
      mosaicSize: gl.getUniformLocation(this.renderProgram, 'mosaicSize'),
      mousePosition: gl.getUniformLocation(this.renderProgram, 'mousePosition'),
      resolution: gl.getUniformLocation(this.renderProgram, 'resolution'),
    };

    // オフスクリーン用のセットアップ
    this.offscreenAttLocation = [
      gl.getAttribLocation(this.offscreenProgram, 'position'),
      gl.getAttribLocation(this.offscreenProgram, 'normal'),
      gl.getAttribLocation(this.offscreenProgram, 'texCoord'),
    ];
    this.offscreenAttStride = [3, 3, 2];
    this.offscreenUniLocation = {
      mvpMatrix: gl.getUniformLocation(this.offscreenProgram, 'mvpMatrix'),       // MVP 行列
      normalMatrix: gl.getUniformLocation(this.offscreenProgram, 'normalMatrix'), // 法線変換用行列
      textureUnit: gl.getUniformLocation(this.offscreenProgram, 'textureUnit'),   // テクスチャユニット
    };
  }

  /**
   * レンダリングのためのセットアップを行う
   */
  setupRendering() {
    const gl = this.gl;
    // フレームバッファのバインドを解除する
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    // ビューポートを設定する
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    // クリアする色と深度を設定する
    gl.clearColor(0.3, 0.3, 0.3, 1.0);
    gl.clearDepth(1.0);
    // 色と深度をクリアする
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // プログラムオブジェクトを選択
    gl.useProgram(this.renderProgram);
    // フレームバッファにアタッチされているテクスチャをバインドする
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.framebufferObject.texture);
  }

  /**
   * オフスクリーンレンダリングのためのセットアップを行う
   */
  setupOffscreenRendering() {
    const gl = this.gl;
    // フレームバッファをバインドして描画の対象とする
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebufferObject.framebuffer);
    // ビューポートを設定する
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    // クリアする色と深度を設定する
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clearDepth(1.0);
    // 色と深度をクリアする
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // プログラムオブジェクトを選択
    gl.useProgram(this.offscreenProgram);
    // スフィアに貼るテクスチャをバインドする @@@
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
  }

  /**
   * 描画を開始する
   */
  start() {
    // レンダリング開始時のタイムスタンプを取得しておく
    this.startTime = Date.now();
    // レンダリングを行っているフラグを立てておく
    this.isRendering = true;
    // レンダリングの開始
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

    // レンダリングのフラグの状態を見て、requestAnimationFrame を呼ぶか決める
    if (this.isRendering === true) {
      requestAnimationFrame(this.render);
    }

    // 現在までの経過時間
    const nowTime = (Date.now() - this.startTime) * 0.001;

    // １フレームの間に２度レンダリングする

    // - オフスクリーンレンダリング -------------------------------------------
    {
      // レンダリングのセットアップ
      this.setupOffscreenRendering();

      // オフスクリーンシーン用のビュー行列を作る
      const v = this.camera.update();
      // オフスクリーンシーン用のプロジェクション行列を作る
      const fovy = 45;
      const aspect = window.innerWidth / window.innerHeight;
      const near = 0.1
      const far = 10.0;
      const p = Mat4.perspective(fovy, aspect, near, far);
      // オフスクリーン用のビュー・プロジェクション行列
      const vp = Mat4.multiply(p, v);
      // オフスクリーン用のモデル行列（ここでは回転＋上下移動、適用順序に注意！）
      const vertical = Math.sin(nowTime) * 0.5;
      let m = Mat4.translate(Mat4.identity(), Vec3.create(0.0, vertical, 0.0));
      if (this.isRotation === true) {
        m = Mat4.rotate(m, nowTime, Vec3.create(1.0, 1.0, 0.0));
      }
      // オフスクリーン用の MVP 行列
      const mvp = Mat4.multiply(vp, m);
      // オフスクリーン用の法線変換行列
      const normalMatrix = Mat4.transpose(Mat4.inverse(m));

      // VBO と IBO
      WebGLUtility.enableBuffer(gl, this.sphereVBO, this.offscreenAttLocation, this.offscreenAttStride, this.sphereIBO);
      // シェーダに各種パラメータを送る
      gl.uniformMatrix4fv(this.offscreenUniLocation.mvpMatrix, false, mvp);
      gl.uniformMatrix4fv(this.offscreenUniLocation.normalMatrix, false, normalMatrix);
      gl.uniform1i(this.offscreenUniLocation.textureUnit, 0);
      // 描画
      gl.drawElements(gl.TRIANGLES, this.sphereGeometry.index.length, gl.UNSIGNED_SHORT, 0);
    }
    // ------------------------------------------------------------------------

    // - 最終シーンのレンダリング ---------------------------------------------
    {
      // レンダリングのセットアップ
      this.setupRendering();

      // VBO と IBO
      // ※ここでは -1.0 ～ 1.0 の幅を持つ板状のジオメトリをバインドしている
      WebGLUtility.enableBuffer(gl, this.planeVBO, this.renderAttLocation, this.renderAttStride, this.planeIBO);
      // シェーダに各種パラメータを送る
      gl.uniform1i(this.renderUniLocation.textureUnit, 0);
      gl.uniform2fv(this.renderUniLocation.mousePosition, this.mousePosition);
      gl.uniform1f(this.renderUniLocation.mosaicSize, this.mosaicSize);
      gl.uniform2fv(this.renderUniLocation.resolution, [this.canvas.width, this.canvas.height]);
      // 描画
      gl.drawElements(gl.TRIANGLES, this.planeGeometry.index.length, gl.UNSIGNED_SHORT, 0);
    }
    // ------------------------------------------------------------------------
  }
}
