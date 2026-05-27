// functions/s/_themes/wave404.ts
// 音波テーマ 404 — 「404」 の各文字が常時 sin 波で揺れ、 マウスに近いほど振幅が増す。
// AllMarks default theme (= 黒 + 緑 + 等幅 + 音波 motif) の延長として 404 も体験になる。
import type { Theme404Variant } from '../_template'

const BODY_HTML = `
<div class="al-container">
  <a href="/board" class="al-logo" aria-label="AllMarks home">
    <svg viewBox="0 0 32 32" width="22" height="22" aria-hidden="true">
      <path d="M6 26 L16 4 L26 26 M11 18 L21 18" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="square" stroke-linejoin="miter"/>
    </svg>
  </a>
  <div class="al-stage" role="img" aria-label="404 — share not found">
    <span class="al-d" data-i="0">4</span>
    <span class="al-d" data-i="1">0</span>
    <span class="al-d" data-i="2">4</span>
  </div>
  <p class="al-status">THIS SHARE HAS EXPIRED OR NEVER EXISTED</p>
  <p class="al-hint">Share links live for 30 days.</p>
  <a class="al-cta" href="/board">&rarr; MAKE YOUR OWN. SHARE IT.</a>
</div>
`.trim()

const INLINE_CSS = `
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; height: 100%; background: #000; color: #fff; font-family: 'Geist Mono', ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace; overflow: hidden; }
.al-container { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; padding: 32px; gap: 28px; }
.al-logo { position: fixed; top: 22px; left: 22px; opacity: 0.78; transition: opacity 0.25s ease; }
.al-logo:hover { opacity: 1; }
.al-stage { display: flex; gap: clamp(8px, 1.6vw, 28px); font-size: clamp(120px, 22vw, 280px); line-height: 1; font-weight: 400; letter-spacing: -0.04em; user-select: none; cursor: none; }
.al-d {
  color: #28F100;
  text-shadow: 0 0 24px rgba(40, 241, 0, 0.32), 0 0 64px rgba(40, 241, 0, 0.14);
  will-change: transform, text-shadow;
  transform: translateY(0);
  display: inline-block;
}
.al-status { font-size: 12px; letter-spacing: 0.22em; opacity: 0.88; margin: 0; text-align: center; }
.al-hint { font-size: 11px; letter-spacing: 0.14em; opacity: 0.42; margin: 0; text-align: center; }
.al-cta {
  display: inline-block; margin-top: 6px; font-size: 12px; letter-spacing: 0.18em;
  color: #28F100; text-decoration: none; padding: 12px 22px;
  border: 1px solid rgba(40, 241, 0, 0.38);
  transition: border-color 0.25s, background 0.25s, box-shadow 0.25s;
}
.al-cta:hover { border-color: #28F100; background: rgba(40, 241, 0, 0.08); box-shadow: 0 0 24px rgba(40, 241, 0, 0.2); }
@media (prefers-reduced-motion: reduce) {
  .al-d { transform: none !important; }
}
`.trim()

const INLINE_SCRIPT = `
(function(){
  var prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) return;
  var digits = document.querySelectorAll('.al-d');
  if (!digits.length) return;
  var state = { mx: -9999, my: -9999, t: 0, hasMouse: false };
  window.addEventListener('mousemove', function(e){ state.mx = e.clientX; state.my = e.clientY; state.hasMouse = true; }, { passive: true });
  window.addEventListener('mouseout', function(e){ if (!e.relatedTarget) state.hasMouse = false; }, { passive: true });
  function tick(){
    state.t += 0.0145;
    for (var i = 0; i < digits.length; i++) {
      var d = digits[i];
      var phase = state.t * 1.6 + i * 1.15;
      var baseAmp = 14;
      var glowBase = 0.32;
      if (state.hasMouse) {
        var r = d.getBoundingClientRect();
        var cx = r.left + r.width / 2;
        var cy = r.top + r.height / 2;
        var dx = state.mx - cx;
        var dy = state.my - cy;
        var dist = Math.sqrt(dx*dx + dy*dy);
        var prox = Math.max(0, 1 - dist / 280);
        baseAmp = 14 + prox * 58;
        glowBase = 0.32 + prox * 0.5;
      }
      var y = Math.sin(phase) * baseAmp;
      var glow = glowBase + Math.sin(state.t * 2.4 + i) * 0.08;
      d.style.transform = 'translateY(' + y.toFixed(2) + 'px)';
      d.style.textShadow = '0 0 ' + (24 + glow * 36).toFixed(1) + 'px rgba(40, 241, 0, ' + glow.toFixed(3) + '), 0 0 80px rgba(40, 241, 0, ' + (glow * 0.4).toFixed(3) + ')';
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
`.trim()

export const wave404: Theme404Variant = {
  name: 'wave',
  bodyHTML: BODY_HTML,
  inlineCSS: INLINE_CSS,
  inlineScript: INLINE_SCRIPT,
}
