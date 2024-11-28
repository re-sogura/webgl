import * as THREE from './lib/three.module.js';
// import { OrbitControls } from './lib/OrbitControls.js';
import { GLTFLoader } from './lib/GLTFLoader.js';
import { DRACOLoader } from './lib/DRACOLoader.js';

// DOMContentLoaded DOMツリーが読み終わったら（画像やCSSが読み込まれる前）
window.addEventListener('DOMContentLoaded', async () => {
	const wrapper = document.querySelector('#webgl');
	const app = new ThreeApp(wrapper);
	await app.load();
	app.init();
	app.render();
}, false);

class ThreeApp {

	// 画面外
	static CAMERA_DISTANCE = window.innerWidth / 75;

	// カメラ
	static CAMERA_PARAM = {
		fovy: 60,
		aspect: window.innerWidth / window.innerHeight,
		near: 0.1,
		far: 80.0,
		position: new THREE.Vector3(0.0, 0.0, 10.0),
		lookAt: new THREE.Vector3(0.0, 0.0, 0.0),
	};
	// レンダラー
	static RENDERER_PARAM = {
		clearColor: 0xffffff,
		width: window.innerWidth,
		height: window.innerHeight,
	};
	// 平行光源
	static DIRECTIONAL_LIGHT_PARAM = {
		color: 0xffffff,
		intensity: 2.0,
		position: new THREE.Vector3(0.0, 1.0, 2.0),
	};
	// アンビエントライト
	static AMBIENT_LIGHT_PARAM = {
		color: 0xffffff,
		intensity: 1.4
	};
	// マテリアル
	static MATERIAL_PARAM = {
		color: 0xffffff, // マテリアルの基本色（テクスチャ貼る時は白！）
	};

	wrapper;
	renderer;
	scene;
	camera;
	directionalLight;
	ambientLight;
	axesHelper;
	cameraHelper;
	controls;
	textures;
	gltfs;
	itemArray;
	itemWrap
	packGeometry;
	packMaterial;
	pack;
	gltfPasta;
	gltfPlane;
	gltfBurger;
	gltfRoom;
	loopText;
	spans;
	lookFrg;

	constructor(wrapper) {
		this.wrapper = wrapper;

		// this
		this.render = this.render.bind(this);

		// 初期化
		this.spans = [];
		this.itemArray = [];
		this.itemWrap = [];
		this.lookFrg = true;

		// マウスカーソルに合わせて動かす
		window.addEventListener('mousemove', (MouseEvent) => {
			if( !this.lookFrg ) return;
			// 位置
			const x = MouseEvent.clientX / window.innerWidth * 2.0 - 1.0;
			const y = MouseEvent.clientY / window.innerHeight * 2.0 - 1.0;

			// スクリーン座標をワールド座標に変換
			const mousePosition = new THREE.Vector3(x, -y, 0);
			mousePosition.unproject(this.camera);

			// カメラの位置とマウス位置を繋ぐベクトルを計算
			const direction = mousePosition.sub(this.camera.position).normalize();

			// 任意の距離に対するターゲット座標を計算
			const distance = 3;
			const targetPosition = this.camera.position.clone().add(direction.multiplyScalar(distance));

			// シーン内の各オブジェクトをマウス位置に向ける
			this.itemWrap.forEach((item) => {
				item.lookAt(targetPosition);
			});
		});

		// モーダルボタンクリック
		const body = document.body;
		const mdlBtn = document.querySelector('.modal-btn');
		mdlBtn.addEventListener('click', () => {
			if( !body.classList.contains('is-active') ) {
				body.classList.add('is-active');
				this.lookFrg = false;
			} else {
				body.classList.remove('is-active');
				this.lookFrg = true;
			}
		});

		// リサイズ
		window.addEventListener('resize', () => {
			this.renderer.setSize(window.innerWidth, window.innerHeight);
			// カメラのアスペクト比を治す
			this.camera.aspect = window.innerWidth / window.innerHeight;
			// アスペクト比の変更を有効
			this.camera.updateProjectionMatrix();
		}, false);	
	}

	// 初期化処理
	init() {
		// レンダラー
		const color = new THREE.Color(ThreeApp.RENDERER_PARAM.clearColor);
		this.renderer = new THREE.WebGLRenderer({alpha: true});
		this.renderer.setClearColor(color, 0);
		this.renderer.setSize(ThreeApp.RENDERER_PARAM.width, ThreeApp.RENDERER_PARAM.height);
		this.wrapper.appendChild(this.renderer.domElement);

		// 色合い調整
		this.renderer.outputColorSpace = THREE.SRGBColorSpace;

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

		// ディレクショナルライト（平行光源）
		this.directionalLight = new THREE.DirectionalLight(
			ThreeApp.DIRECTIONAL_LIGHT_PARAM.color,
			ThreeApp.DIRECTIONAL_LIGHT_PARAM.intensity
		);
		this.directionalLight.position.copy(ThreeApp.DIRECTIONAL_LIGHT_PARAM.position);
		this.scene.add(this.directionalLight);

		// アンビエントライト（環境光）
		this.ambientLight = new THREE.AmbientLight(
			ThreeApp.AMBIENT_LIGHT_PARAM.color,
			ThreeApp.AMBIENT_LIGHT_PARAM.intensity,
		);
		this.scene.add(this.ambientLight);

		// メッシュ
		const packWidth = 3;
		const packHeight = 5;
		const packDepth = 1;
		const packGeometry = new THREE.BoxGeometry(packWidth, packHeight, packDepth);
		
		// UVマッピングのカスタマイズ
		// 左上、右上、左下、右下
		const uvMapping = [
			// 右
			0.623046875, 0.91015625, 0.705078125, 0.91015625, 0.623046875, 0.5, 0.705078125, 0.5,
			// 左
			0.294921875, 0.91015625, 0.376953125, 0.91015625, 0.294921875, 0.5, 0.376953125, 0.5,
			// 上面（蓋）
			0.376953125, 0.9921875, 0.623046875, 0.9921875, 0.376953125, 0.91015625, 0.623046875, 0.91015625,
			// 底面（下の蓋）
			0.376953125, 0.5, 0.623046875, 0.5, 0.376953125, 0.41796875, 0.623046875, 0.41796875,
			// 正面
			0.376953125, 0.91015625, 0.623046875, 0.91015625, 0.376953125, 0.5, 0.623046875, 0.5,
			// 裏面
			0.376953125, 0.41796875, 0.623046875, 0.41796875, 0.376953125, 0.0078125, 0.623046875, 0.0078125,
		];

		// UVマッピングの反映
		const uvAttribute = packGeometry.attributes.uv;
		uvAttribute.array.set(uvMapping);
		uvAttribute.needsUpdate = true;

		// テクスチャとマテリアル
		this.packMaterial = new THREE.MeshPhongMaterial(ThreeApp.MATERIAL_PARAM);
		this.packMaterial.map = this.textures[0];
		this.pack = new THREE.Mesh(packGeometry, this.packMaterial);

		// パッケ1のポジション
		this.pack.rotation.x = -0.4;
		this.pack.rotation.y = -0.4;
		this.pack.rotation.z = -0.4;

		// パスタ
		this.gltfPasta = new THREE.Group();
		this.gltfPasta.add(this.gltfs[0]);

		// 回転とか調整
		this.gltfPasta.rotation.x = -0.4;
		this.gltfPasta.rotation.z = 0.4;

		// 飛行機
		this.gltfPlane = new THREE.Group();
		this.gltfPlane.add(this.gltfs[1]);
		this.gltfPlane.add(this.gltfs[2]);

		this.gltfPlane.rotation.y = -0.4;
		this.gltfPlane.rotation.x = 0.4;

		// バーガー
		this.gltfBurger = new THREE.Group();
		this.gltfBurger.add(this.gltfs[3]);

		this.gltfBurger.rotation.x = 0.4;
		this.gltfBurger.rotation.z = -0.6;

		// 部屋
		this.gltfRoom = new THREE.Group();
		this.gltfRoom.add(this.gltfs[4]);

		this.gltfRoom.position.y = -1.4;
		this.gltfRoom.rotation.y = -0.5;

		// オブジェクトを並べる
		this.itemArray = [
			this.pack,
			this.gltfPasta,
			this.gltfPlane,
			this.gltfBurger,
			this.gltfRoom,
		];

		// シーンに追加
		this.itemArray.forEach((item) => {
			// 各オブジェクトを入れる用のグループ
			const group = new THREE.Group();
			group.add(item);
			// 追加
			this.scene.add(group);
			// 配列に
			this.itemWrap.push(group);
			
			group.visible = false;
			group.firstAnimate = true; // 初回用（初回だよ！ ture）
			group.position.x = 0;
		});

		// ループテキスト
		const loopArea = document.querySelector('.loop-text');
		const loopRepeat = 8;

		for( let i = 0; i < loopRepeat; i++ ) {
			const span = document.createElement('span');
			span.textContent = this.loopText;
			loopArea.appendChild(span);

			this.spans.push(span);
		}

		// 画面内処理
		const showSection = (entries) => {
			entries.forEach((entry) => {
				// indexをとる
				const index = Array.from(entry.target.parentElement.children).indexOf(entry.target);

				if( entry.isIntersecting ) {
					// テキストを変える
					this.loopText = ['Curry', 'Pasta', 'Plane', 'Burger', 'Room'][index] || ''; 
					this.spans.forEach((span) => {
						span.textContent = this.loopText;
					});

					// 背景を変える
					const bgColors = [
						'#ffe4ac',
						'#d5deeb',
						'#b6c6ea',
						'#ffdddd',
						'#bdeed9',
					];

					document.body.style.setProperty('--bgColor', bgColors[index]);

					// モーダルの切り替え
					const modalDetails = document.querySelectorAll('.modal-wrap .detail');
					modalDetails.forEach((detail) => {
						detail.classList.remove('is-view');
					});
					if( index >= 0 && index < modalDetails.length ) { // エラー回避用 if
						modalDetails[index].classList.add('is-view');
					}

					// オブジェクトを表示
					this.fadeIn(this.itemWrap[index]);
				} else {
					// オブジェクトを非表示
					this.fadeOut(this.itemWrap[index]);
				}
			});
		};

		// Intersectionのオプション
		const interOptions = {
			root: null,
			rootMargin: '-1px 0px -100% 0px',
		};
		
		// observerを作成
		const sectionObserver = new IntersectionObserver(showSection, interOptions);

		// セクションの監視
		const sections = document.querySelectorAll('.section');
		sections.forEach((section) => {
			sectionObserver.observe(section);
		});

		// 軸ヘルパー
		// const axesBarLength = 5.0;
		// this.axesHelper = new THREE.AxesHelper(axesBarLength);
		// this.scene.add(this.axesHelper);

		// ライトのヘルパー
		// this.cameraHelper = new THREE.CameraHelper(this.directionalLight.shadow.camera);
		// this.scene.add(this.cameraHelper);

		// コントロール
		// this.controls = new OrbitControls(this.camera, this.renderer.domElement);
	}

	// アセット（複数ロード）
	load() {
		return new Promise((resolve) => {
			// 画像のパスの配列
			const imagePath = [
				'./imgs/package-01.png',
			];
			// ロード
			const loader = new THREE.TextureLoader();
			const texturePromise = imagePath.map((path) =>
				new Promise((resolve) => {
					loader.load(path, (texture) => {
						texture.colorSpace = THREE.SRGBColorSpace;
						resolve(texture);
					});
				})
			);

			// blenderのドラコ圧縮用
			const dracoLoader = new DRACOLoader();
			dracoLoader.setDecoderPath('./draco/');

			// GLTF用ローダー
			const gltfLoader = new GLTFLoader();
			gltfLoader.setDRACOLoader(dracoLoader);

			// 3Dモデルの読み込み
			const glthPath = [
				'./imgs/obj/pasta.glb',
				'./imgs/obj/plane.glb',
				'./imgs/obj/blade.glb',
				'./imgs/obj/burger.glb',
				'./imgs/obj/room.glb',
			];

			const gltfPromise = glthPath.map((path) =>
				new Promise((resolve) => {
					gltfLoader.load(path, (gltf) => {
						resolve(gltf.scene);
					});
				})
			);

			// Promise.allは一つの配列を渡す必要がある
			// 全ての画像が読み込まれるまで待つ
			// 読み込み終わったら then を実行
			Promise.all([...texturePromise, ...gltfPromise]).then((results) => {
				// 配列にしちゃったから、結果を分ける
				const textures = results.slice(0, texturePromise.length);
				const gltfs = results.slice(texturePromise.length);

				// 配列で各々保持
				this.textures = textures;
				this.gltfs = gltfs;
				resolve(); // 完了したよを返す
			});
		});
	}

	// オブジェクトを表示
	fadeIn(obj) {
		// 表示
		obj.visible = true;

		// 初回のみ回転アニメーションを実行
		// 初回フラグ
		if (obj.firstAnimate) {
			const tl = gsap.timeline();
			tl
			.to(obj.position, {
				y: -0.5, z: 2, duration: 0
			})
			.to(obj.rotation, {
				x: 0.3, z: -0.2, duration: 0 }, "<"
			)
			.to(obj.position, {
				y: 0, z: 0, duration: 1.2, ease: Power2.easeOut
			})
			.to(obj.rotation, {
				x: 0, z: 0, duration: 1.2, ease: Power2.easeOut,
				onComplete: () => {
					obj.firstAnimate = false; // アニメーション完了後にフラグを立てる
				},
			}, "<");
		}

		// ループテキストのアニメーション
		const loopIn = document.querySelectorAll('.loop-text span');
		loopIn.forEach((text) => {
			text.animate(
				{
					opacity: [0, 1],
					translate: ['0 50%', '0 0'],
				},
				{
					duration: 800,
					easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
					fill: 'forwards',
				}
			);
		});

		// 位置を真ん中に
		gsap.to(obj.position, {
			x: 0,
			duration: 0.5,
			ease: Power4.easeOut,
		});
		gsap.to(obj.rotation, {
			x: 0,
			y: 0,
			z: 0,
			duration: 0,
		});
	}

	// オブジェクトを隠す
	fadeOut(obj) {
		obj.firstAnimate = false; // 画面外は初回フラグtrue
		gsap.to(obj.position, {
			x: obj.position.x - ThreeApp.CAMERA_DISTANCE,
			duration: 0.5,
			ease: Power4.easeOut,
			onComplete: () => {
				obj.position.x = ThreeApp.CAMERA_DISTANCE;
				obj.visible = false;
			}
		});
	}

	/**
	 * 描画処理
	 */
	render() {
		// ループ設定
		requestAnimationFrame(this.render);

		// コントロールを更新
		// this.controls.update();

		// 描画
		this.renderer.render(this.scene, this.camera);
	}
}