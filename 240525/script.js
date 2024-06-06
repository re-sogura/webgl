import * as THREE from './lib/three.module.js';
import { OrbitControls } from './lib/OrbitControls.js';
import { GLTFLoader } from './lib/GLTFLoader.js';
import { DRACOLoader } from './lib/DRACOLoader.js';

window.addEventListener('DOMContentLoaded' , async () => {
	const wrapper = document.querySelector('#webgl');
	const app = new ThreeApp(wrapper);
	await app.load();
	app.render();
}, false);

class ThreeApp {
	static CAMERA_PARAM = {
		fovy: 60,
		aspect: window.innerWidth / window.innerHeight,
		near: 0.1,
		far: 40.0,
		position: new THREE.Vector3(7.0, 3.0, 7.0),
		lookAt: new THREE.Vector3(0.0, 0.0, 0.0),
	};

	// レンダラー
	static RENDERER_PARAM = {
		clearColor: 0xffffff,
		width: window.innerWidth,
		height: window.innerHeight,
	};

	// 平行高原
	static DIRECTIONAL_LIGHT_PARAM = {
		color: 0xffffff,
		intensity: 1.5,
		position: new THREE.Vector3(1.0, 1.0, 1.0), // 光の向き（XYZ）
	};

	// アンビエンスライト
	static AMBIENT_LIGHT_PARAM = {
		color: 0xffffff,
		intensity: 0.6,
	};

	// マテリアル
	static MATERIAL_PARAM = {
		color: 0x3399ff, // マテリアルの基本色
	};

	renderer;
	scene;
	camera;
	directionalLight;
	ambientLight;
	controls;
	sxesHelper;
	head;
	plane;
	blade;
	verticalTime;
	horizontalTime;
	verticalActive;
	horizontalActive;
	verticalAngle;
	horizontalAngle;
	powerActive;
	isSpeed;

	constructor(wrapper) {
		// レンダラー
		const color = new THREE.Color(ThreeApp.RENDERER_PARAM.clearColor);
		this.renderer = new THREE.WebGLRenderer({ alpha: true });
		this.renderer.setClearColor(color, 0);
		this.renderer.setSize(ThreeApp.RENDERER_PARAM.width, ThreeApp.RENDERER_PARAM.height);
		this.renderer.shadowMap.enabled = true;
		wrapper.appendChild(this.renderer.domElement);

		// シーン
		this.scene = new THREE.Scene();

		// カメラ
		this.camera = new THREE.PerspectiveCamera(
			ThreeApp.CAMERA_PARAM.fovy,
			ThreeApp.CAMERA_PARAM.aspect,
			ThreeApp.CAMERA_PARAM.near,
			ThreeApp.CAMERA_PARAM.far,
		);
		this.camera.position.copy(ThreeApp.CAMERA_PARAM.position);
		this.camera.lookAt(ThreeApp.CAMERA_PARAM.lookAt);

		// ディレクショナルライト
		this.directionalLight = new THREE.DirectionalLight(
			ThreeApp.DIRECTIONAL_LIGHT_PARAM.color,
			ThreeApp.DIRECTIONAL_LIGHT_PARAM.intensity,
		);
		this.directionalLight.position.copy(ThreeApp.DIRECTIONAL_LIGHT_PARAM.position);
		this.scene.add(this.directionalLight);

		// アンビエントライト
		this.ambientLight = new THREE.AmbientLight(
			ThreeApp.AMBIENT_LIGHT_PARAM.color,
			ThreeApp.AMBIENT_LIGHT_PARAM.intensity,
		);
		this.scene.add(this.ambientLight);

		// 軸ヘルパー
		// const axesBarLength = 5.0;
		// this.axesHelper = new THREE.AxesHelper(axesBarLength);
		// this.scene.add(this.axesHelper);
    
		// コントロール
		this.controls = new OrbitControls(this.camera, this.renderer.domElement);

		// thisのバインド
		this.render = this.render.bind(this);

		// 機体（動く部分）
		this.headWrap = new THREE.Group();
		this.scene.add(this.headWrap);

		this.head = new THREE.Group();
		this.headWrap.add(this.head);

		// 停止ボタン
		this.isSpeed = 0;
		
		this.powerActive = false;
		const powerBtn = document.querySelector('.power-btn');
		const btnArea = document.querySelector('.switch');
		powerBtn.addEventListener('click', () => {
			if( !this.powerActive ) {
				this.powerActive = true;
				this.isSpeed = -0.1;
				btnArea.classList.add('active');
				powerBtn.classList.add('active');
				document.body.classList.add('move');
			} else {
				this.powerActive = false;
				this.verticalActive = false;
				this.horizontalActive = false;
				this.isSpeed = 0;
				btnArea.classList.remove('active');
				powerBtn.classList.remove('active');
				document.body.classList.remove('move');
			}
		});

		// 縦振りのスイッチ
		this.verticalAngle = 0;
		this.verticalTime = 0;
		this.verticalActive = false;
		const verticalBtn = document.querySelector('.vertical-btn');
		verticalBtn.addEventListener('click', () => {
			// trueならfalse、falseならtrueになる
			if( this.powerActive ) {
				this.verticalActive = !this.verticalActive;
			}
		});

		// 横振りのスイッチ
		this.horizontalAngle = 0;
		this.horizontalTime = 0;
		this.horizontalActive = false;
		const horizontalBtn = document.querySelector('.horizontal-btn');
		horizontalBtn.addEventListener('click', () => {
			if( this.powerActive ) {
				this.horizontalActive = !this.horizontalActive;
			}
		});

		// 強弱ボタン
		const step = document.querySelector('.step');
		const stepBtn = step.querySelectorAll('input');
		stepBtn.forEach((btn) => {
			btn.addEventListener('click', (event) => {
				if( this.powerActive ) {
					this.isSpeed = parseFloat(btn.dataset.speed);
				}
			});
		});

		// リサイズ
		window.addEventListener('resize', () => {
			this.renderer.setSize(window.innerWidth, window.innerHeight);
			this.camera.aspect = window.innerWidth / window.innerHeight;
			this.camera.updateProjectionMatrix();
		} ,false);
	}

	// ロード
	async load() {
		const dracoLoader = new DRACOLoader();
		dracoLoader.setDecoderPath('./draco/');

		const loader = new GLTFLoader();
		loader.setDRACOLoader(dracoLoader);

		const loadModel = (url) => {
			return new Promise((resolve, reject) => {
				loader.load(url, (gltf) => {
					resolve(gltf.scene);
				}, undefined, reject);
			});
		};

		try {
			const base = await loadModel('base.glb');
			this.scene.add(base);

			const stand = await loadModel('stand.glb');
			this.scene.add(stand);

			this.plane = await loadModel('plane.glb');
			this.head.add(this.plane);

			this.blade = await loadModel('blade.glb');
			this.head.add(this.blade);
		} catch (error) {
			console.error('モデルの読み込みに失敗しました', error);
		}
	}
	
	render() {
		// ループ設定
		requestAnimationFrame(this.render);

		// コントロールを更新
		this.controls.update();

		// 羽回転
		this.blade.rotation.z += this.isSpeed;

		// 縦回転
		if ( this.verticalActive ) {
			this.verticalTime += 0.02; // 時間の経過を管理する変数
			this.verticalAngle = Math.sin(this.verticalTime) * (Math.PI / 180) * 15; // 上下の首振りの角度を計算
			this.head.rotation.x = this.verticalAngle; // 上下の首の角度を設定
		}

		// 横回転
		if ( this.horizontalActive ) {
			this.horizontalTime += 0.01;
			this.horizontalAngle = Math.sin(this.horizontalTime) * (Math.PI / 180) * 45;
			this.headWrap.rotation.y = this.horizontalAngle;
		}

		// 描画
		this.renderer.render(this.scene, this.camera);
	}
}