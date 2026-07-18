(() => {
  const version = "2.9.26";
  window.bookTrack = (name, detail = {}) => {
    const event = { event: name, version, path: window.location.pathname, ...detail };
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(event);
    window.dispatchEvent(new CustomEvent(`book:${name}`, { detail: event }));
  };
  window.bookTrack("page_view");
  document.querySelectorAll("[data-event]").forEach((element) => {
    element.addEventListener("click", () => {
      window.bookTrack(element.dataset.event, { href: element.getAttribute("href") });
    });
  });
})();
