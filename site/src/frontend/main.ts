import type { ErrorResponse, SignupRequest, SignupResponse } from "../shared/types.js";

const form = document.getElementById("signup-form") as HTMLFormElement;
const emailInput = document.getElementById("email-input") as HTMLInputElement;
const successMessage = document.getElementById("success-message") as HTMLDivElement;
const errorMessage = document.getElementById("error-message") as HTMLDivElement;
const submitButton = form.querySelector('button[type="submit"]') as HTMLButtonElement;

form.addEventListener("submit", async (e) => {
	e.preventDefault();

	const email = emailInput.value.trim();

	if (!email) {
		showError("Please enter your email address");
		return;
	}

	// Disable form while submitting
	submitButton.disabled = true;
	submitButton.textContent = "Submitting...";

	try {
		const response = await fetch("/api/signup", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ email } satisfies SignupRequest),
		});

		const data = (await response.json()) as SignupResponse | ErrorResponse;

		if (!response.ok) {
			const errorData = data as ErrorResponse;
			showError(errorData.error || "Something went wrong. Please try again.");
			return;
		}

		// Success!
		showSuccess();
	} catch (error) {
		console.error("Signup error:", error);
		showError("Network error. Please check your connection and try again.");
	} finally {
		submitButton.disabled = false;
		submitButton.textContent = "Notify Me";
	}
});

function showSuccess() {
	// Hide the form permanently
	form.style.display = "none";

	// Show success message (don't auto-hide)
	successMessage.classList.add("visible");
	errorMessage.classList.remove("visible");
}

function showError(message: string) {
	errorMessage.textContent = message;
	errorMessage.classList.add("visible");
	successMessage.classList.remove("visible");

	// Hide error message after 5 seconds
	setTimeout(() => {
		errorMessage.classList.remove("visible");
	}, 5000);
}

// Rotating tagline words with fade
const taglineWords = ["automate", "scrape", "research", "transform", "create", "analyze"];
let currentWordIndex = 0;
const wordElement = document.getElementById("tagline-word");

if (wordElement) {
	setInterval(() => {
		wordElement.classList.add("fade-out");
		setTimeout(() => {
			currentWordIndex = (currentWordIndex + 1) % taglineWords.length;
			wordElement.textContent = taglineWords[currentWordIndex];
			wordElement.classList.remove("fade-out");
		}, 300);
	}, 2000);
}

// Rotating CTA words with fade
const ctaWords = ["automate", "scrape", "research", "transform", "create", "analyze"];
let currentCtaWordIndex = 0;
const ctaWordElement = document.getElementById("cta-word");

if (ctaWordElement) {
	setInterval(() => {
		ctaWordElement.classList.add("fade-out");
		setTimeout(() => {
			currentCtaWordIndex = (currentCtaWordIndex + 1) % ctaWords.length;
			ctaWordElement.textContent = ctaWords[currentCtaWordIndex];
			ctaWordElement.classList.remove("fade-out");
		}, 300);
	}, 2000);
}
