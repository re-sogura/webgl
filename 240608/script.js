import * as THREE from '../lib/three.module.js';
import { OrbitControls } from '../lib/OrbitControls.js';

window.addEventListener('DOMContentLoaded', async () => {
  const wrapper = document.querySelector('#webgl');
  const app = new ThreeApp(wrapper);
  app.init();
  app.render();
}, false);

class ThreeApp {
  // 地球の半径
  static EARTH_R = 1.5;

  // 飛行機の一定距離
  static PLANE_DISTANCE = 1.6;

  // カメラ
  static CAMERA_PARAM = {
    fovy: 60,
    aspect: window.innerWidth / window.innerHeight,
    near: 0.1,
    far: 40.0,
    position: new THREE.Vector3(0.0, 0.0, 4.0),
    lookAt: new THREE.Vector3(0.0, 0.0, 0.0),
  };

  // レンダラー
  static RENDERER_PARAM = {
    clearColor: 0x000000,
    width: window.innerWidth,
    height: window.innerHeight,
  };

  // 平行光源
  static DIRECTIONAL_LIGHT_PARAM = {
    color: 0xffffff,
    intensity: 1.5,
    position: new THREE.Vector3(1.0, 1.0, 1.0),
  };

  // アンビエントライト
  static AMBIENT_LIGHT_PARAM = {
    color: 0xffffff,
    intensity: 0.3,
  };

  // マテリアル
  static MATERIAL_PARAM = {
    color: 0xffffff,
  };

  // フォグ
  static FOG_PARAM = {
    color: 0xffffff,
    near: 10.0,
    far: 20.0,
  };

  wrapper;
  renderer;
  scene;
  camera;
  directionalLight;
  ambientLight;
  controls;
  sphereGeometry;
  earthWrap;
  earth;
  earthMaterial;
  plane;
  planeMaterial;
  cities;
  currentCityIndex;
  nextCityIndex;
  progress;

  /**
   * コンストラクタ
   * @constructor
   * @param {HTMLElement} wrapper - canvas 要素を append する親要素
   */
  constructor(wrapper) {
    // 初期化時に canvas を append できるようにプロパティに保持
    this.wrapper = wrapper;

    // バインド
    this.render = this.render.bind(this);

    // リサイズ
    window.addEventListener('resize', () => {
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
    }, false);
  }

  // 初期化
  init() {
    // レンダラー
    const color = new THREE.Color(ThreeApp.RENDERER_PARAM.clearColor);
    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setClearColor(color);
    this.renderer.setSize(ThreeApp.RENDERER_PARAM.width, ThreeApp.RENDERER_PARAM.height);
    this.wrapper.appendChild(this.renderer.domElement);

    // シーン
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(
      ThreeApp.FOG_PARAM.color,
      ThreeApp.FOG_PARAM.near,
      ThreeApp.FOG_PARAM.far
    );

    // カメラ
    this.camera = new THREE.PerspectiveCamera(
      ThreeApp.CAMERA_PARAM.fovy,
      ThreeApp.CAMERA_PARAM.aspect,
      ThreeApp.CAMERA_PARAM.near,
      ThreeApp.CAMERA_PARAM.far
    );
    this.camera.position.copy(ThreeApp.CAMERA_PARAM.position);
    this.camera.lookAt(ThreeApp.CAMERA_PARAM.lookAt);

    // ディレクショナルライト
    this.directionalLight = new THREE.DirectionalLight(
      ThreeApp.DIRECTIONAL_LIGHT_PARAM.color,
      ThreeApp.DIRECTIONAL_LIGHT_PARAM.intensity
    );
    this.directionalLight.position.copy(ThreeApp.DIRECTIONAL_LIGHT_PARAM.position);
    this.scene.add(this.directionalLight);

    // アンビエントライト
    this.ambientLight = new THREE.AmbientLight(
      ThreeApp.AMBIENT_LIGHT_PARAM.color,
      ThreeApp.AMBIENT_LIGHT_PARAM.intensity
    );
    this.scene.add(this.ambientLight);

    // 球体のジオメトリを生成
    this.sphereGeometry = new THREE.SphereGeometry(ThreeApp.EARTH_R, 64, 64);

    // 地球
    this.earthWrap = new THREE.Group();
    this.scene.add(this.earthWrap);

    this.earthMaterial = new THREE.MeshPhongMaterial({ color: 0x0077ff, wireframe: true });
    this.earthMaterial.map = this.earthTexture;
    this.earth = new THREE.Mesh(this.sphereGeometry, this.earthMaterial);
    this.earthWrap.add(this.earth);

    // 都市
    this.cities = [
      {
        country: '東京',
        latitude: 35.682839,
        longitude: 139.759455,
        color: 0x00ced1,
      },
      {
        country: 'デリー',
        latitude: 28.613939,
        longitude: 77.209021,
        color: 0xfa8072,
      },
      {
        country: 'ニューヨーク',
        latitude: 40.712776,
        longitude: -74.005974,
        color: 0x00ff00,
      },
      {
        country: 'シドニー',
        latitude: -33.868820,
        longitude: 151.209296,
        color: 0xffff00,
      },
      {
        country: '北極',
        latitude: -90,
        longitude: 0,
        color: 0xFF0000,
      },
      {
        country: '南極',
        latitude: 90,
        longitude: 0,
        color: 0x0000FF,
      }
    ];

    // 都市ポイント
    for(let i = 0; i < this.cities.length; i++) {
      const {latitude, longitude, color} = this.cities[i];
      const point = new THREE.Mesh(
        new THREE.SphereGeometry(0.025),
        new THREE.MeshPhongMaterial({color: color})
      );
      point.position.copy(this.translateGeoCoords(latitude, longitude));
      this.earthWrap.add(point);
    }

    // 旅客機
    const startLatitude = this.cities[0].latitude;
    const startLongitude = this.cities[0].longitude;
    let coords = this.translateGeoCoords(startLatitude, startLongitude);
    this.boxGeometry = new THREE.BoxGeometry(0.05, 0.1, 0.05);
    this.planeMaterial = new THREE.MeshPhongMaterial({ color: 0xff00dd });
    this.plane = new THREE.Mesh(this.boxGeometry, this.planeMaterial);
    // 配置
    coords.normalize().multiplyScalar(ThreeApp.PLANE_DISTANCE);
    this.plane.position.copy(coords);
    this.earthWrap.add(this.plane);

    // 移動ルート
    this.currentCityIndex = 0;
    this.nextCityIndex = 1;
    this.progress = 0; // 移動の進捗

    // コントロール
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);

    // 軸ヘルパー
    // const axesBarLength = 5.0;
    // this.axesHelper = new THREE.AxesHelper(axesBarLength);
    // this.scene.add(this.axesHelper);
  }

  // 緯度経度
  translateGeoCoords = (lat, lon) => {
    const phi = lat * Math.PI / 180;
    const lambda = (lon - 180) * Math.PI / 180;

    const x = -ThreeApp.EARTH_R * Math.cos(phi) * Math.cos(lambda);
    const y = ThreeApp.EARTH_R * Math.sin(phi);
    const z = ThreeApp.EARTH_R * Math.cos(phi) * Math.sin(lambda);

    return new THREE.Vector3(x, y, z);
  };

  // レンダリング
  render() {
    requestAnimationFrame(this.render);
    this.controls.update();

    // 旅客機移動
    const currentCity = this.cities[this.currentCityIndex];
    const nextCity = this.cities[this.nextCityIndex];
    const currentCityCoords = this.translateGeoCoords(currentCity.latitude, currentCity.longitude);
    const nextCityCoords = this.translateGeoCoords(nextCity.latitude, nextCity.longitude);
    this.progress += 0.002;
    if (this.progress > 1) {
      this.progress = 0;
      this.currentCityIndex = this.nextCityIndex;
      this.nextCityIndex = (this.nextCityIndex + 1) % this.cities.length;
    }

    // 回転の方向 setFromUnitVectorsで回転をとる
    const qCurrent = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      currentCityCoords.clone().normalize()
    );
    const qNext = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      nextCityCoords.clone().normalize()
    );
    const qSlerp = qCurrent.clone().slerp(qNext, this.progress);
    const position = new THREE.Vector3(0, 0, 1).applyQuaternion(qSlerp).multiplyScalar(ThreeApp.PLANE_DISTANCE);
    this.plane.position.copy(position);
    
    // 旅客機の姿勢を調整
    this.plane.quaternion.copy(qSlerp);

    // 地球を回す
    this.earthWrap.rotation.y += 0.001;

    this.renderer.render(this.scene, this.camera);
  }
}
