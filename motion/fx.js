// Katana compositor hook: delegates every frame to the ES-module motion graphics renderer in /comp/mg/.
(function () {
  let M = null;
  RRC.hook("init", async ({ R, E }) => {
    M = await import("/comp/mg/main.js?v=" + Date.now());
    await M.init(R, E, RRC.util);
  });
  RRC.hook("afterFrame", async (S, x) => {
    await M.frame(S, x);
  });
})();
