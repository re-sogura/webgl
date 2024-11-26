import * as THREE from './lib/three.module.js';
// import { OrbitControls } from './lib/OrbitControls.js';

// DOMContentLoaded DOMツリーが読み終わったら（画像やCSSが読み込まれる前）
window.addEventListener('DOMContentLoaded', async () => {
	const wrapper = document.querySelector('#webgl');
	const app = new ThreeApp(wrapper);
	await app.load();
	app.init();
	app.render();
}, false);

class ThreeApp {
	// 画像の数
	static PLANE_COUNT = 6;

	// インターバル
	static INTERVAL = 5000;

	// 円の半径
	static CIRCLE_RADIUS = 1; // 円の半径

	// カメラ
	static CAMERA_PARAM = {
		fovy: 65,
		aspect: window.innerWidth / window.innerHeight,
		near: 0.1,
		far: 80.0,
		position: new THREE.Vector3(0.0, 0.0, 3.0),
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
	static SHADOW_PARAM = {
		spaceSize: 2.0, // 影を生成するためのカメラの空間の広さ
		mapSize: 512,     // 影を生成するためのバッファのサイズ
	  };
	// アンビエントライト
	static AMBIENT_LIGHT_PARAM = {
		color: 0xffffff,
		intensity: 1.4
	};
	// マテリアル
	static MATERIAL_PARAM = {
		color: 0xffffff, // マテリアルの基本色
		side: THREE.FrontSide,
		opacity: 1,
		transparent: true,
	};
	// 裏面用マテリアル
	static BG_PARAM = {
		color: 0xeeeeee, // マテリアルの基本色
		side: THREE.BackSide,
		opacity: 1,
		transparent: true,
	};
	// プレビュー背景用マテリアル
	static PREVIEW_BG_PARAM = {
		color: 0x000000, // マテリアルの基本色
		side: THREE.FrontSide,
		opacity: 0,
		// scale: 0,
		transparent: true,
	};

	wrapper;
	renderer;
	scene;
	camera;
	directionalLight;
	ambientLight;
	group; // 全体
	card; // 一枚一枚の集まり
	cardArray;
	planeGeometry;
	textures;
	raycaster; // レイキャスター
	isHit;
	otherStopFrg;
	nextZoomFrg;
	zoomInFrg;
	resetFrg;
	angle; // 角度
	axesHelper;
	cameraHelper;
	controls;

	constructor(wrapper) {
		this.wrapper = wrapper;

		// this
		this.render = this.render.bind(this);

		// 初期化処理
		this.isHit = null;
		this.otherStopFrg = false;
		this.nextZoomFrg = false;
		this.zoomInFrg = false;
		this.resetFrg = false;
		this.angle = ((2 * Math.PI) / ThreeApp.PLANE_COUNT);
		this.lastTime = 0; // 時間用

		// レイキャスターのインスタンスを生成する
		this.raycaster = new THREE.Raycaster();

		// クリック処理
		window.addEventListener('click', (mouseEvent) => {
			// 共通関数を使用
			this.setRaycasterFromMouse(mouseEvent);

			// zoomIn時の背景
			this.resetBgDiv = document.getElementById('bg');
			
			if( !this.otherStopFrg ) {
				if( !this.zoomInFrg ) {
					// グループに対して
					const cardIntersects = this.checkRaycasterIntersection(
						this.clickableCards,
						(object) =>  Math.abs(object.position.z) < 0.01, // 裏面は判定しないように
					);
					if (cardIntersects.length > 0) {
						// カード全体を動かすように親を指定
						this.isHit = cardIntersects[0].object.parent;
		
						// カードのクリック対象を確認
						const clickedCard = this.clickableCards.findIndex(card => card === this.isHit);
						this.handleCardClick(clickedCard);
					}
				} else if ( this.zoomInFrg && this.resetFrg ) {
					const bgIntersect = this.checkRaycasterIntersection([this.resetBg]); // 配列を渡すから [] で囲む
					if( bgIntersect.length > 0 ) {
						this.zoomOut();
						this.resetZoom();
					}
				}
			}
		}, false);

		// マウスカーソル
		window.addEventListener('mousemove', (mouseEvent) => {
			// 共通関数を使用
			this.setRaycasterFromMouse(mouseEvent);

			// カードの更新
			this.updateClickCard();

			// マウスポインター用のdivタグを取得してcursorに格納
			this.cursor = document.getElementById('cursor');

			// テキスト
			this.cursorText = document.getElementById('cursor-text');
			// マウスポインターホバー用クラス名
			this.activeClass = 'is-active';

			// マウスポインター要素のcss
			this.cursor.style.translate = `${mouseEvent.clientX}px ${mouseEvent.clientY}px`;
			
			// ホバーのクラス付け外し
			const hoverItems = this.checkRaycasterIntersection(
				this.clickableCards, 
				(object) => Math.abs(object.position.z) < 0.01, // 裏面は判定しないように
			);

			// ズームしてる時としてない時で処理を変える
			if( this.zoomInFrg ) {
				this.cursorText.textContent = 'Back';
				this.cursor.classList.add(this.activeClass);
			} else {
				if (hoverItems.length > 0) {
					this.isHover = hoverItems[0].object.parent;
	
					// カードのホバー対象を確認
					const hoverCard = this.clickableCards.findIndex(card => card === this.isHover);
					// 配列[0, 1, 2]でindexに hoverCardを使ってる
					const cursorTextContent = ['Prev', 'Zoom', 'Next'][hoverCard] || '';
					this.updateCursor(
						cursor,
						mouseEvent.clientX,
						mouseEvent.clientY,
						this.cursorText,
						cursorTextContent,
						this.activeClass,
						true
					);
				} else {
					this.updateCursor(
						cursor,
						mouseEvent.clientX,
						mouseEvent.clientY,
						this.cursorText,
						'',
						this.activeClass,
						false
					);
				}
			}
		}, false);

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

		// レンダラー（影有効化
		this.renderer.shadowMap.enabled = true;
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
	
		// ディレクショナルライトが影を落とすように設定する
		this.directionalLight.castShadow = true;
	
		// 影用のカメラ（平行投影のカメラ）は必要に応じて範囲を広げる
		this.directionalLight.shadow.camera.top = ThreeApp.SHADOW_PARAM.spaceSize;
		this.directionalLight.shadow.camera.bottom = -ThreeApp.SHADOW_PARAM.spaceSize;
		this.directionalLight.shadow.camera.left = -ThreeApp.SHADOW_PARAM.spaceSize;
		this.directionalLight.shadow.camera.right = ThreeApp.SHADOW_PARAM.spaceSize;

		// 影用のバッファのサイズは変更することもできる
		this.directionalLight.shadow.mapSize.width  = ThreeApp.SHADOW_PARAM.mapSize;
		this.directionalLight.shadow.mapSize.height = ThreeApp.SHADOW_PARAM.mapSize;

		// アンビエントライト（環境光）
		this.ambientLight = new THREE.AmbientLight(
			ThreeApp.AMBIENT_LIGHT_PARAM.color,
			ThreeApp.AMBIENT_LIGHT_PARAM.intensity,
		);
		this.scene.add(this.ambientLight);

		// プレビューの背景
		const resetBgGeometry = new THREE.PlaneGeometry(window.innerWidth, window.innerHeight);
		this.resetBg = new THREE.Mesh(resetBgGeometry, new THREE.MeshPhongMaterial(ThreeApp.PREVIEW_BG_PARAM));
		this.resetBg.position.z = ThreeApp.CIRCLE_RADIUS + 0.5;
		this.scene.add(this.resetBg);

		// グループに入れる
		this.group = new THREE.Group();
		this.scene.add(this.group);

		// メッシュ（複数）
		this.planeGeometry = new THREE.PlaneGeometry(1, 1.5);
		this.cardArray = [];
		for (let i = 0; i < ThreeApp.PLANE_COUNT; ++i) {
			// マテリアルをテクスチャごとに作る
			const planMaterial = new THREE.MeshPhongMaterial({
				// color: ThreeApp.xxxの書き方も可。...は展開。
				...ThreeApp.MATERIAL_PARAM,
				map: this.textures[i]
			});

			// 画像用メッシュ
			const plane = new THREE.Mesh(this.planeGeometry, planMaterial);
			plane.rotation.y = Math.PI; // 反転
			plane.castShadow = true;

			// 裏面用メッシュ
			const bg = new THREE.Mesh(this.planeGeometry, new THREE.MeshPhongMaterial(ThreeApp.BG_PARAM));
			bg.position.z = +0.01; // 背面を少し後ろに配置
			bg.rotation.y = Math.PI; // 反転

			// カードのグループに追加
			this.card = new THREE.Group();
			this.card.add(plane, bg);
			this.group.add(this.card);

			// カードを配列に入れる
			this.cardArray.push(this.card);

			// カードを並べる
			// z軸を正面に
			const offsetAngle = Math.PI / 2;
			// 等間隔にするために全体の角度を count数 で割り、各角度をラジアン単位に変換（degree = 角度）
			const angle = this.angle * i + offsetAngle;
			let sin = Math.sin(angle) * ThreeApp.CIRCLE_RADIUS;
			let cos = Math.cos(angle) * ThreeApp.CIRCLE_RADIUS;

			this.card.position.set(cos, 0.0, sin);
			this.card.lookAt(0, 0, 0); // 中心に向ける
		}

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

	// アセット
	load() {
		return new Promise((resolve) => {
			// まず画像のパス
			const imagePath = [];
			const folder = './imgs/slide0';
			for(let i = 1; i <= ThreeApp.PLANE_COUNT; ++i) {
				imagePath.push(`${folder}${i}.jpg`);
			}
			// 複数ロード
			const loader = new THREE.TextureLoader();
			// return　書きたくないから {} は省略
			// map は配列を一つ一つ呼び出して、新しい配列を作る
			// texturePromisesにはtexture情報が新しい配列になって入ってる
			const texturePromises = imagePath.map((path) => 
				new Promise((resolve) => {
					loader.load(path, (texture) => {
						texture.colorSpace = THREE.SRGBColorSpace;
						resolve(texture);
					});
				})
			);
			// 全ての画像が読み込まれるまで待つ
			// 読み込み終わったら then を実行
			Promise.all(texturePromises).then((textures) => {
				this.textures = textures; // texturesに入れる（配列でテクスチャを保持）
				resolve(); // 完了したよを返す
			});
		});
	}

	// カーソル位置共通化
	setRaycasterFromMouse(mouseEvent) {
		const x = mouseEvent.clientX / window.innerWidth * 2.0 - 1.0;
		const y = mouseEvent.clientY / window.innerHeight * 2.0 - 1.0;
		const v = new THREE.Vector2(x, -y);
		this.raycaster.setFromCamera(v, this.camera);
	}

	// 交差判定とクリック処理 conditionFnは絞り込んで返してくれる関数
	checkRaycasterIntersection( objects, conditionFn = () => true ) {
		const intersects = this.raycaster.intersectObjects(objects);
		return intersects.filter((item) => conditionFn(item.object));
	}

	// カーソル処理
	updateCursor( cursorElement, x, y, textElement, text = '', activeClass, isActive = false ) {
		cursorElement.style.translate = `${x}px, ${y}px`;
		textElement.textContent = text;
		if( isActive ) {
			cursorElement.classList.add(activeClass);
		} else {
			cursorElement.classList.remove(activeClass);
		}
	}

	// クリック関数
	handleCardClick(index) {
		switch( index ) {
			case 0:
				this.prevRotation();
				break;
			case 1:
				this.cursorText.textContent = 'Back';
				this.zoomIn();
				break;
			case 2:
				this.nextRotation();
				break;
		}
	}

	// 次回転
	nextRotation() {
		this.otherStopFrg = true; // 動かしたらダメ
		const targetAngle = this.group.rotation.y - this.angle;
		// 次の角度まで反時計回りでアニメーション
		gsap.to(this.group.rotation, {
			y: targetAngle,
			duration: 1,
			ease: 'power4.out',
			onComplete: () => {
				// 回転終了後の処理
				
				// 回転が終わったら、クリック判定の更新
				this.updateClickCard();
				
				// 次のカードをヒットに
				if( this.nextZoomFrg ) {
					const clickedIndex = this.cardArray.indexOf(this.isHit);
					const nextIndex = (clickedIndex - 1 + this.cardArray.length) % this.cardArray.length;
					const nextCard = this.cardArray[nextIndex];
					this.isHit = nextCard;
					this.zoomIn();
				}
				// 一定ごとに回転をリセット
				if( Math.abs(this.group.rotation.y) >= 2 * Math.PI ) {
					this.group.rotation.y = 0;
				}

				this.otherStopFrg = false;
			}
		});
	}

	// 前回転
	prevRotation() {
		this.otherStopFrg = true;
		const targetAngle = this.group.rotation.y + this.angle;
		// 次の角度まで反時計回りでアニメーション
		gsap.to(this.group.rotation, {
			y: targetAngle,
			duration: 1,
			ease: 'power4.out',
			onComplete: () => { // 回転終了後の処理
				// 回転が終わったら、クリック判定の更新
				this.updateClickCard();
				this.otherStopFrg = false;
			}
		});
	}
	
	// ズームプレビュー
	zoomIn() {
		// 背景色
		const hue = Math.random() * 360;
		const circleColor = `hsl(${hue}, 100%, 80%)`;
		this.resetBgDiv.classList.add('is-active');
		this.resetBgDiv.style.backgroundColor = circleColor;
		this.resetBgDiv.style.setProperty('--circle-color', circleColor);

		this.otherStopFrg = true;
		this.resetFrg = false;
		this.zoomInFrg = true;
		this.nextZoomFrg = false;
		this.orgPosition = this.isHit.position.clone(); // attach前を覚えておく
		this.scene.attach(this.isHit);

		// 位置がズームの基準値かの確認
		const targetPosition = new THREE.Vector3(0, 0, ThreeApp.CIRCLE_RADIUS); // 正面位置
		const currentPosition = this.isHit.position;

		// 位置のずれの差分
		const deltaPosition = targetPosition.clone().sub(currentPosition);
		
		// カードが正面かの確認
		const currentRotationY = this.isHit.rotation.y % (Math.PI * 2); // 現在のY軸回転角度
		const targetRotationY = 0; // 正面
		const deltaRotationY = targetRotationY - currentRotationY;

		// 回転と位置のずれ修正（小さい誤差は無視）
		if( Math.abs(deltaRotationY) > 0.01 || deltaPosition.length() > 0.01 ) {
			this.isHit.rotation.y = targetRotationY;
			this.isHit.position.x = targetPosition.x;
			this.isHit.position.y = targetPosition.y;
			this.isHit.position.z = targetPosition.z;
		}

		// クリック以外を透過
		this.cardArray.forEach(card => {
			card.children.forEach(child => {
				if( child.material && child.parent !== this.isHit ) {
					gsap.to(child.material, {
						// 透過を設定
						opacity: 0, // materialに指定しないとダメ
						duration: 0.8,
					});
				} else if( child.material && child.parent == this.isHit ) {
					// 透過を設定
					gsap.to(child.material, {
						// 透過を設定
						opacity: 1, // materialに指定しないとダメ
						duration: 0.8,
					});
				}
			});
		});
		gsap.to(this.isHit.position, {
			z: this.isHit.position.z + 0.5,
			duration: 0.8,
			ease: 'power2.out',
		});
		gsap.to(this.isHit.rotation, {
			y: this.isHit.rotation.y + (Math.PI * 2),
			duration: 0.8,
			ease: 'power4.out',
			onComplete: () => {
				// 回転終了後の処理
				this.group.attach(this.isHit);
				this.otherStopFrg = false;
				this.resetFrg = true;
			}
		});
	}

	// ズームアウト（スライド切り替え）
	zoomOut() {
		if( !this.zoomInFrg ) return;

		this.resetBgDiv.classList.remove('is-active');

		this.otherStopFrg = true;
		this.isHit.children.forEach(child => {
			if( child.material ) {
				gsap.to(child.material, {
					opacity: 0, // materialに指定しないとダメ
					duration: 0.8,
				});
			}
		});
		gsap.to(this.isHit.position ,{
			// 一時的にsceneに入れたから、座標がsceneになっちゃう、ので x,y,z 全部戻す
			x: this.orgPosition.x,
			y: this.orgPosition.y,
			z: this.orgPosition.z,
			duration: 0.8,
			ease: 'power2.out',
		});
		gsap.to(this.isHit.rotation ,{
			y: this.isHit.rotation.y - (Math.PI * 2),
			duration: 0.8,
			ease: 'power4.out',
			onComplete: () => {
				// 回転終了後の処理
				this.otherStopFrg = false;
			}
		});
		this.nextZoomFrg = true;
	}

	// ズームリセット
	resetZoom() {
		this.cardArray.forEach(card => {
			card.children.forEach(child => {
				if( child.material ) {
					gsap.to(child.material, {
						opacity: 1,
						duration: 0.8,
					});
				}
			});
		});
		this.zoomInFrg = false;
		this.nextZoomFrg = false;
		this.isHit = null;
		this.resetFrg = false;
		this.cursor.classList.remove(this.activeClass);
		this.resetBgDiv.classList.remove('is-active');
		this.resetBgDiv.style.backgroundColor = '';
		this.updateClickCard();
	}

	// カードのクリック判定
	updateClickCard() {
		// 配列の初期化
		this.clickableCards = [];

		// 中心カードのインデックスを見つける
		let centerCard = -1;
		this.cardArray.forEach((card, index) => {
			// ワールド座標を取得（センター位置をとる）
			const world = card.getWorldPosition(new THREE.Vector3());
			const centerPosition = Math.atan2(world.x, world.z);

			// しきい値を設定 真ん中が0に
			if (Math.abs(centerPosition) < 0.01) {
				centerCard = index;
			}
		});
		// インデックスが有効かどうかを確認して配列を作成（円環状に管理するのにモジュロ演算を使う）
		if( centerCard !== -1 ) {
			// 左のカード
			this.clickableCards.push(this.cardArray[(centerCard + 1) % this.cardArray.length]);

			// 中心カード
			this.clickableCards.push(this.cardArray[centerCard]);

			// 右のカード
			this.clickableCards.push(this.cardArray[(centerCard - 1 + this.cardArray.length) % this.cardArray.length]);
		}
	}

	/**
	 * 描画処理
	 */
	render() {
		// ループ設定
		requestAnimationFrame(this.render);

		// コントロールを更新
		// this.controls.update();

		// 一定時間ごとに
		const now = performance.now();
		const deltaTime = now - this.lastTime;

		if( deltaTime >= ThreeApp.INTERVAL && !this.otherStopFrg ) {
			this.nextRotation();
			if( this.zoomInFrg ) {
				this.zoomOut();
			}
			this.lastTime = now;
		}

		// 描画
		this.renderer.render(this.scene, this.camera);
	}
}