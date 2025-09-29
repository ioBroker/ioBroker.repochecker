const fs = require('fs');
const issues = require('./issues');
const languages = ['en'];

// try to extract error description from index.js
function extractFromIndex() {
    let added = false;
    const lines = fs.readFileSync(`${__dirname}/../index.js`, {encoding: 'utf8'}).split('\n');
    for (let i = 0; i < lines.length; i++) {
        const m = lines[i].match(/`(\[[EW]\d\d\d\d] [^`]+)`/) || lines[i].match(/'(\[[EW]\d\d\d\d] [^`]+)'/) || lines[i].match(/"(\[[EW]\d\d\d\d] [^`]+)"/);
        if (m) {
            const parts = m[1].match(/\[([EW]\d\d\d\d)] (.+)/);
            if (parts) {
                console.log(parts[1], parts[2]);
                if (!issues[parts[1]]) {
                    // cut off the last part
                    parts[2] = parts[2].replace(/"/g, '`');
                    issues[parts[1]] = {
                        title: parts[2],
                    };
                    added = true;
                }
            }
        }
    }
    if (added) {
        // sort issues
        const newIssues = {};
        const keys = Object.keys(issues).sort();
        keys.forEach(key => newIssues[key] = issues[key]);

        fs.writeFileSync(`${__dirname}/issues.json`, JSON.stringify(newIssues, null, 2));
    }
}

extractFromIndex();



const explanationTitle = {
    en: 'Explanation',
    de: 'Erklärung',
    ru: 'Объяснение',
    fr: 'Explication',
    nl: 'Uitleg',
    'pt-pt': 'Explicação',
    it: 'Spiegazione',
    es: 'Explicación',
    uk: 'Пояснення',
    pl: 'Wyjaśnienie',
    'zh-cn': '解释',
};

const stepsTitle = {
    en: 'Required step to resolve the problem',
    de: 'Erforderlicher Schritt zur Behebung des Problems',
    ru: 'Необходимый шаг для устранения проблемы',
    fr: 'Étape requise pour résoudre le problème',
    nl: 'Vereiste stap om het probleem op te lossen',
    'pt-pt': 'Etapa necessária para resolver o problema',
    it: 'Passaggio richiesto per risolvere il problema',
    es: 'Paso requerido para resolver el problema',
    uk: 'Необхідний крок для вирішення проблеми',
    pl: 'Wymagany krok do rozwiązania problemu',
    'zh-cn': '解决问题所需的步骤',
};

const notesTitle = {
    en: 'Technical notes',
    de: 'Technische Notizen',
    ru: 'Технические заметки',
    fr: 'Notes techniques',
    nl: 'Technische notities',
    'pt-pt': 'Notas técnicas',
    it: 'Note tecniche',
    es: 'Notas técnicas',
    uk: 'Технічні примітки',
    pl: 'Notatki techniczne',
    'zh-cn': '技术说明',
};


// try to find possible languages
Object.keys(issues).forEach(issue => {
    const entry = issues[issue];
    if (entry.title && typeof entry.title === 'object') {
        const langs = Object.keys(entry.title);
        langs.forEach(lang => !languages.includes(lang) && languages.push(lang));
    }
    if (entry.explanation && typeof entry.explanation === 'object') {
        const langs = Object.keys(entry.explanation);
        langs.forEach(lang => !languages.includes(lang) && languages.push(lang));
    }
    if (entry.resolving && typeof entry.resolving === 'object') {
        const langs = Object.keys(entry.resolving);
        langs.forEach(lang => !languages.includes(lang) && languages.push(lang));
    }
});

function getText(text, lang) {
    if (typeof text === 'object') {
        if (text[lang]) {
            return text[lang];
        } else {
            return text.en;
        }
    }
    return text;
}

languages.forEach(lang => {
    // generate one language file for each language
    const lines = [];
    const content = [
        '# Explanation of repo checker issues',
        '## Content',
    ];

    Object.keys(issues).forEach(issue => {
        const entry = issues[issue];
        const title = `[${issue}] ${getText(entry.title, lang)}`;
        const explanation = getText(entry.explanation, lang);
        const resolving = getText(entry.resolving, lang);
        const note = getText(entry.note, lang);

        // link => e001-cannot-parse-packetjson
        content.push(`- [${issue} ${getText(entry.title, lang)}](#${title.toLowerCase()
            .replace(/\s/g, '-')
            .replace(/\[/g, '')
            .replace(/]/g, '')
            .replace(/[^-\w\d]/g, '')
        })`);
        lines.push(`### ${title}`);
        if (explanation) {
            lines.push(`#### ${getText(explanationTitle, lang)}`);
            lines.push(explanation);
        }
        if (resolving) {
            lines.push(`#### ${getText(stepsTitle, lang)}`);
            lines.push(resolving);
        }
        if (note) {
            lines.push(`#### ${getText(notesTitle, lang)}`);
            lines.push(note);
        }
        lines.push('');
    });
    content.push('');
    content.push('## Issues');
    fs.writeFileSync(`${__dirname}/issues_${lang}.md`, `${content.join('\n')}\n${lines.join('\n')}\n`, {encoding: 'utf8'});
});