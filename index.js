const { program } = require('commander');
const fs = require('fs');
const util = require('util');
const path = require('path');
const bibParse = require('bibtex-parse');
const leven = require('leven');

program.version('0.0.1');

const Strategies = {
    'bruteforce': bruteforceStrategy,
};

const readFile = util.promisify(fs.readFile);
const SIMILARITY_RATE = 0.3;

function normalizePath(pathname) {
    if (pathname.indexOf('/') === -1) {
        pathname = path.join(process.cwd(), pathname);
    }

    return path.normalize(pathname);
}

async function readBib(filename) {
    return await readFile(filename, 'utf8');
}

async function LoadBib(filename) {
    const file = await readBib(normalizePath(filename));
    return bibParse.entries(file);
}

function findSimilars(element, field, list) {
    let similars = [];
    
    for (let el of list) {
        if (el == element)
            break;

        let newLeven = leven(element[field], el[field]);
        let max = Math.max(element[field].length || 1, el[field].length || 1);
        let similarity = newLeven / max;

        if (similarity < SIMILARITY_RATE) {
            similars.push(el);
        }
    }

    return similars;
}

function normalizeField(field) {
    return field == 'key'
        ? field
        : field.toUpperCase();
}

function formatOptions(options, sep = ', ') {
    return options.map(option => `"${option}"`).join(sep);
}

function getOptions(sep) {
    return formatOptions(Object.keys(Strategies), sep);
}

function checkSimilar(el, field, list, checked) {
    if (!checked[el.key]) {
        let similars = findSimilars(el, field, list);
        
        if (similars.length > 0) {
            console.log('-------------------------');
            similars.forEach(el => { checked[el.key] = true; });
            console.log(`Key ${el.key} repeated ${similars.length}`);
            console.log(similars.map(similar => similar.key).join(', '));
            return similars.length;
        }
    }

    return 0;
}

function bruteforceStrategy(field, list) {
    const checked = {};
    let repeated = 0;

    if (list.length > 0) {
        let el = list[0];
        let len = list.length;

        checkSimilar(el, field, list, checked);

        for (let i = 1; i < len; ++i) {
            el = list[i];
            repeated += checkSimilar(el, field, list, checked);
        }
    }

    console.log(`Total: ${list.length}, repeated: ${repeated}`);
}

async function main() {
    program
        .name("bibdup")
        .option('-f, --file <file>', '.bib file')
        .option('-s, --strategy <strategy>', `diff strategy, options: [${getOptions()}].`, 'bruteforce')
        .option('-f, --field <field>', 'field to compare.', 'title')
        .parse(process.argv)
        ;

    if (Strategies[program.strategy] === undefined) {
        console.log(`Unknown strategy! Options are ${getOptions(' or ')}.`);
        process.exit(-1);
    }

    const strategy = Strategies[program.strategy];

    const field = normalizeField(program.field);

    let bibs;

    if (program.file) {
        try {
            bibs = await LoadBib(program.file);
        } catch (e) {
            console.log('"file" is not a valid bibtex file');
        }
        strategy(field, bibs);
    } else {
        console.log('No file informed!');
    }
}

main();