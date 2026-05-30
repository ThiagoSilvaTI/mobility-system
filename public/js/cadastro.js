(function () {
  const cpfInput = document.getElementById('cpf');
  const senhaInput = document.getElementById('senha');
  const senha2Input = document.getElementById('senha2');
  const telefoneInput = document.getElementById('telefone');
  const form = document.getElementById('formCadastro');
  const btn = document.getElementById('btnCadastro');

  function mascararTelefone(v) {
    const d = v.replace(/\D/g, '').slice(0, 11);
    if (d.length <= 2) return d.length ? `(${d}` : '';
    if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }

  function validarCpfDigitos(cpf) {
    const c = cpf.replace(/\D/g, '');
    if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
    let soma = 0;
    for (let i = 0; i < 9; i++) soma += parseInt(c[i], 10) * (10 - i);
    let resto = (soma * 10) % 11;
    if (resto === 10) resto = 0;
    if (resto !== parseInt(c[9], 10)) return false;
    soma = 0;
    for (let i = 0; i < 10; i++) soma += parseInt(c[i], 10) * (11 - i);
    resto = (soma * 10) % 11;
    if (resto === 10) resto = 0;
    return resto === parseInt(c[10], 10);
  }

  function atualizarCpfStatus() {
    const el = document.getElementById('cpfStatus');
    const field = document.querySelector('[data-field="cpf"]');
    const raw = cpfInput.value.replace(/\D/g, '');
    field?.classList.remove('field--ok', 'field--erro');
    if (raw.length === 0) {
      el.textContent = '';
      el.className = 'field__status';
      return;
    }
    if (raw.length < 11) {
      el.textContent = 'Complete o CPF';
      el.className = 'field__status field__status--pendente';
      return;
    }
    if (validarCpfDigitos(raw)) {
      el.textContent = '✓ CPF válido';
      el.className = 'field__status field__status--ok';
      field?.classList.add('field--ok');
    } else {
      el.textContent = '✗ CPF inválido';
      el.className = 'field__status field__status--erro';
      field?.classList.add('field--erro');
    }
  }

  function forcaSenha(s) {
    if (!s) return { nivel: 0, texto: 'Digite uma senha' };
    let score = 0;
    if (s.length >= 6) score++;
    if (s.length >= 10) score++;
    if (/[A-Z]/.test(s) && /[a-z]/.test(s)) score++;
    if (/\d/.test(s)) score++;
    if (/[^A-Za-z0-9]/.test(s)) score++;
    const niveis = [
      { nivel: 0, texto: 'Digite uma senha', cor: '#ccc' },
      { nivel: 1, texto: 'Fraca', cor: '#e74c3c' },
      { nivel: 2, texto: 'Razoável', cor: '#f39c12' },
      { nivel: 3, texto: 'Boa', cor: '#1a8f6a' },
      { nivel: 4, texto: 'Forte', cor: '#0d4f3c' },
    ];
    const idx = Math.min(score, 4);
    return niveis[idx];
  }

  function atualizarForcaSenha() {
    const f = forcaSenha(senhaInput.value);
    const barra = document.getElementById('forcaBarra');
    const texto = document.getElementById('forcaTexto');
    if (barra) {
      barra.style.width = `${(f.nivel / 4) * 100}%`;
      barra.style.background = f.cor;
    }
    if (texto) texto.textContent = f.texto;
  }

  function atualizarMatchSenha() {
    const el = document.getElementById('senhaMatchStatus');
    const field = document.querySelector('[data-field="senha2"]');
    field?.classList.remove('field--ok', 'field--erro');
    if (!senha2Input.value) {
      el.textContent = '';
      return;
    }
    if (senhaInput.value === senha2Input.value) {
      el.textContent = '✓ Senhas coincidem';
      el.className = 'field__status field__status--ok';
      field?.classList.add('field--ok');
    } else {
      el.textContent = '✗ Senhas diferentes';
      el.className = 'field__status field__status--erro';
      field?.classList.add('field--erro');
    }
  }

  function atualizarSteps() {
    const nomeOk = document.getElementById('nome').value.trim().length >= 3;
    const cpfOk = validarCpfDigitos(cpfInput.value);
    const senhaOk = senhaInput.value.length >= 6 && senhaInput.value === senha2Input.value;
    const telOk = telefoneInput.value.length > 0 || document.getElementById('email').value.length > 0;

    document.querySelectorAll('.cadastro-step').forEach((s) => s.classList.remove('cadastro-step--ativo', 'cadastro-step--done'));
    const s1 = document.querySelector('.cadastro-step[data-step="1"]');
    const s2 = document.querySelector('.cadastro-step[data-step="2"]');
    const s3 = document.querySelector('.cadastro-step[data-step="3"]');

    if (nomeOk && cpfOk) {
      s1?.classList.add('cadastro-step--done');
      s2?.classList.add('cadastro-step--ativo');
      if (senhaOk) {
        s2?.classList.remove('cadastro-step--ativo');
        s2?.classList.add('cadastro-step--done');
        s3?.classList.add('cadastro-step--ativo');
        if (telOk) s3?.classList.add('cadastro-step--done');
      }
    } else {
      s1?.classList.add('cadastro-step--ativo');
    }
  }

  document.querySelectorAll('.field__toggle-senha').forEach((btnToggle) => {
    btnToggle.addEventListener('click', () => {
      const input = document.getElementById(btnToggle.dataset.target);
      const visivel = input.type === 'text';
      input.type = visivel ? 'password' : 'text';
      btnToggle.setAttribute('aria-label', visivel ? 'Mostrar senha' : 'Ocultar senha');
      btnToggle.textContent = visivel ? '👁' : '🙈';
    });
  });

  cpfInput?.addEventListener('input', () => {
    cpfInput.value = mascararCpf(cpfInput.value);
    atualizarCpfStatus();
    atualizarSteps();
  });

  telefoneInput?.addEventListener('input', () => {
    telefoneInput.value = mascararTelefone(telefoneInput.value);
    atualizarSteps();
  });

  senhaInput?.addEventListener('input', () => {
    atualizarForcaSenha();
    atualizarMatchSenha();
    atualizarSteps();
  });

  senha2Input?.addEventListener('input', () => {
    atualizarMatchSenha();
    atualizarSteps();
  });

  document.getElementById('nome')?.addEventListener('input', atualizarSteps);
  document.getElementById('email')?.addEventListener('input', atualizarSteps);

  function setLoading(on) {
    btn.disabled = on;
    btn.querySelector('.btn__texto').hidden = on;
    btn.querySelector('.btn__loading').hidden = !on;
  }

  function mostrarErro(id, texto) {
    const el = document.getElementById(id);
    if (el) el.textContent = texto;
    const field = el?.closest('.field');
    field?.classList.add('field--erro');
  }

  function limparErros() {
    document.querySelectorAll('.field__erro').forEach((e) => (e.textContent = ''));
    document.querySelectorAll('.field--erro').forEach((f) => f.classList.remove('field--erro'));
  }

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    limparErros();
    const msg = document.getElementById('msgCadastro');
    msg.hidden = true;

    const nome = document.getElementById('nome').value.trim();
    if (nome.length < 3) {
      mostrarErro('erroNome', 'Informe o nome completo');
      document.getElementById('nome').focus();
      return;
    }

    if (!validarCpfDigitos(cpfInput.value)) {
      mostrarErro('erroCpf', 'CPF inválido. Verifique os números.');
      cpfInput.focus();
      return;
    }

    const senha = senhaInput.value;
    const senha2 = senha2Input.value;
    if (senha.length < 6) {
      senhaInput.focus();
      return;
    }
    if (senha !== senha2) {
      mostrarErro('erroSenha2', 'As senhas não coincidem');
      senha2Input.focus();
      return;
    }

    if (!document.getElementById('aceiteTermos').checked) {
      msg.textContent = 'Aceite os termos para continuar';
      msg.className = 'auth-msg auth-msg--erro';
      msg.hidden = false;
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome,
          cpf: cpfInput.value,
          telefone: telefoneInput.value,
          email: document.getElementById('email').value,
          senha,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        msg.textContent = data.erro || 'Erro no cadastro';
        msg.className = 'auth-msg auth-msg--erro';
        msg.hidden = false;
        setLoading(false);
        return;
      }
      msg.textContent = 'Conta criada! Redirecionando…';
      msg.className = 'auth-msg auth-msg--ok';
      msg.hidden = false;
      salvarSessao(data.token, data.cidadao);
      setTimeout(() => { window.location.href = '/'; }, 600);
    } catch {
      msg.textContent = 'Erro de conexão. Tente novamente.';
      msg.className = 'auth-msg auth-msg--erro';
      msg.hidden = false;
      setLoading(false);
    }
  });

  atualizarForcaSenha();
})();
