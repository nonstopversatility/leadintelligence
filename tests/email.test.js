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

const email = require('../routes/services/email.service');

const comAmbiente = async (valores, fn) => {
    const antes = { ...process.env };
    Object.assign(process.env, { SMTP_USER: 'info@exemplo.test', SMTP_PASS: 'x', IMAP_HOST: 'mail.exemplo.test', SMTP_TESTE: '', EMAIL_COPIA_ENVIADOS: '' }, valores);
    try { return await fn(); } finally { process.env = antes; }
};
const caixaFalsa = (gravadas, pastas = [{ path: 'INBOX' }, { path: 'INBOX.Sent', specialUse: '\\Sent' }]) => () => ({
    connect: async () => {}, list: async () => pastas, logout: async () => {},
    append: async (pasta, original, marcas) => { gravadas.push({ pasta, original: String(original), marcas }); }
});
const mensagem = () => ({ ...email.montarMensagem({ para: 'cliente@exemplo.test', assunto: 'Teste', corpo: 'Olá' }), messageId: '<abc@exemplo.test>', date: new Date() });

test('a cópia vai para Enviados, lida, com o mesmo identificador', () => comAmbiente({}, async () => {
    const gravadas = [];
    assert.strictEqual(await email.guardarCopia(mensagem(), { ligar: caixaFalsa(gravadas) }), true);
    assert.deepStrictEqual([gravadas[0].pasta, gravadas[0].marcas], ['INBOX.Sent', ['\\Seen']]);
    assert.match(gravadas[0].original, /Message-ID: <abc@exemplo\.test>/);
    assert.match(gravadas[0].original, /To: cliente@exemplo\.test/);
}));

test('se a cópia falhar, não há erro; no Gmail não se duplica', async () => {
    await comAmbiente({}, async () => assert.strictEqual(await email.guardarCopia(mensagem(), { ligar: caixaFalsa([], [{ path: 'INBOX' }]) }), false));
    await comAmbiente({ IMAP_HOST: 'imap.gmail.com' }, async () => assert.strictEqual(await email.guardarCopia(mensagem(), { ligar: caixaFalsa([]) }), null));
});

test('o email sai sem «Responder para»: as respostas vão para a caixa de envio', () => {
    assert.strictEqual(mensagem().replyTo, undefined);
});
