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

// Que canais mudam numa pessoa que já está na ficha (função pura). Um campo que não vem no pedido fica como está;
// um campo apagado no formulário apaga o valor. Só se valida o que foi mesmo alterado.
function validarCanais(actual, dados = {}) {
    const alterar = {};
    const canais = [
        ['email', 'email', 200, normalizarEmail, 'EMAIL', 'O email não é válido.'],
        ['linkedin', 'linkedin_url', 300, linkedin.urlPerfil, 'LINKEDIN', 'O LinkedIn tem de ser o perfil da pessoa (linkedin.com/in/…).']
    ];
    for (const [campo, coluna, max, normalizar, codigo, mensagem] of canais) {
        if (dados[campo] === undefined) continue;
        const bruto = limpar(dados[campo], max);
        if (bruto === (actual[coluna] || '')) continue;
        const valor = bruto ? normalizar(bruto) : null;
        if (bruto && !valor) throw erro(codigo, mensagem);
        if (valor !== (actual[coluna] || null)) alterar[coluna] = valor;
    }
    const final = { ...actual, ...alterar };
    if (!final.email && !final.linkedin_url) throw erro('CANAL', 'Indique o email ou o LinkedIn.');
    return alterar;
}

// Completa ou corrige o email e o LinkedIn de uma pessoa da empresa (por exemplo, identificada pela IA no site).
// O nome, o cargo e a fonte não mudam; a alteração fica no histórico como "manual".
async function completarContacto(empresaId, pessoaId, dados) {
    const { data: pessoa, error: ePessoa } = await supabaseAdmin.from('decisores')
        .select('id, nome, email, linkedin_url, nao_contactar').eq('id', pessoaId).eq('empresa_id', empresaId).maybeSingle();
    if (ePessoa) throw new Error(ePessoa.message);
    if (!pessoa) throw erro('NAO_ENCONTRADA', 'Pessoa não encontrada.');
    if (pessoa.nao_contactar) throw erro('NAO_CONTACTAR', 'Esta pessoa pediu para não ser contactada.');

    const alterar = validarCanais(pessoa, dados);
    if (alterar.email !== undefined) alterar.email_estado = alterar.email ? await validarEmail(alterar.email).catch(() => null) : null;
    if (Object.keys(alterar).length) {
        const { error } = await supabaseAdmin.from('decisores').update({ ...alterar, ultima_origem: 'manual' }).eq('id', pessoa.id);
        if (error) {
            if (error.code === '23505') throw erro('DUPLICADO', 'Já existe um contacto com este email ou LinkedIn.');
            throw new Error(error.message);
        }
    }
    return { id: pessoa.id, nome: pessoa.nome, email_estado: alterar.email_estado ?? null };
}

module.exports = { adicionarContacto, completarContacto, validarContacto, validarCanais };
