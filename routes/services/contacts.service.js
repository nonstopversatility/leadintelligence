// Contactos acrescentados à mão no Radar (nome, cargo, email e LinkedIn de uma pessoa da empresa).
// Ficam na mesma tabela dos decisores recolhidos automaticamente, por isso aparecem logo nas janelas de Email e LinkedIn.
// A origem fica marcada como "manual", para se distinguir do que foi recolhido no site da empresa.
const { supabaseAdmin } = require('./supabase.service');
const { normalizarNomePessoa, normalizarEmail, validarEmail } = require('./normalization.service');
const { categoriaDoCargo } = require('./import.service');
const linkedin = require('./linkedin.service');

const erro = (codigo, mensagem) => Object.assign(new Error(mensagem), { codigo });
// uma linha de texto, sem HTML nem caracteres de controlo
const limpar = (v, max) => String(v ?? '').replace(/<[^>]*>/g, '').replace(/[\p{Cc}\p{Cf}]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

// Valida o que veio do formulário (função pura). Nunca se grava um email ou um endereço mal escrito.
function validarContacto(dados = {}) {
    const nome = limpar(dados.nome, 90);
    if (!nome) throw erro('NOME', 'Falta o nome da pessoa.');
    const cargo = limpar(dados.cargo, 90) || null;
    const emailBruto = limpar(dados.email, 200), linkedinBruto = limpar(dados.linkedin, 300);
    if (!emailBruto && !linkedinBruto) throw erro('CANAL', 'Indique o email ou o LinkedIn.');
    const email = emailBruto ? normalizarEmail(emailBruto) : null;
    if (emailBruto && !email) throw erro('EMAIL', 'O email não é válido.');
    const linkedin_url = linkedinBruto ? linkedin.urlPerfil(linkedinBruto) : null;
    if (linkedinBruto && !linkedin_url) throw erro('LINKEDIN', 'O LinkedIn tem de ser o perfil da pessoa (linkedin.com/in/…).');
    return { nome, cargo, categoria: categoriaDoCargo(cargo), email, linkedin_url };
}

async function adicionarContacto(empresaId, dados) {
    const c = validarContacto(dados);
    const { data: empresa, error: eEmpresa } = await supabaseAdmin.from('empresas').select('id').eq('id', empresaId).maybeSingle();
    if (eEmpresa) throw new Error(eEmpresa.message);
    if (!empresa) throw erro('NAO_ENCONTRADA', 'Empresa não encontrada.');

    // o domínio do email recebe correio? (se a verificação falhar, grava-se sem estado)
    const email_estado = c.email ? await validarEmail(c.email).catch(() => null) : null;
    const { data, error } = await supabaseAdmin.from('decisores').insert({
        ...c, email_estado, empresa_id: empresaId, nome_normalizado: normalizarNomePessoa(c.nome) || null, fonte_url: 'manual', ultima_origem: 'manual'
    }).select('id, nome').single();
    if (error) {
        if (error.code === '23505') throw erro('DUPLICADO', 'Já existe um contacto com este nome, email ou LinkedIn.');
        throw new Error(error.message);
    }
    return { id: data.id, nome: data.nome, email_estado };
}

module.exports = { adicionarContacto, validarContacto };
