// Paints the last-seen background synchronously, before the React bundle loads,
// so a new tab never flashes black while settings hydrate and the photo downloads.
// Kept as a plain external script: MV3's CSP forbids inline scripts.
(function () {
  try {
    var c = JSON.parse(localStorage.getItem('momento:boot') || 'null');
    if (!c || !c.bg) return;
    var dim = Number(c.dim) || 0;
    var el = document.createElement('div');
    el.id = 'boot-bg';
    // Mirrors Background.tsx: .bg-stage is inset -4%, image covers it, dim overlay on top.
    el.style.cssText = 'position:fixed;inset:-4%;z-index:-20;pointer-events:none;background-color:#18181b;' +
      'background-image:linear-gradient(rgba(0,0,0,' + dim + '),rgba(0,0,0,' + dim + '))' +
      (c.kind === 'image' ? ',url("' + c.bg + '")' : ',' + c.bg) +
      ';background-size:cover;background-position:center;background-repeat:no-repeat;';
    document.body.insertBefore(el, document.body.firstChild);
  } catch (e) { /* storage unavailable */ }
})();
