(function () {
  const body = document.body;
  const panel = document.getElementById('a11yPanel');
  const btn = document.getElementById('a11yBtn');
  const fechar = document.getElementById('fecharA11y');

  const opts = {
    altoContraste: document.getElementById('altoContraste'),
    fonteGrande: document.getElementById('fonteGrande'),
    reduzirMovimento: document.getElementById('reduzirMovimento'),
    narracao: document.getElementById('narracao'),
  };

  function loadPrefs() {
    const saved = JSON.parse(localStorage.getItem('mobia11y') || '{}');
    Object.keys(opts).forEach((k) => {
      if (opts[k] && saved[k]) {
        opts[k].checked = true;
        apply(k, true);
      }
    });
  }

  function savePrefs() {
    const o = {};
    Object.keys(opts).forEach((k) => { if (opts[k]) o[k] = opts[k].checked; });
    localStorage.setItem('mobia11y', JSON.stringify(o));
  }

  function apply(key, on) {
    const map = {
      altoContraste: 'alto-contraste',
      fonteGrande: 'fonte-grande',
      reduzirMovimento: 'reduzir-movimento',
      narracao: 'narracao-ativa',
    };
    body.classList.toggle(map[key], on);
  }

  Object.keys(opts).forEach((k) => {
    opts[k]?.addEventListener('change', () => {
      apply(k, opts[k].checked);
      savePrefs();
    });
  });

  btn?.addEventListener('click', () => {
    const open = panel.hidden;
    panel.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
  });
  fechar?.addEventListener('click', () => {
    panel.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !panel.hidden) {
      panel.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
    }
  });

  loadPrefs();
})();
