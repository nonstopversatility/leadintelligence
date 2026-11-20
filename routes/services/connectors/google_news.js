// Conector: Google News (RSS de pesquisa)
// Uma pesquisa por país/idioma, à procura de notícias de financiamento e lançamento de startups.
// Também usamos "site:" para ler sites que bloqueiam o RSS directo (ex.: EU-Startups).

const { baixar, lerFeed } = require('./util');

const PESQUISAS = {
    en: 'startup (raises OR "seed round" OR "series A" OR launches OR funding)',
    pt: 'startup ("ronda de investimento" OR "rodada de investimento" OR financiamento OR lança OR lançamento)',
    es: 'startup ("ronda de financiación" OR "ronda de inversión" OR levanta OR lanza OR lanzamiento)'
};

// hl/gl/ceid definem o país e o idioma do Google News
const MERCADOS = [
    { gl: 'GB', hl: 'en-GB', ceid: 'GB:en', idioma: 'en', regiao: 'europa' },
    { gl: 'IE', hl: 'en-IE', ceid: 'IE:en', idioma: 'en', regiao: 'europa' },
    { gl: 'PT', hl: 'pt-PT', ceid: 'PT:pt-150', idioma: 'pt', regiao: 'europa' },
    { gl: 'ES', hl: 'es', ceid: 'ES:es', idioma: 'es', regiao: 'europa' },
    { gl: 'US', hl: 'en-US', ceid: 'US:en', idioma: 'en', regiao: 'america_norte' },
    { gl: 'CA', hl: 'en-CA', ceid: 'CA:en', idioma: 'en', regiao: 'america_norte' },
    { gl: 'BR', hl: 'pt-BR', ceid: 'BR:pt-419', idioma: 'pt', regiao: 'america_latina' },
    { gl: 'MX', hl: 'es-419', ceid: 'MX:es-419', idioma: 'es', regiao: 'america_latina' },
    { gl: 'AR', hl: 'es-419', ceid: 'AR:es-419', idioma: 'es', regiao: 'america_latina' },
    { gl: 'CO', hl: 'es-419', ceid: 'CO:es-419', idioma: 'es', regiao: 'america_latina' },
    { gl: 'CL', hl: 'es-419', ceid: 'CL:es-419', idioma: 'es', regiao: 'america_latina' }
];

// Sites de startups que bloqueiam o RSS directo, lidos através do Google News
const SITES = [
    { site: 'eu-startups.com', gl: 'GB', hl: 'en-GB', ceid: 'GB:en', idioma: 'en', regiao: 'europa' }
];

const endereco = (q, m) =>
    `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=${m.hl}&gl=${m.gl}&ceid=${m.ceid}`;

async function buscar({ maxPorPesquisa = 25 } = {}) {
    const pedidos = [
        ...MERCADOS.map((m) => ({ url: endereco(PESQUISAS[m.idioma] + ' when:7d', m), m })),
        ...SITES.map((s) => ({ url: endereco(`site:${s.site} when:14d`, s), m: s }))
    ];

    const resultados = await Promise.allSettled(pedidos.map(async ({ url, m }) => {
        const xml = await (await baixar(url)).text();
        return lerFeed(xml).slice(0, maxPorPesquisa).map((i) => ({ ...i, idioma: m.idioma, regiao: m.regiao }));
    }));

    // Se uma pesquisa falhar, as outras continuam
    return resultados.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
}

module.exports = { id: 'google_news', nome: 'Google News', buscar };
