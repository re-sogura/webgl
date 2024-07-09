import * as THREE from './lib/three.module.js';
// import { OrbitControls } from './lib/OrbitControls.js';

window.addEventListener('DOMContentLoaded' , async () => {
	const wrapper = document.querySelector('#webgl');
	const app = new ThreeApp(wrapper);
	app.init();
	app.render();
}, false);

class ThreeApp {
	static CAMERA_PARAM = {
		fovy: 50,
		aspect: window.innerWidth / window.innerHeight,
		near: 0.1,
		far: 30.0,
		position: new THREE.Vector3(2, 0.0, 3.0),
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
		intensity: 1.0,
		position: new THREE.Vector3(0.0, 3.0, 4.0),
	};

	static SHADOW_PARAM = {
		spaceSize: 3.0,
		mapSize: 512,
	};

	// アンビエンスライト
	static AMBIENT_LIGHT_PARAM = {
		color: 0xffffff,
		intensity: 0.8,
	};

	// マテリアル
	static MATERIAL_PARAM = {
		color: 0xffffff, // マテリアルの基本色
		side: THREE.DoubleSide, // 両面表示
	};

	renderer;
	scene;
	camera;
	directionalLight;
	ambientLight;
	controls;
	sxesHelper;
	cameraHelper
	calendar;
	planeArray ;
	planeGeometry;
	planeMaterial;
	plane;
	raycaster;
	isHit;
	isMoving;
	animationIndex;
	animationDone;
	currentYear;
	currentMonth;
	currentMonthIndex;
	monthlyCalendars

	constructor(wrapper) {
		// 初期化時に canvas を append できるようにプロパティに保持
		this.wrapper = wrapper;

		// thisのバインド
		this.render = this.render.bind(this);

		// Raycasterのインスタンスを生成する
		this.raycaster = new THREE.Raycaster();

		// 初期化
		this.isHit = null;
		this.isMoving = false;
		this.animationDone = false;
		this.animationIndex = 0;
		this.currentYear = new Date().getFullYear();
		this.currentMonth = new Date().getMonth() + 1;
		this.currentMonthIndex = 0;
		this.monthlyCalendars = [];

		// 移動
		window.addEventListener('click', (mouseEvent) => {
			// 移動中はクリック無視
			if( this.isMoving ) return;

			// スクリーン空間の座標系の正規化（-1.0〜1.0）
			const x = mouseEvent.clientX /  window.innerWidth * 2.0 - 1.0;
			const y = mouseEvent.clientY / window.innerHeight * 2.0 - 1.0;
			// スクリーン空間は上下反転してるので直す
			const v = new THREE.Vector2(x, -y);
			// レイキャスターに正規化済みマウス座標とカメラを指定
			this.raycaster.setFromCamera(v, this.camera);
			// scene に含まれる全てのオブジェクトを対象にレイキャストとする
			const intersects = this.raycaster.intersectObjects(this.planeArray);

			if(intersects.length > 0 && this.animationDone) {
				this.isHit = intersects[0].object;
				this.isMoving = true;
				// 最終日
				if( this.isHit.userData && this.isHit.userData.isLastDay ) {
					this.showNextCalendar();
				}
			}
		}, false);

		// リサイズ
		window.addEventListener('resize', () => {
			this.renderer.setSize(window.innerWidth, window.innerHeight);
			this.camera.aspect = window.innerWidth / window.innerHeight;
			this.camera.updateProjectionMatrix();
		} ,false);
	}

	init() {
		// レンダラー
		const color = new THREE.Color(ThreeApp.RENDERER_PARAM.clearColor);
		this.renderer = new THREE.WebGLRenderer();
		this.renderer.setClearColor(color);
		this.renderer.setSize(ThreeApp.RENDERER_PARAM.width, ThreeApp.RENDERER_PARAM.height);
		this.wrapper.appendChild(this.renderer.domElement);

		// レンダラーで影を描画するための機能を有効化する
		this.renderer.shadowMap.enabled = true;
		this.renderer.shadowMap.type = THREE.PCFShadowMap;

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
		// ディレクショナルライトが影を落とすように設定する
		this.directionalLight.castShadow = true;

		// 影用のカメラ
		this.directionalLight.shadow.camera.top = ThreeApp.SHADOW_PARAM.spaceSize;
		this.directionalLight.shadow.camera.bottom = -ThreeApp.SHADOW_PARAM.spaceSize;
		this.directionalLight.shadow.camera.left = -ThreeApp.SHADOW_PARAM.spaceSize;
		this.directionalLight.shadow.camera.right = ThreeApp.SHADOW_PARAM.spaceSize;

		// バッファのサイズは変更することもできる
		this.directionalLight.shadow.mapSize.width = ThreeApp.SHADOW_PARAM.mapSize;
		this.directionalLight.shadow.mapSize.height = ThreeApp.SHADOW_PARAM.mapSize;

		// ライトのヘルパー
		// this.cameraHelper = new THREE.CameraHelper(this.directionalLight.shadow.camera);
		// this.scene.add(this.cameraHelper);

		// アンビエントライト
		this.ambientLight = new THREE.AmbientLight(
			ThreeApp.AMBIENT_LIGHT_PARAM.color,
			ThreeApp.AMBIENT_LIGHT_PARAM.intensity,
		);
		this.scene.add(this.ambientLight);

		// カレンダー設定
		this.createCalendar(this.currentYear, this.currentMonth);

		// 軸ヘルパー
		// const axesBarLength = 5.0;
		// this.axesHelper = new THREE.AxesHelper(axesBarLength);
		// this.scene.add(this.axesHelper);

		// コントロール
		// this.controls = new OrbitControls(this.camera, this.renderer.domElement);
	}

	// カレンダー作成
	createCalendar(year, month) {
		// 日付取得
		const weeks = ['日', '月', '火', '水', '木', '金', '土']; // 曜日
		// const today = date.getDate(); // 今日
		const startDate = new Date(year, month - 1, 1); // 月初(Monthは0始まりのため、-1しておく)
		const endData = new Date(year, month, 0); // 日付に0を設定し、該当月のの0日（つまり、前月末）にする
		const endDayCount = endData.getDate(); // 月の末日
		const startDay = startDate.getDay(); // 月の最初の曜日

		// 日のカウント。何日から始まるかを決める。
		let dayCount = 1;

		// カレンダー
		this.calendar = new THREE.Group();
		this.scene.add(this.calendar);
		this.planeArray  = [];

		for (let i = 0; i < endDayCount; i++) {
			const text = `${year}年\n${month}月${dayCount}日\n(${weeks[(startDay + dayCount - 1) % 7]})`;
			const texture = this.createText(text);
			
			this.planeMaterial = new THREE.MeshPhongMaterial({
				map: texture,
				side: THREE.DoubleSide,
			});

			this.planeGeometry = new THREE.PlaneGeometry(2, 2);
			this.plane = new THREE.Mesh(this.planeGeometry, this.planeMaterial);
			this.plane.position.set(0.0, 3.0, 0.01 * -i);
			this.plane.receiveShadow = true;
			this.plane.castShadow = true;
			this.plane.targetY = this.plane.position.y;
			this.planeArray.push(this.plane);
			this.calendar.add(this.plane);

			// 最終日
			if( i === endDayCount -1 ) {
				this.plane.userData = { isLastDay: true };
			}

			dayCount++;
		}
		this.animationIndex = 0;
		this.animationDone = false;
	}

	// 文字入れる
	createText(text) {
		const canvas = document.createElement('canvas');
		const context = canvas.getContext('2d');
		canvas.width = 512;
		canvas.height = 512;
		
		// 背景を塗りつぶす
		context.fillStyle = 'white';
		context.fillRect(0, 0, canvas.width, canvas.height); // x, y, width, height
		const lines = text.split('\n'); // 改行で分割して配列
		context.textAlign = 'center';
		context.textBaseline = 'middle';

		// 年
		context.fillStyle = 'red';
		context.fillRect(0, 0, canvas.width, 80); // yを80塗りつぶす
		context.font = '48px Noto sans JP';
		context.fillStyle = 'white'; // 図形の内側を塗りつぶす（文字を白に）
		context.fillText(lines[0], canvas.width / 2, 40); // text, x, y

		// 月日・曜日
		const dw = lines.slice(1).join('\n'); // 1行目以降をがっちゃんこ
		context.font = '70px Noto sans JP';
		context.fillStyle = 'black';
		context.fillText(dw, canvas.width / 2, canvas.height / 2); // センターに

		const texture = new THREE.CanvasTexture(canvas);
		return texture;
	}

	// カレンダー切り替え
	showNextCalendar() {
		// 現在のカレンダーは削除
		this.scene.remove(this.calendar);

		// 次のカレンダー
		this.currentMonth++;
		if( this.currentMonth > 12 ) {
			this.currentMonth = 1;
			this.currentYear++;
		}
		this.createCalendar(this.currentYear, this.currentMonth);
	}

	render() {
		// ループ設定
		requestAnimationFrame(this.render);

		// コントロールを更新
		// this.controls.update();

		// 最初の動き
		if( !this.animationDone ) {
			if( this.animationIndex < this.planeArray.length ) {
				const now = this.planeArray[this.animationIndex];
				now.position.y -= 0.6;
				if( now.position.y <= 0 ) {
					now.position.y = 0;
					this.animationIndex++;
				}
			} else {
				this.animationDone = true;
			}
		}

		// 飛ばす
		if( this.isHit ) {
			this.isHit.position.x -= 0.09;
			this.isHit.position.y += 0.09;
			// オブジェクトが一定数達してない場合のみ移動
			if( this.isHit.position.z < 4 ) {
				this.isHit.position.z += 0.12;
			} else {
				this.isMoving = false;
				this.isHit = null;
			}
		}

		// 描画
		this.renderer.render(this.scene, this.camera);
	}
}