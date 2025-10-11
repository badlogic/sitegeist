// Minimal sandbox.js - just listens for sandbox-load and writes the content
window.addEventListener("message", (event) => {
	if (event.data.type === "sandbox-load") {
		console.log(event.data.code);

		// Validate HTML and JavaScript syntax before document.write()
		try {
			// Parse HTML to extract script tags
			const parser = new DOMParser();
			const doc = parser.parseFromString(event.data.code, "text/html");

			// Check for HTML parser errors
			const parserError = doc.querySelector("parsererror");
			if (parserError) {
				throw new Error(`HTML parse error: ${parserError.textContent}`);
			}

			// Validate JavaScript in all script tags (except type="module")
			const scriptTags = Array.from(doc.querySelectorAll("script"));
			for (let i = 0; i < scriptTags.length; i++) {
				const scriptContent = scriptTags[i].textContent || "";
				const scriptType = scriptTags[i].getAttribute("type");

				// Skip validation for module scripts - new Function() can't validate module syntax
				if (scriptType === "module") {
					continue;
				}

				if (scriptContent.trim()) {
					try {
						// Use Function constructor to validate syntax without executing
						new Function(scriptContent);
					} catch (jsError) {
						throw new Error(`JavaScript syntax error in <script> tag ${i + 1}: ${jsError.message}`);
					}
				}
			}
		} catch (validationError) {
			// Send validation error back to parent
			window.parent.postMessage(
				{
					type: "sandbox-error",
					error: validationError.message || String(validationError),
					stack: validationError.stack || "",
				},
				"*"
			);
			return;
		}

		// Write the complete HTML (which includes runtime + user code)
		document.open();
		document.write(event.data.code);
		document.close();
	}
});

// Signal ready to parent
window.parent.postMessage({ type: "sandbox-ready" }, "*");
