// Validação dos contactos acrescentados à mão no Radar. Não toca na base de dados.
require('dotenv').config({ quiet: true });
process.env.SUPABASE_URL ||= 'http://localhost';
process.env.SUPABASE_PUBLIC_KEY ||= 'teste';
process.env.SUPABASE_SECRET_KEY ||= 'teste';
const test = require('node:test');
const assert = require('node:assert');
const { validarContacto } = require('../routes/services/contacts.service');

const falha = (dados, codigo) => assert.throws(() => validarContacto(dados), (e) => e.codigo === codigo);

test('aceita um contacto completo e limpa os campos', () => {
    const c = validarContacto({ nome: '  Ana <b>Dias</b> ', cargo: 'CEO', email: 'ANA@Exemplo.pt', linkedin: 'linkedin.com/in/anadias?utm=1' });
    assert.strictEqual(c.nome, 'Ana Dias');
    assert.strictEqual(c.email, 'ana@exemplo.pt');
    assert.strictEqual(c.linkedin_url, 'https://linkedin.com/in/anadias');
    assert.strictEqual(c.categoria, 'ceo');
});

test('basta o email ou o LinkedIn', () => {
    assert.strictEqual(validarContacto({ nome: 'Ana', email: 'ana@exemplo.pt' }).linkedin_url, null);
    assert.strictEqual(validarContacto({ nome: 'Ana', linkedin: 'https://www.linkedin.com/in/ana' }).email, null);
});

test('recusa dados em falta ou mal escritos', () => {
    falha({ email: 'ana@exemplo.pt' }, 'NOME');
    falha({ nome: 'Ana' }, 'CANAL');
    falha({ nome: 'Ana', email: 'ana@' }, 'EMAIL');
    falha({ nome: 'Ana', linkedin: 'https://linkedin.com/company/exemplo' }, 'LINKEDIN');
    falha({ nome: 'Ana', linkedin: 'javascript:alert(1)' }, 'LINKEDIN');
});
