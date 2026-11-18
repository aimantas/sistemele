// Progressive enhancement only. Every section reads and works without this file.
(() => {
  const labels = document.documentElement.lang === 'lt'
    ? { copy: 'Kopijuoti', copied: 'Nukopijuota', failed: 'Nepavyko nukopijuoti' }
    : { copy: 'Copy', copied: 'Copied', failed: 'Copy failed' };

  // Replace a built product sample with a real screenshot: hallmarkSlots({ hero: '/shots/dashboard.png' })
  window.hallmarkSlots = (map) => {
    for (const [name, value] of Object.entries(map)) {
      const slot = document.querySelector(`[data-slot="${name}"]`);
      if (!slot) continue;
      const img = new Image();
      img.src = typeof value === 'string' ? value : value.src;
      img.alt = (typeof value === 'object' && value.alt) || slot.dataset.alt || '';
      slot.querySelectorAll(':scope > img').forEach((old) => old.remove());
      slot.prepend(img);
    }
  };
  document.querySelectorAll('[data-slot] img').forEach((img) => {
    if (img.complete && !img.naturalWidth) img.remove();
    else img.addEventListener('error', () => img.remove(), { once: true });
  });

  // The four-module run: light the record that matches the step in view.
  const chain = document.querySelector('[data-chain]');
  const steps = document.querySelectorAll('[data-steps] > li');
  const wide = window.matchMedia('(min-width: 60.01rem)');
  if (chain && steps.length && 'IntersectionObserver' in window) {
    const setStep = (index) => {
      if (!wide.matches) { chain.removeAttribute('data-step'); steps.forEach((s) => s.classList.remove('is-current')); return; }
      chain.dataset.step = String(index + 1);
      steps.forEach((s, i) => s.classList.toggle('is-current', i === index));
    };
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => { if (entry.isIntersecting) setStep([...steps].indexOf(entry.target)); });
    }, { rootMargin: '-40% 0px -50% 0px' });
    steps.forEach((step) => io.observe(step));
    wide.addEventListener('change', () => { if (!wide.matches) setStep(0); });
  }

  // Copy buttons on command blocks.
  if (navigator.clipboard) {
    document.querySelectorAll('[data-copy]').forEach((figure) => {
      const pre = figure.querySelector('pre');
      if (!pre) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'copy';
      button.textContent = labels.copy;
      const status = document.createElement('span');
      status.className = 'visually-hidden';
      status.setAttribute('role', 'status');
      figure.append(button, status);
      let timer;
      button.addEventListener('click', async () => {
        const text = [...pre.querySelectorAll('.prompt')].map((line) => line.textContent.trim()).join('\n');
        button.disabled = true;
        try {
          await navigator.clipboard.writeText(text);
          button.textContent = labels.copied;
        } catch {
          button.textContent = labels.failed;
        }
        status.textContent = button.textContent;
        button.disabled = false;
        clearTimeout(timer);
        timer = setTimeout(() => { button.textContent = labels.copy; status.textContent = ''; }, 2000);
      });
    });
  }

  // Close the small-screen menu after a jump link.
  document.querySelectorAll('.nav__menu a').forEach((link) => {
    link.addEventListener('click', () => link.closest('details')?.removeAttribute('open'));
  });
})();
