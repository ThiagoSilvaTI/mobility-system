const crypto = require('crypto');

function normalizarCpf(cpf) {
  return String(cpf || '').replace(/\D/g, '');
}

function formatarCpf(cpf) {
  const c = normalizarCpf(cpf);
  if (c.length !== 11) return c;
  return `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}`;
}

function cpfValido(cpf) {
  const c = normalizarCpf(cpf);
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

function hashSenha(senha) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(senha, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verificarSenha(senha, armazenada) {
  try {
    const [salt, hash] = armazenada.split(':');
    if (!salt || !hash) return false;
    const teste = crypto.scryptSync(senha, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(teste, 'hex'));
  } catch {
    return false;
  }
}

function gerarToken() {
  return crypto.randomBytes(32).toString('hex');
}

module.exports = {
  normalizarCpf,
  formatarCpf,
  cpfValido,
  hashSenha,
  verificarSenha,
  gerarToken,
};
