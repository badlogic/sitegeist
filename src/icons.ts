import { Button, icon } from "@mariozechner/mini-lit";
import { html, render } from "lit";
import { ArrowLeft, Download } from "lucide";
import "./components/OrbAnimation.js";

interface IconSize {
	size: number;
	name: string;
}

const ICON_SIZES: IconSize[] = [
	{ size: 16, name: "icon-16.png" },
	{ size: 48, name: "icon-48.png" },
	{ size: 128, name: "icon-128.png" },
];

function captureOrbAsImage(size: number): Promise<Blob> {
	return new Promise((resolve, reject) => {
		// Create a temporary container
		const container = document.createElement("div");
		container.style.position = "fixed";
		container.style.left = "-9999px";
		container.style.width = `${size * 2}px`; // Render at 2x for better quality
		container.style.height = `${size * 2}px`;
		document.body.appendChild(container);

		// Create orb animation element
		const orb = document.createElement("orb-animation");
		container.appendChild(orb);

		// Wait for orb to initialize and render a few frames
		setTimeout(() => {
			try {
				// Get the canvas element from the orb
				const canvas = container.querySelector("canvas");
				if (!canvas) {
					throw new Error("Canvas not found in orb animation");
				}

				// Create a new canvas at the target size
				const outputCanvas = document.createElement("canvas");
				outputCanvas.width = size;
				outputCanvas.height = size;
				const ctx = outputCanvas.getContext("2d");

				if (!ctx) {
					throw new Error("Failed to get 2D context");
				}

				// Crop to center 60% of the orb canvas (the orb is small in the 400x400 space)
				// Then scale up to fill the icon
				const cropSize = canvas.width * 0.6; // Take center 60%
				const cropOffset = (canvas.width - cropSize) / 2;

				// Draw cropped and scaled orb
				ctx.drawImage(
					canvas,
					cropOffset, cropOffset, cropSize, cropSize, // Source: center crop
					0, 0, size, size // Destination: full icon size
				);

				// Convert to blob
				outputCanvas.toBlob(
					(blob) => {
						// Cleanup
						document.body.removeChild(container);

						if (blob) {
							resolve(blob);
						} else {
							reject(new Error("Failed to create blob from canvas"));
						}
					},
					"image/png",
					1.0,
				);
			} catch (error) {
				document.body.removeChild(container);
				reject(error);
			}
		}, 500); // Wait 500ms for animation to start
	});
}

function downloadBlob(blob: Blob, filename: string) {
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}

async function generateIcon(iconSize: IconSize) {
	const statusEl = document.getElementById(`status-${iconSize.size}`);
	const downloadBtnWrapper = document.getElementById(`download-${iconSize.size}`);
	const downloadBtn = downloadBtnWrapper?.querySelector("button");
	const previewEl = document.getElementById(`preview-${iconSize.size}`);

	if (statusEl) statusEl.textContent = "Generating...";
	if (downloadBtn) downloadBtn.disabled = true;
	if (previewEl) previewEl.innerHTML = "";

	try {
		const blob = await captureOrbAsImage(iconSize.size);

		// Show preview - scale to fit 64x64 container while maintaining aspect ratio
		if (previewEl) {
			const img = document.createElement("img");
			img.src = URL.createObjectURL(blob);
			img.style.maxWidth = "100%";
			img.style.maxHeight = "100%";
			img.style.width = "auto";
			img.style.height = "auto";
			img.style.objectFit = "contain";
			img.style.imageRendering = "pixelated"; // Keep sharp edges for small icons
			previewEl.appendChild(img);
		}

		if (statusEl) statusEl.textContent = "✓ Ready";
		if (downloadBtn) {
			downloadBtn.disabled = false;
			downloadBtn.onclick = () => downloadBlob(blob, iconSize.name);
		}
	} catch (error) {
		console.error(`Failed to generate ${iconSize.name}:`, error);
		if (statusEl) statusEl.textContent = `✗ Error: ${error}`;
		if (downloadBtn) downloadBtn.disabled = true;
		if (previewEl) previewEl.innerHTML = "";
	}
}

async function generateAllIcons() {
	const generateAllBtnWrapper = document.getElementById("generate-all-btn");
	const generateAllBtn = generateAllBtnWrapper?.querySelector("button");
	if (generateAllBtn) generateAllBtn.disabled = true;

	for (const iconSize of ICON_SIZES) {
		await generateIcon(iconSize);
	}

	if (generateAllBtn) generateAllBtn.disabled = false;
}

function createPreviewOrb() {
	const previewContainer = document.getElementById("orb-preview");
	if (!previewContainer) return;

	// Clear existing orb
	previewContainer.innerHTML = "";

	// Create new orb
	const orb = document.createElement("orb-animation");
	previewContainer.appendChild(orb);
}

function renderIconsPage() {
	const container = document.getElementById("app");
	if (!container) return;

	const template = html`
		<div class="min-h-screen bg-background text-foreground p-6">
			<!-- Header -->
			<div class="max-w-4xl mx-auto">
				<div class="flex items-center gap-4 mb-8">
					${Button({
						variant: "ghost",
						size: "sm",
						children: html`<span class="flex items-center gap-2">${icon(ArrowLeft, "sm")} <span>Back to Debug</span></span>`,
						onClick: () => {window.location.href = "/debug.html"},
					})}
					<h1 class="text-3xl font-bold">Icon Generator</h1>
				</div>

				<!-- Instructions -->
				<div class="bg-card border border-border rounded-lg p-6 mb-8">
					<h2 class="text-xl font-semibold mb-3">Instructions</h2>
					<ol class="list-decimal list-inside space-y-2 text-muted-foreground">
						<li>Preview the orb animation below</li>
						<li>Click "Generate All Icons" or generate individual sizes</li>
						<li>Download each icon using the download buttons</li>
						<li>Replace the icon files in the <code class="px-1.5 py-0.5 bg-secondary rounded text-xs">static/</code> directory</li>
					</ol>
				</div>

				<!-- Preview Section -->
				<div class="bg-card border border-border rounded-lg p-6 mb-8">
					<h2 class="text-xl font-semibold mb-4">Preview</h2>
					<div class="flex justify-center">
						<div id="orb-preview" class="relative" style="width: 400px; height: 400px;"></div>
					</div>
				</div>

				<!-- Icon Generation Section -->
				<div class="bg-card border border-border rounded-lg p-6">
					<div class="flex items-center justify-between mb-4">
						<h2 class="text-xl font-semibold">Generate Icons</h2>
						<div id="generate-all-btn">
							${Button({
								children: html`<span class="flex items-center gap-2">${icon(Download, "sm")} <span>Generate All Icons</span></span>`,
								onClick: generateAllIcons,
							})}
						</div>
					</div>

					<div class="space-y-4">
						${ICON_SIZES.map(
							(iconSize) => html`
								<div class="flex items-center justify-between p-4 bg-secondary rounded-lg">
									<div class="flex items-center gap-4">
										<div id="preview-${iconSize.size}" class="w-16 h-16 bg-background rounded border border-border flex items-center justify-center">
											<span class="text-xs text-muted-foreground">${iconSize.size}×${iconSize.size}</span>
										</div>
										<div>
											<div class="font-medium">${iconSize.name}</div>
											<div id="status-${iconSize.size}" class="text-sm text-muted-foreground">Not generated</div>
										</div>
									</div>
									<div class="flex items-center gap-2">
										${Button({
											size: "sm",
											variant: "outline",
											children: "Generate",
											onClick: () => generateIcon(iconSize),
										})}
										<div id="download-${iconSize.size}">
											${Button({
												size: "sm",
												disabled: true,
												children: html`<span class="flex items-center gap-2">${icon(Download, "sm")} <span>Download</span></span>`,
												onClick: () => {}, // Will be replaced dynamically
											})}
										</div>
									</div>
								</div>
							`,
						)}
					</div>
				</div>
			</div>
		</div>
	`;

	render(template, container);

	// Create the preview orb after rendering
	requestAnimationFrame(() => {
		createPreviewOrb();
	});
}

// Initialize
renderIconsPage();
