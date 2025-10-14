import { LitElement, html, type TemplateResult } from "lit";
import { customElement } from "lit/decorators.js";
import * as THREE from "three";

@customElement("orb-animation")
export class OrbAnimation extends LitElement {
	private container?: HTMLDivElement;
	private scene?: typeof THREE.Scene;
	private camera?: typeof THREE.PerspectiveCamera;
	private renderer?: typeof THREE.WebGLRenderer;
	private orb?: typeof THREE.Mesh;
	private innerOrb?: typeof THREE.Mesh;
	private outerOrb?: typeof THREE.Mesh;
	private animationFrame?: number;
	private time = 0;

	protected createRenderRoot(): HTMLElement | ShadowRoot {
		// @ts-ignore - Returning this to avoid shadow DOM
		return this;
	}

	override firstUpdated() {
		this.container = this.querySelector(".orb-container") as HTMLDivElement;
		if (!this.container) return;

		this.initThreeJS();
		this.animateOrb();
	}

	override disconnectedCallback() {
		super.disconnectedCallback();
		if (this.animationFrame) {
			cancelAnimationFrame(this.animationFrame);
		}
		if (this.renderer) {
			this.renderer.dispose();
		}
	}

	private initThreeJS() {
		if (!this.container) return;

		// Get theme from localStorage
		const theme = localStorage.getItem("theme") || "dark";
		const isDark = theme === "dark";
		const backgroundColor = getComputedStyle(this.container).getPropertyValue("background-color") || "transparent";

		// Scene setup
		this.scene = new THREE.Scene();
		this.camera = new THREE.PerspectiveCamera(
			75,
			this.container.clientWidth / this.container.clientHeight,
			0.1,
			1000
		);
		this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });

		this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
		this.renderer.setPixelRatio(window.devicePixelRatio);
		this.renderer.setClearColor(0x000000, 0);
		this.renderer.domElement.style.backgroundColor = backgroundColor;
		this.container.appendChild(this.renderer.domElement);

		this.camera.position.z = 4.5;

		// Vertex shader with morphing distortion
		const vertexShader = `
			varying vec3 vNormal;
			varying vec3 vPosition;
			varying vec3 vWorldPosition;
			uniform float time;

			void main() {
				vNormal = normalize(normalMatrix * normal);
				vPosition = position;

				// Intense morphing distortion
				vec3 pos = position;
				float t = time * 0.8;

				// Multiple sine waves creating organic motion
				float distort = sin(pos.x * 2.0 + t) * cos(pos.y * 1.5 + t * 1.3) * 0.15;
				distort += sin(pos.y * 3.0 + t * 1.7) * cos(pos.z * 2.0 + t * 0.9) * 0.12;
				distort += cos(pos.z * 2.5 + t * 1.1) * sin(pos.x * 1.8 + t * 1.5) * 0.1;

				// Swirling motion
				float swirl = sin(length(pos.xy) * 3.0 - t * 2.0) * 0.08;

				pos += normal * (distort + swirl);

				vec4 worldPos = modelMatrix * vec4(pos, 1.0);
				vWorldPosition = worldPos.xyz;

				gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
			}
		`;

		const fragmentShader = `
			varying vec3 vNormal;
			varying vec3 vPosition;
			varying vec3 vWorldPosition;
			uniform float time;
			uniform vec3 color1;
			uniform vec3 color2;
			uniform vec3 color3;

			void main() {
				vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
				float fresnel = pow(1.0 - abs(dot(viewDirection, vNormal)), 3.0);

				// Plasma-like color mixing
				float t = time * 0.5;
				float plasma = sin(vPosition.x * 4.0 + t) +
							  sin(vPosition.y * 3.0 + t * 1.3) +
							  sin((vPosition.x + vPosition.y) * 2.0 + t * 0.7) +
							  cos(length(vPosition.xy) * 5.0 - t * 2.0);
				plasma = plasma * 0.25 + 0.5;

				// Swirling color bands
				float bands = sin(length(vPosition.xy) * 8.0 - t * 3.0 + plasma * 2.0) * 0.5 + 0.5;

				vec3 color = mix(color1, color2, plasma);
				color = mix(color, color3, bands);

				// Lower opacity to prevent white washout, but keep it visible
				float pulse = sin(t * 2.0) * 0.1 + 0.9;
				float opacity = (0.25 + fresnel * 0.45) * pulse;

				// Darken the colors for better visibility on light backgrounds
				float edge = pow(fresnel, 0.8) * 0.8;
				vec3 finalColor = color * (0.5 + edge);

				gl_FragColor = vec4(finalColor, opacity);
			}
		`;

		// Create main orb with theme-aware colors
		const orbGeometry = new THREE.SphereGeometry(1.5, 128, 128);
		const orbMaterial = new THREE.ShaderMaterial({
			vertexShader: vertexShader,
			fragmentShader: fragmentShader,
			uniforms: {
				time: { value: 0 },
				// Brighter colors for light theme, darker for dark theme
				color1: { value: isDark ? new THREE.Color(0xd94f00) : new THREE.Color(0xff8c00) },
				color2: { value: isDark ? new THREE.Color(0xff6b00) : new THREE.Color(0xffa500) },
				color3: { value: isDark ? new THREE.Color(0xd4a500) : new THREE.Color(0xffb700) },
			},
			transparent: true,
			blending: THREE.AdditiveBlending,
			side: THREE.DoubleSide,
			depthWrite: false,
		});

		this.orb = new THREE.Mesh(orbGeometry, orbMaterial);
		this.scene.add(this.orb);

		// Create inner morphing layer
		const innerGeometry = new THREE.SphereGeometry(1.2, 128, 128);
		const innerMaterial = new THREE.ShaderMaterial({
			vertexShader: vertexShader,
			fragmentShader: fragmentShader,
			uniforms: {
				time: { value: 0 },
				color1: { value: isDark ? new THREE.Color(0x2d8b3d) : new THREE.Color(0x4caf50) },
				color2: { value: isDark ? new THREE.Color(0x1565c0) : new THREE.Color(0x2196f3) },
				color3: { value: isDark ? new THREE.Color(0x7b1fa2) : new THREE.Color(0x9c27b0) },
			},
			transparent: true,
			blending: THREE.AdditiveBlending,
			// @ts-expect-error
			side: THREE.BackSide,
			depthWrite: false,
		});

		this.innerOrb = new THREE.Mesh(innerGeometry, innerMaterial);
		this.scene.add(this.innerOrb);

		// Create outer wispy layer
		const outerGeometry = new THREE.SphereGeometry(1.8, 64, 64);
		const outerMaterial = new THREE.ShaderMaterial({
			vertexShader: vertexShader,
			fragmentShader: fragmentShader,
			uniforms: {
				time: { value: 0 },
				color1: { value: isDark ? new THREE.Color(0xc2185b) : new THREE.Color(0xe91e63) },
				color2: { value: isDark ? new THREE.Color(0xd84315) : new THREE.Color(0xff5722) },
				color3: { value: isDark ? new THREE.Color(0x512da8) : new THREE.Color(0x673ab7) },
			},
			transparent: true,
			blending: THREE.AdditiveBlending,
			side: THREE.DoubleSide,
			depthWrite: false,
		});

		this.outerOrb = new THREE.Mesh(outerGeometry, outerMaterial);
		this.scene.add(this.outerOrb);
	}

	private animateOrb = () => {
		if (!this.scene || !this.camera || !this.renderer || !this.orb || !this.innerOrb || !this.outerOrb) {
			return;
		}

		this.time += 0.01;

		// Update shader uniforms with different time speeds
		(this.orb.material as typeof THREE.ShaderMaterial).uniforms.time.value = this.time;
		(this.innerOrb.material as typeof THREE.ShaderMaterial).uniforms.time.value = this.time * 1.5;
		(this.outerOrb.material as typeof THREE.ShaderMaterial).uniforms.time.value = this.time * 0.7;

		// Complex rotating motions for smooshing effect
		this.orb.rotation.y = this.time * 0.3;
		this.orb.rotation.x = Math.sin(this.time * 0.5) * 0.4;
		this.orb.rotation.z = Math.cos(this.time * 0.3) * 0.2;

		// Counter-rotate inner layer
		this.innerOrb.rotation.y = -this.time * 0.4;
		this.innerOrb.rotation.x = Math.cos(this.time * 0.6) * 0.5;
		this.innerOrb.rotation.z = Math.sin(this.time * 0.4) * 0.3;

		// Slow drift for outer layer
		this.outerOrb.rotation.y = this.time * 0.15;
		this.outerOrb.rotation.x = Math.sin(this.time * 0.25) * 0.3;
		this.outerOrb.rotation.z = -Math.cos(this.time * 0.35) * 0.25;

		// Pulsing scale for breathing effect
		const breathe = 1.0 + Math.sin(this.time * 0.8) * 0.05;
		this.orb.scale.set(breathe, breathe, breathe);

		const breathe2 = 1.0 + Math.cos(this.time * 1.1) * 0.07;
		this.innerOrb.scale.set(breathe2, breathe2, breathe2);

		const breathe3 = 1.0 + Math.sin(this.time * 0.6) * 0.08;
		this.outerOrb.scale.set(breathe3, breathe3, breathe3);

		this.renderer.render(this.scene, this.camera);

		this.animationFrame = requestAnimationFrame(this.animateOrb);
	};

	override render(): TemplateResult {
		return html`<div class="orb-container" style="width: 400px; height: 400px; display: block;"></div>`;
	}
}
