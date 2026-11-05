// Syntax tests for the joy grammar.
//
// Test files use sublime text's format: each line after source code may hold
// assertions in an html comment, `^` marks columns and `<-` the first column:
//
//     @foo
//     <!-- <- variable.other.joy -->
//     <!--^^ variable.other.joy - string -->
//
// Html, css and js grammars are taken from the installed vs code, its location
// is detected or can be set with the VSCODE_APP environment variable
// (the folder containing "extensions").

const fs = require('fs');
const path = require('path');
const vsctm = require('vscode-textmate');
const oniguruma = require('vscode-oniguruma');

const root = path.join(__dirname, '..');

function findVscodeApp() {
    if (process.env.VSCODE_APP) {
        return process.env.VSCODE_APP;
    }

    const candidates = [
        path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Microsoft VS Code'),
        'C:\\Program Files\\Microsoft VS Code',
        '/usr/share/code',
        '/Applications/Visual Studio Code.app/Contents/Resources/app'
    ];

    for (const dir of candidates) {
        if (fs.existsSync(path.join(dir, 'extensions'))) {
            return dir;
        }

        // recent windows builds keep resources in a versioned folder
        if (fs.existsSync(dir)) {
            for (const sub of fs.readdirSync(dir)) {
                const app = path.join(dir, sub, 'resources', 'app');

                if (fs.existsSync(path.join(app, 'extensions'))) {
                    return app;
                }
            }

            const app = path.join(dir, 'resources', 'app');

            if (fs.existsSync(path.join(app, 'extensions'))) {
                return app;
            }
        }
    }

    throw new Error('VS Code not found, set VSCODE_APP to the folder containing "extensions"');
}

async function createRegistry() {
    const app = findVscodeApp();
    const grammars = {
        'text.html.joy': path.join(root, 'syntaxes', 'joy.tmLanguage.json'),
        'text.html.basic': path.join(app, 'extensions', 'html', 'syntaxes', 'html.tmLanguage.json'),
        'source.js': path.join(app, 'extensions', 'javascript', 'syntaxes', 'JavaScript.tmLanguage.json'),
        'source.css': path.join(app, 'extensions', 'css', 'syntaxes', 'css.tmLanguage.json')
    };
    const wasm = fs.readFileSync(path.join(path.dirname(require.resolve('vscode-oniguruma')), 'onig.wasm'));

    await oniguruma.loadWASM(wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength));

    return new vsctm.Registry({
        onigLib: Promise.resolve({
            createOnigScanner: patterns => new oniguruma.OnigScanner(patterns),
            createOnigString: str => new oniguruma.OnigString(str)
        }),
        loadGrammar: async scopeName => {
            const file = grammars[scopeName];

            return file ? vsctm.parseRawGrammar(fs.readFileSync(file, 'utf8'), file) : null;
        }
    });
}

// returns [[start, end, scopes[]], ...] for every line of the text
function tokenize(grammar, text) {
    let ruleStack = vsctm.INITIAL;

    return text.split('\n').map(line => {
        const res = grammar.tokenizeLine(line, ruleStack);

        ruleStack = res.ruleStack;

        return res.tokens.map(t => [t.startIndex, t.endIndex, t.scopes]);
    });
}

function scopesAt(lineTokens, col) {
    const token = lineTokens.find(([start, end]) => start <= col && col < end);

    return token ? token[2] : [];
}

// sublime-like selector: "a b - c - d e", each atom matches by prefix
function matchPath(scopes, pathAtoms) {
    let i = 0;

    for (const scope of scopes) {
        const atom = pathAtoms[i];

        if (scope === atom || scope.startsWith(atom + '.')) {
            i++;

            if (i === pathAtoms.length) {
                return true;
            }
        }
    }

    return pathAtoms.length === 0;
}

function matches(scopes, selector) {
    const [positive, ...negatives] = selector.split(/\s+-\s+|^-\s+/).map(s => s.trim().split(/\s+/).filter(Boolean));

    return matchPath(scopes, positive) && !negatives.some(n => n.length && matchPath(scopes, n));
}

const ASSERTION = /^<!--\s*(?:(<-)|(\^+))\s*(.*?)\s*-->$/;
const ASSERTION_COLUMN = /^(<!--)(\s*)(\^+)/;

function runTestFile(grammar, file) {
    const lines = fs.readFileSync(file, 'utf8').replace(/\r\n?/g, '\n').split('\n');
    const tokens = tokenize(grammar, lines.join('\n'));
    const failures = [];
    let assertions = 0;
    let target = -1;

    lines.forEach((line, i) => {
        const m = line.match(ASSERTION);

        if (!m || target < 0) {
            if (!m) {
                target = i;
            }

            return;
        }

        const selector = m[3];
        let cols;

        if (m[1]) {
            cols = [0];
        }
        else {
            const c = line.match(ASSERTION_COLUMN);
            const start = c[1].length + c[2].length;

            cols = Array.from({ length: c[3].length }, (_, k) => start + k);
        }

        for (const col of cols) {
            assertions++;

            const scopes = scopesAt(tokens[target], col);

            if (!matches(scopes, selector)) {
                failures.push(
                    `${path.basename(file)}:${target + 1}:${col + 1}\n` +
                    `  ${lines[target]}\n` +
                    `  ${' '.repeat(col)}^ expected: ${selector}\n` +
                    `  actual: ${scopes.join(' ')}`
                );
                break;
            }
        }
    });

    return { assertions, failures };
}

module.exports = { createRegistry, tokenize };

if (require.main === module) {
    (async () => {
        const registry = await createRegistry();
        const grammar = await registry.loadGrammar('text.html.joy');
        const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.joy')).map(f => path.join(__dirname, f));
        let total = 0;
        let failed = 0;

        for (const file of files) {
            const { assertions, failures } = runTestFile(grammar, file);

            total += assertions;
            failed += failures.length;
            failures.forEach(f => console.log(f + '\n'));
        }

        console.log(`${total} assertions, ${failed} failed`);
        process.exitCode = failed ? 1 : 0;
    })();
}
