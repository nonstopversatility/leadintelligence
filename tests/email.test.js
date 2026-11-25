// Ligação ao servidor de email: opções por porta e classificação das falhas. Não envia nada.
const test = require('node:test');
const assert = require('node:assert');
const { opcoesTransporte, classificarErro } = require('../routes/services/email.service');

const comPorta = (porta) => { const antes = process.env.SMTP_PORT; process.env.SMTP_PORT = porta; try { return opcoesTransporte(); } finally { if (antes === undefined) delete process.env.SMTP_PORT; else process.env.SMTP_PORT = antes; } };

test('a palavra-passe só segue com TLS, em qualquer porta', () => {
    assert.deepStrictEqual([comPorta('465').secure, comPorta('465').requireTLS], [true, false]);
    for (const p of ['26', '587']) assert.deepStrictEqual([comPorta(p).secure, comPorta(p).requireTLS], [false, true]);
});

test('distingue credenciais, ligação e falha a meio', () => {
    assert.strictEqual(classificarErro({ code: 'EAUTH' }), 'SMTP_AUTH');
    assert.strictEqual(classificarErro({ code: 'ETIMEDOUT', command: 'CONN' }), 'SMTP_REDE');
    assert.strictEqual(classificarErro({ code: 'ETIMEDOUT', command: 'DATA' }), 'SMTP_ENVIO');
});
