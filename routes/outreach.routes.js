const express = require('express');
const { exigirLogin, exigirPapel } = require('../middleware/auth.middleware');
const outreach = require('./services/outreach.service');
const linkedin = require('./services/linkedin.service');
const emailReplies = require('./services/email-replies.service');

const { traduzir, guardarIdioma } = require('./services/messages.service');
const router = express.Router();
router.use(guardarIdioma);
router.use(exigirLogin);

// Traduz os erros do serviço em respostas HTTP. Os detalhes técnicos ficam no servidor, nunca vão para o browser.
function responderErro(res, erro) {
    const estados = { NAO_ENCONTRADA: 404, DESTINATARIO: 400, VAZIO: 400, INVALIDO: 400, LONGO: 400, BLOQUEADO: 409, LIMITE: 429, SMTP: 503, CONFIG: 503 };
    if (estados[erro.codigo]) return res.status(estados[erro.codigo]).json({ erro: traduzir(erro.message, res.locals.idioma), codigo: erro.codigo, bloqueios: erro.bloqueios });
    console.error('Erro na central de contacto:', erro.message);
    const ia = /credit balance|api[_ ]key|anthropic|overloaded|rate/i.test(erro.message);
    res.status(ia ? 502 : 500).json({ erro: traduzir(ia ? 'O serviço de IA não está disponível neste momento.' : 'Não foi possível concluir a operação.', res.locals.idioma), codigo: ia ? 'IA' : 'ERRO' });
}

// PUT /api/outreach/assinatura   corpo: { html }
// Guarda a assinatura de email de quem tem sessão iniciada (HTML limpo no servidor; vazio = assinatura por defeito).
router.put('/assinatura', exigirPapel('admin', 'comercial'), async (req, res) => {
    try { res.json(await outreach.guardarAssinatura(req.utilizador.id, (req.body || {}).html)); }
    catch (erro) { responderErro(res, erro); }
});

// GET /api/outreach/email/respostas: a leitura das respostas por email está ligada? quando foi a última verificação?
router.get('/email/respostas', (req, res) => res.json(emailReplies.estado()));

// POST /api/outreach/email/respostas/verificar: vê a caixa agora (também corre sozinha de 3 em 3 minutos)
router.post('/email/respostas/verificar', exigirPapel('admin', 'comercial'), async (req, res) => {
    try { res.json(await emailReplies.verificar()); } catch (erro) { responderErro(res, erro); }
});

// GET /api/outreach/empresas/:id/email
// O que a janela de email mostra: destinatários com email publicado, regras e bloqueios, histórico e se o envio direto está ligado.
router.get('/empresas/:id/email', async (req, res) => {
    try {
        const estado = await outreach.estadoEmail(req.params.id, req.utilizador);
        if (!estado) return res.status(404).json({ erro: 'Empresa não encontrada.', codigo: 'NAO_ENCONTRADA' });
        res.json(estado);
    } catch (erro) { responderErro(res, erro); }
});

// POST /api/outreach/empresas/:id/email/rascunho   corpo: { destinatario, idioma }
// A IA escreve o rascunho a partir da análise do lead. Não envia nada nem regista nada.
router.post('/empresas/:id/email/rascunho', exigirPapel('admin', 'comercial'), async (req, res) => {
    try {
        const { destinatario, idioma } = req.body || {};
        res.json(await outreach.gerarRascunho(req.params.id, { destinatarioId: destinatario, idioma }, req.utilizador));
    } catch (erro) { responderErro(res, erro); }
});

// Os dados que o browser envia na mensagem final (o endereço de email NUNCA vem do browser: é lido da base de dados)
const dadosMensagem = (b = {}) => ({
    destinatarioId: b.destinatario, assunto: b.assunto, corpo: b.corpo, html: b.html, idioma: b.idioma,
    geradoPorIa: !!b.ia?.gerado, modelo: b.ia?.modelo, metodo: b.metodo
});

// POST /api/outreach/empresas/:id/email/registar
// O utilizador enviou a mensagem fora da plataforma (no seu email, no webmail ou copiando): regista a interação,
// passa o lead a "contactado" e agenda o follow-up.
router.post('/empresas/:id/email/registar', exigirPapel('admin', 'comercial'), async (req, res) => {
    try { res.status(201).json(await outreach.registarContacto(req.params.id, dadosMensagem(req.body), req.utilizador)); }
    catch (erro) { responderErro(res, erro); }
});

// POST /api/outreach/empresas/:id/email/enviar
// Envia a partir da plataforma (só se o SMTP estiver configurado) e regista.
router.post('/empresas/:id/email/enviar', exigirPapel('admin', 'comercial'), async (req, res) => {
    try { res.status(201).json(await outreach.enviarEmail(req.params.id, dadosMensagem(req.body), req.utilizador)); }
    catch (erro) { responderErro(res, erro); }
});

// ---------- canal LinkedIn ----------
// O LinkedIn não tem envio automático (nem se deve fazer): a plataforma escreve o texto e regista o que o utilizador enviou.

// GET /api/outreach/empresas/:id/linkedin: destinatários (perfis guardados), regras, passos possíveis e histórico
router.get('/empresas/:id/linkedin', async (req, res) => {
    try {
        const estado = await linkedin.estadoLinkedin(req.params.id, req.utilizador);
        if (!estado) return res.status(404).json({ erro: 'Empresa não encontrada.', codigo: 'NAO_ENCONTRADA' });
        res.json(estado);
    } catch (erro) { responderErro(res, erro); }
});

// POST /api/outreach/empresas/:id/linkedin/rascunho   corpo: { destinatario, idioma }
router.post('/empresas/:id/linkedin/rascunho', exigirPapel('admin', 'comercial'), async (req, res) => {
    try {
        const { destinatario, idioma } = req.body || {};
        res.json(await linkedin.gerarRascunho(req.params.id, { destinatarioId: destinatario, idioma }, req.utilizador));
    } catch (erro) { responderErro(res, erro); }
});

// POST /api/outreach/empresas/:id/linkedin/registar   corpo: { destinatario, passo: "convite" | "mensagem", texto, idioma, ia }
router.post('/empresas/:id/linkedin/registar', exigirPapel('admin', 'comercial'), async (req, res) => {
    try {
        const b = req.body || {};
        res.status(201).json(await linkedin.registarEnvio(req.params.id, {
            destinatarioId: b.destinatario, passo: b.passo, texto: b.texto, idioma: b.idioma, geradoPorIa: !!b.ia?.gerado, modelo: b.ia?.modelo
        }, req.utilizador));
    } catch (erro) { responderErro(res, erro); }
});

module.exports = router;
