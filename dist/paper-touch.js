/* Optional surface feedback. Load after paper.js; no character state is read or changed. */
(() => {
  'use strict';
  window.PaperTouch?.destroy();
  const card = document.querySelector('#paper-card');
  if (!card) return;

  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const controller = new AbortController();
  const options = { signal: controller.signal };
  const originalRotate = card.style.rotate;
  const rest = { x: 34, y: 25, rx: 0, ry: 0, strength: 0.055 };
  let current = { ...rest };
  let target = { ...rest };
  let frame = 0;
  let previousTime = 0;
  let hovering = false;
  let holding = false;
  let lastPointer = null;
  let gradients = [];
  let pressedDrawing = null;

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const inputFocused = () => card.contains(document.activeElement)
    && document.activeElement.matches('input, textarea, select, [contenteditable="true"]');
  const available = () => fine.matches && !reduced.matches && !document.hidden
    && !card.classList.contains('lifted') && !document.querySelector('dialog[open]');
  const locked = () => holding || inputFocused();

  function paint() {
    const x = `${current.x.toFixed(2)}%`;
    const y = `${current.y.toFixed(2)}%`;
    card.style.setProperty('--paper-light-x', x);
    card.style.setProperty('--paper-light-y', y);
    card.style.setProperty('--paper-light-strength', current.strength.toFixed(4));
    // The host places this gradient's fill inside its existing paper mask.
    gradients.forEach(gradient => {
      gradient.setAttribute('cx', x);
      gradient.setAttribute('cy', y);
    });
    const angle = Math.hypot(current.rx, current.ry);
    card.style.rotate = angle < 0.001
      ? '0deg'
      : `${current.rx.toFixed(4)} ${current.ry.toFixed(4)} 0 ${Math.min(0.55, angle).toFixed(4)}deg`;
  }

  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
    previousTime = 0;
  }

  function reset() {
    stop();
    current = { ...rest };
    target = { ...rest };
    paint();
  }

  function step(time) {
    frame = 0;
    if (!available()) { reset(); return; }
    // Keep the entire card still while a slider, field or pointer is engaged.
    if (locked()) { previousTime = 0; return; }
    const dt = previousTime ? Math.min(40, time - previousTime) : 16;
    const blend = 1 - Math.exp(-dt / 105);
    previousTime = time;
    let settled = true;
    Object.keys(current).forEach(key => {
      const difference = target[key] - current[key];
      const tolerance = key === 'strength' ? 0.0001 : 0.002;
      if (Math.abs(difference) > tolerance) settled = false;
      current[key] = Math.abs(difference) <= tolerance
        ? target[key] : current[key] + difference * blend;
    });
    paint();
    if (!settled) frame = requestAnimationFrame(step);
    else previousTime = 0;
  }

  function schedule() {
    if (!frame && available() && !locked()) frame = requestAnimationFrame(step);
  }

  function point(event) {
    if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
    lastPointer = { x: event.clientX, y: event.clientY };
    if (!available() || locked()) return;
    const rect = card.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = clamp((lastPointer.x - rect.left) / rect.width, 0, 1);
    const y = clamp((lastPointer.y - rect.top) / rect.height, 0, 1);
    // Both layers rotate as one object. Maximum combined angle stays below 0.55°.
    target = {
      x: 20 + x * 60,
      y: 14 + y * 66,
      rx: (0.5 - y) * 0.72,
      ry: (x - 0.5) * 0.72,
      strength: 0.067
    };
    schedule();
  }

  function releaseDrawing() {
    pressedDrawing?.removeAttribute('data-paper-pressed');
    pressedDrawing = null;
  }

  function resume() {
    holding = false;
    releaseDrawing();
    if (!available()) { reset(); return; }
    if (locked()) return;
    if (hovering && lastPointer) {
      point({ pointerType: 'mouse', clientX: lastPointer.x, clientY: lastPointer.y });
    } else {
      target = { ...rest };
      schedule();
    }
  }

  function refresh() {
    gradients = [...card.querySelectorAll('[data-paper-light-gradient]')];
    if (!available()) reset();
    else paint();
  }

  card.addEventListener('pointerenter', event => { hovering = true; point(event); }, options);
  card.addEventListener('pointermove', point, { ...options, passive: true });
  card.addEventListener('pointerleave', () => {
    hovering = false;
    target = { ...rest };
    schedule();
  }, options);
  card.addEventListener('pointerdown', event => {
    holding = true;
    stop();
    const button = event.target.closest('button');
    if (button?.matches('.gear-hit')) {
      pressedDrawing = [...card.querySelectorAll('[data-equipment]')]
        .find(drawing => drawing.dataset.equipment === button.dataset.gear);
    } else if (button?.matches('.avatar-hit')) {
      pressedDrawing = card.querySelector('.tiny-portrait');
    }
    pressedDrawing?.setAttribute('data-paper-pressed', '');
  }, options);
  document.addEventListener('pointerup', resume, options);
  document.addEventListener('pointercancel', resume, options);
  document.addEventListener('focusin', () => {
    if (inputFocused()) stop();
    else if (document.querySelector('dialog[open]')) reset();
  }, options);
  document.addEventListener('focusout', () => queueMicrotask(() => {
    if (!holding) resume();
  }), options);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { hovering = false; holding = false; releaseDrawing(); reset(); }
  }, options);
  window.addEventListener('blur', () => {
    hovering = false;
    holding = false;
    releaseDrawing();
    reset();
  }, options);
  fine.addEventListener('change', reset, options);
  reduced.addEventListener('change', reset, options);

  // paper.js replaces card contents when values or variants change.
  const observer = new MutationObserver(refresh);
  observer.observe(card, { childList: true, attributes: true, attributeFilter: ['class'] });
  refresh();
  window.PaperTouch = {
    refresh,
    destroy() {
      stop();
      releaseDrawing();
      observer.disconnect();
      controller.abort();
      card.style.rotate = originalRotate;
      ['--paper-light-x', '--paper-light-y', '--paper-light-strength']
        .forEach(property => card.style.removeProperty(property));
      gradients.forEach(gradient => {
        gradient.setAttribute('cx', '34%');
        gradient.setAttribute('cy', '25%');
      });
      delete window.PaperTouch;
    }
  };
})();
