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

// FAQ accordion functionality
document.addEventListener("DOMContentLoaded", () => {
	const faqToggles = document.querySelectorAll(".faq-toggle");

	faqToggles.forEach((toggle) => {
		toggle.addEventListener("click", () => {
			const content = toggle.nextElementSibling as HTMLElement;
			const chevron = toggle.querySelector(".faq-chevron") as SVGElement;
			const isOpen = content.style.maxHeight && content.style.maxHeight !== "0px";

			if (isOpen) {
				content.style.maxHeight = "0px";
				chevron.style.transform = "rotate(0deg)";
			} else {
				content.style.maxHeight = `${content.scrollHeight}px`;
				chevron.style.transform = "rotate(180deg)";
			}
		});
	});
});
