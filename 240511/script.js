import * as THREE from './lib/three.module.js';
import { OrbitControls } from './lib/OrbitControls.js';

window.addEventListener('DOMContentLoaded' , () => {
	const wrapper = document.querySelector('#webgl');
	const app = new ThreeApp(wrapper);
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
		clearColor: 0x000000,
		width: window.innerWidth,
		height: window.innerHeight,
	};

	// 平行高原
	static DIRECTIONAL_LIGHT_PARAM = {
		color: 0xffffff,
		intensity: 1.5,
		position: new THREE.Vector3(1.0, 1.0, 1.0), // 光の向き（XYZ）
	};

	// スポットライト
	static SPOT_LIGHT_PARAM = {
		color: 0xffffff,
		distance: 20,
		position: new THREE.Vector3(7.0, 8.0, 7.0), // XYZ
	}

	// アンビエンスライト
	static AMBIENT_LIGHT_PARAM = {
		color: 0xffffff,
		intensity: 0.3,
	};

	// マテリアル
	static MATERIAL_PARAM = {
		color: 0x3399ff, // マテリアルの基本色
	};

	renderer;
	scene;
	camera;
	directionalLight;
	spotLight;
	ambientLight;
	boxGeometry;
	material;
	controls;
	sxesHelper;
	angle;

	constructor(wrapper) {
		// レンダラー
		const color = new THREE.Color(ThreeApp.RENDERER_PARAM.clearColor);
		this.renderer = new THREE.WebGLRenderer();
		this.renderer.setClearColor(color);
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

		// スポットライト
		this.spotLight = new THREE.SpotLight(
			ThreeApp.SPOT_LIGHT_PARAM.color,
			ThreeApp.SPOT_LIGHT_PARAM.distance,
		);
		this.spotLight.position.copy(ThreeApp.SPOT_LIGHT_PARAM.position);
		this.spotLight.castShadow = true;
		this.scene.add(this.spotLight);

		// アンビエントライト
		this.ambientLight = new THREE.AmbientLight(
			ThreeApp.AMBIENT_LIGHT_PARAM.color,
			ThreeApp.AMBIENT_LIGHT_PARAM.intensity,
		);
		this.scene.add(this.ambientLight);

		// cube
		this.boxArray = [];
		this.createBoxes();
		this.startAnimation();
		this.angle = 0;

		// 軸ヘルパー
		// const axesBarLength = 5.0;
		// this.axesHelper = new THREE.AxesHelper(axesBarLength);
		// this.scene.add(this.axesHelper);
    
		// コントロール
		this.controls = new OrbitControls(this.camera, this.renderer.domElement);

		// thisのバインド
		this.render = this.render.bind(this);

		// リサイズ
		window.addEventListener('resize', () => {
			this.renderer.setSize(window.innerWidth, window.innerHeight);
			this.camera.aspect = window.innerWidth / window.innerHeight;
			this.camera.updateProjectionMatrix();
		} ,false);
	}

	// cube
	createBoxes() {
		const boxCount = 100;
		const boxGeometry = new THREE.BoxGeometry(1, 1, 1);

		// 100個作る
		for (let i = 0; i < boxCount; i++) {
			// パステル系でまとめたい
			const hue = Math.random() * 360;
			const material = new THREE.MeshLambertMaterial({ color: `hsl(${hue}, 100%, 70%)` });

			// ボックス
			const box = new THREE.Mesh(boxGeometry, material);
			
			// 位置 XYZ -10から+10の間でランダムに配置
			box.position.set(
				(Math.random() - 0.5) * 20,
				(Math.random() - 0.5) * 16, // -8から+8
				(Math.random() - 0.5) * 20
			);

			// 初期スケール 0.5より大きいなら1、小さいなら0から
			const initialScale = Math.random() > 0.5 ? 1 : 0;
			box.scale.set(initialScale, initialScale, initialScale);

			// 回転量の初期化 -0.02から0.02の間(数が大きいとスピードが上がる)
			this.randomRotation = new THREE.Vector3(
				(Math.random() * 0.4 - 0.2) * 0.1,
				(Math.random() * 0.4 - 0.2) * 0.1,
				(Math.random() * 0.4 - 0.2) * 0.1
			);

			// 影
			box.castShadow = true;
			box.receiveShadow = true;

			// 追加
			this.scene.add(box);
			this.boxArray.push(box);
		}
	}

	// 動き
	scaleBoxes(box) {
		// 基本が2秒、ランダムに0~800の数字を追加
		const duration = 2000 + Math.random() * 800;
		const startScale = box.scale.x === 0 ? 0 : 1;
		const endScale = box.scale.x === 0 ? 1 : 0;

		// アニメーション
		const animate = () => {
			const startTime = Date.now();
			// フレームごとに呼び出される
			const animateFrame = () => {
				const currentTime = Date.now();
				const elapsed = currentTime - startTime;
				// 進行度0~1
				const progress = Math.min(elapsed / duration, 1);
				const easedProgress = easeInOutQuart(progress);

				const newScale = startScale + (endScale - startScale) * easedProgress;
				box.scale.set(newScale, newScale, newScale);

				if (progress < 1) {
					requestAnimationFrame(animateFrame);
				} else {
					this.scaleBoxes(box);
				}
			};
			animateFrame();
		};
		animate();
	}

	// スケールのアニメーション開始
	startAnimation() {
		this.boxArray.forEach((box, index) => {
			setTimeout(() => {
				this.scaleBoxes(box);
			}, index * 100);
		});
	}

	// boxの回転
	rotateBoxes() {
		const rotationSpeed = 0.01;
		this.angle += rotationSpeed;
		this.boxArray.forEach(box => {
			const x = box.position.x;
			const z = box.position.z;
			box.position.x = x * Math.cos(rotationSpeed) - z * Math.sin(rotationSpeed);
			box.position.z = x * Math.sin(rotationSpeed) + z * Math.cos(rotationSpeed);

			box.rotation.x += this.randomRotation.x;
			box.rotation.y += this.randomRotation.y;
			box.rotation.z += this.randomRotation.z;
		});
	}

	
	render() {
		// ループ設定
		requestAnimationFrame(this.render);

		// コントロールを更新
		this.controls.update();

		// 回転させ続ける
		this.rotateBoxes();

		// 描画
		this.renderer.render(this.scene, this.camera);
	}
}
function easeInOutQuart(t) {
  return t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;
}