/** Atualiza a página sem jogar o scroll pro topo. */
export function refreshKeepingScroll(router: { refresh: () => void }) {
  const y = window.scrollY;
  router.refresh();
  requestAnimationFrame(() => window.scrollTo({ top: y }));
  setTimeout(() => window.scrollTo({ top: y }), 50);
  setTimeout(() => window.scrollTo({ top: y }), 150);
  setTimeout(() => window.scrollTo({ top: y }), 300);
}
