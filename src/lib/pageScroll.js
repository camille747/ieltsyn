export function scrollPageToTop() {
  const previousBehavior = document.documentElement.style.scrollBehavior;
  document.documentElement.style.scrollBehavior = "auto";
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
  document.documentElement.style.scrollBehavior = previousBehavior;
}

export function scrollPageToTopAfterRender() {
  scrollPageToTop();
  window.requestAnimationFrame(() => window.requestAnimationFrame(scrollPageToTop));
}

export function scrollElementToTopAfterRender(elementId) {
  const scroll = () => {
    document.getElementById(elementId)?.scrollIntoView({ behavior: "auto", block: "start" });
  };
  window.requestAnimationFrame(() => window.requestAnimationFrame(scroll));
}
