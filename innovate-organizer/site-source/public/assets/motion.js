"use strict";

// Progressive enhancement: content remains visible without JavaScript or motion support.
(() => {
  const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (preference.matches || !("IntersectionObserver" in window)) return;

  const elements = Array.from(document.querySelectorAll(
    ".section-head, .service-card, .benefit-card, .project-card, .partner-card, .process-grid > li, .form-panel"
  ));
  const reveal = element => element.classList.remove("io-reveal-pending");
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      reveal(entry.target);
      observer.unobserve(entry.target);
    });
  }, { threshold: 0, rootMargin: "0px 0px -32px 0px" });

  elements.forEach(element => {
    // Never delay above-the-fold content or the hero's text/LCP.
    if (element.getBoundingClientRect().top < window.innerHeight - 32) return;
    element.classList.add("io-reveal", "io-reveal-pending");
    observer.observe(element);
  });

  document.addEventListener("focusin", event => {
    const element = event.target.closest?.(".io-reveal-pending");
    if (element) {
      reveal(element);
      observer.unobserve(element);
    }
  });

  const release = () => {
    observer.disconnect();
    elements.forEach(reveal);
  };
  preference.addEventListener("change", event => {
    if (event.matches) release();
  });
  window.addEventListener("beforeprint", release);
})();
