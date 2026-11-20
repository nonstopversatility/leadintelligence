// Catálogo do Radar: define o âmbito geográfico e as listas dos filtros.
// Âmbito pedido pela Non Stop: Europa inteira e Américas inteiras.
// Os países guardam-se como códigos ISO de 2 letras (PT, ES, US...).
// O nome é traduzido no browser para o idioma escolhido (EN/PT/ES).

const REGIOES = {
    europa: [
        'AL', 'AD', 'AT', 'BY', 'BE', 'BA', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR',
        'HU', 'IS', 'IE', 'IT', 'XK', 'LV', 'LI', 'LT', 'LU', 'MT', 'MD', 'MC', 'ME', 'NL', 'MK', 'NO',
        'PL', 'PT', 'RO', 'RU', 'SM', 'RS', 'SK', 'SI', 'ES', 'SE', 'CH', 'UA', 'GB'
    ],
    america_norte: ['US', 'CA'],
    america_latina: [
        'MX', 'GT', 'BZ', 'HN', 'SV', 'NI', 'CR', 'PA', 'CU', 'DO', 'HT', 'JM', 'BS', 'BB', 'TT', 'PR',
        'CO', 'VE', 'GY', 'SR', 'BR', 'EC', 'PE', 'BO', 'PY', 'UY', 'AR', 'CL'
    ]
};

const IDIOMAS = ['pt', 'en', 'es'];

// Sectores de startups (a Claude classifica cada empresa num destes, na recolha)
const SECTORES = [
    'fintech', 'healthtech', 'edtech', 'saas', 'ecommerce', 'ai', 'cybersecurity', 'marketplace',
    'logistica', 'proptech', 'agritech', 'climate', 'mobilidade', 'foodtech', 'turismo',
    'entretenimento', 'deeptech', 'outro'
];

// Os mesmos serviços que a tabela leads aceita em servico_interesse
const SERVICOS = [
    'branding', 'website', 'marketing_digital', 'redes_sociais',
    'marketing_influencia', 'design_grafico'
];

const regiaoDoPais = (pais) => Object.keys(REGIOES).find((r) => REGIOES[r].includes(pais)) || null;

module.exports = { REGIOES, IDIOMAS, SECTORES, SERVICOS, regiaoDoPais };
