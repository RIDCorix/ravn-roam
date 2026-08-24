/* R-301 anchor-driven deck runtime.
 *
 * Deliberately excludes presenter windows, timers, notes overlays, and
 * always-on-top chrome. Speaker notes remain in the HTML for the presenter
 * to read directly; the audience view is controlled by the URL hash #/N.
 */
(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  ready(function () {
    const deck = document.querySelector('.deck');
    if (!deck) return;

    const slides = Array.from(deck.querySelectorAll(':scope > .slide'));
    if (!slides.length) return;

    let current = 0;

    let progress = document.querySelector('.progress-bar');
    if (!progress) {
      progress = document.createElement('div');
      progress.className = 'progress-bar';
      progress.innerHTML = '<span></span>';
      document.body.appendChild(progress);
    }
    const progressFill = progress.querySelector('span');

    function indexFromHash() {
      const match = /^#\/(\d+)$/.exec(location.hash);
      if (!match) return 0;
      return Math.max(0, Math.min(slides.length - 1, Number(match[1]) - 1));
    }

    function show(index, writeHash) {
      const next = Math.max(0, Math.min(slides.length - 1, index));

      slides.forEach(function (slide, slideIndex) {
        slide.classList.toggle('is-active', slideIndex === next);
        slide.classList.toggle('is-prev', slideIndex < next);
      });

      current = next;
      progressFill.style.width = ((next + 1) / slides.length * 100) + '%';

      const activeNumber = slides[next].querySelector('.slide-number');
      if (activeNumber) {
        activeNumber.setAttribute('data-current', String(next + 1));
        activeNumber.setAttribute('data-total', String(slides.length));
      }

      if (writeHash) {
        const target = '#/' + (next + 1);
        if (location.hash !== target) history.replaceState(null, '', target);
      }

      slides[next].querySelectorAll('[data-anim]').forEach(function (element) {
        const name = element.getAttribute('data-anim');
        element.classList.remove('anim-' + name);
        void element.offsetWidth;
        element.classList.add('anim-' + name);
      });
    }

    window.addEventListener('hashchange', function () {
      show(indexFromHash(), false);
    });

    window.addEventListener('keydown', function (event) {
      const tag = document.activeElement && document.activeElement.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (event.key === 'ArrowRight' || event.key === 'PageDown' || event.key === ' ') {
        event.preventDefault();
        show(current + 1, true);
      } else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
        event.preventDefault();
        show(current - 1, true);
      } else if (event.key === 'Home') {
        event.preventDefault();
        show(0, true);
      } else if (event.key === 'End') {
        event.preventDefault();
        show(slides.length - 1, true);
      } else if (event.key === 'f' || event.key === 'F') {
        event.preventDefault();
        if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(function () {});
        else document.exitFullscreen().catch(function () {});
      }
    });

    show(indexFromHash(), true);
  });
})();
