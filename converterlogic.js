// ─────────────────────────────────────────────────────────────
//  STEP 1: The lookup table
//  Maps LaTeX commands → their Unicode equivalents.
//  This is the core of the converter.
// ─────────────────────────────────────────────────────────────
const CMD = {
  // Spacing & Formatting (Stripped or converted to space)
  '\\displaystyle': '', '\\!': '', '\\:': ' ', '\\,': ' ', '\\quad': '  ',

  // Calculus Differentials 
  '\\dx': 'dx', '\\dy': 'dy', '\\dz': 'dz', '\\dt': 'dt',
  
  // Calculus & Riemann Sums (Existing + Improvements)
  '\\int': '∫', '\\iint': '∬', '\\iiint': '∭', '\\oint': '∮', 
  '\\sum': '∑', '\\prod': '∏', '\\lim': 'lim', '\\Delta': 'Δ', '\\delta': 'δ', '\\xi': 'ξ',
  '\\infty': '∞', '\\to': '→', '\\rightarrow': '→', '\\leftarrow': '←', '\\partial': '∂', '\\nabla': '∇',

  // Logic & Sets
  '\\forall': '∀', '\\exists': '∃', '\\neg': '¬', '\\therefore': '∴', '\\because': '∵',
  '\\implies': '⇒', '\\Rightarrow': '⇒', '\\iff': '⇔', '\\Leftrightarrow': '⇔',
  '\\in': '∈', '\\notin': '∉', '\\subset': '⊂', '\\supset': '⊃', '\\cup': '∪', '\\cap': '∩',

  // Greek Letters
  '\\alpha':'α', '\\beta':'β', '\\gamma':'γ', '\\epsilon':'ε', '\\varepsilon':'ε', '\\zeta':'ζ', 
  '\\eta':'η', '\\theta':'θ', '\\iota':'ι', '\\kappa':'κ', '\\lambda':'λ', '\\mu':'μ', 
  '\\nu':'ν', '\\pi':'π', '\\rho':'ρ', '\\sigma':'σ', '\\tau':'τ', '\\phi':'φ', 
  '\\varphi':'φ', '\\chi':'χ', '\\psi':'ψ', '\\omega':'ω',
  '\\Gamma':'Γ', '\\Theta':'Θ', '\\Lambda':'Λ', '\\Pi':'Π', '\\Sigma':'Σ',
  '\\Phi':'Φ', '\\Psi':'Ψ', '\\Omega':'Ω',

  // Operators & Comparison
  '\\pm':'±', '\\mp':'∓', '\\times':'×', '\\div':'÷', '\\cdot':'·',
  '\\leq':'≤', '\\geq':'≥', '\\neq':'≠', '\\approx':'≈', '\\equiv':'≡',
  '\\cdots':'⋯', '\\ldots':'…',

  // Functions & Formatting Strippers
  '\\sin':'sin', '\\cos':'cos', '\\tan':'tan', '\\ln':'ln', '\\log':'log',
  '\\mathrm':'', '\\text':'', 
  '\\left':'', '\\right':'',
  
  // Misc
  '\\sqrt':'√'
};

// Superscript and subscript character maps

// 1. Keep these for powers like x² or indices like a₁
const SUP = {'0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵',
'6':'⁶','7':'⁷','8':'⁸','9':'⁹','+':'⁺','-':'⁻','=':'⁼','(':'⁽',
')':'⁾','n':'ⁿ','i':'ⁱ','x':'ˣ','y':'ʸ','z':'ᶻ','/':'ᐟ','√':'√','∞':'᪳',' ':' '};
const SUB = {'0':'₀','1':'₁','2':'₂','3':'₃','4':'₄','5':'₅',
'6':'₆','7':'₇','8':'₈','9':'₉','+':'₊','-':'₋','=':'₌','(':'₍',
')':'₎','n':'ₙ','i':'ᵢ','x':'ₓ','y':'ᵧ','z':'ᴢ',' ':' '};

function toSup(s) { return s ? s.split('').map(c => SUP[c] || c).join('') : ''; }
function toSub(s) { return s ? s.split('').map(c => SUB[c] || c).join('') : ''; }

// 2. THE BRACE HUNTER (Now strictly for the Scan-and-Slice)
function getBracedContent(s, startIdx) {
  if (startIdx === -1) return null;
  let depth = 0;
  let firstBrace = s.indexOf('{', startIdx);
  if (firstBrace === -1) return null;
  
  for (let i = firstBrace; i < s.length; i++) {
    if (s[i] === '{') depth++;
    else if (s[i] === '}') {
      depth--;
      if (depth === 0) return { content: s.slice(firstBrace + 1, i), start: firstBrace, end: i };
    }
  }
  return null;
}

function latexToUnicode(raw) {
  let s = raw.trim().replace(/^\$\$?|\$\$?$/g, '').trim();
  s = s.replace(/\\displaystyle|\\!|\\:|\\,|\\mathrm|\\text|\\left|\\right/g, ' ');

  // STEP A: SCAN AND SLICE (Fractions, Roots, Binomials)
  // This manually deletes the LaTeX and replaces it to prevent "ghosting"
  let changed = true;
  while (changed) {
    changed = false;

    // 1. Handle \frac
    let fIdx = s.indexOf('\\frac');
    if (fIdx !== -1) {
      let num = getBracedContent(s, fIdx);
      if (num) {
        let den = getBracedContent(s, num.end + 1);
        if (den) {
          s = s.slice(0, fIdx) + `(${num.content}/${den.content})` + s.slice(den.end + 1);
          changed = true; continue;
        }
      }
    }

    // 2. Handle \sqrt
    let rIdx = s.indexOf('\\sqrt');
    if (rIdx !== -1) {
      let nPart = s.slice(rIdx, rIdx + 20).match(/\\sqrt\[(\d+)\]/);
      let content = getBracedContent(s, rIdx);
      if (content) {
        let sym = '√';
        if (nPart) sym = {'2':'√','3':'∛','4':'∜'}[nPart[1]] || `${toSup(nPart[1])}√`;
        s = s.slice(0, rIdx) + `${sym}(${content.content})` + s.slice(content.end + 1);
        changed = true; continue;
      }
    }

    // 3. Handle \binom
    let bIdx = s.indexOf('\\binom');
    if (bIdx !== -1) {
      let n = getBracedContent(s, bIdx);
      if (n) {
        let k = getBracedContent(s, n.end + 1);
        if (k) {
          s = s.slice(0, bIdx) + `(${toSup(n.content)}${toSub(k.content)})` + s.slice(k.end + 1);
          changed = true; continue;
        }
      }
    }
  }

  // STEP B: BRACKETED INTEGRAL LIMITS
  const ops = {'\\int': '∫', '\\iint': '∬', '\\iiint': '∭', '\\sum': '∑'};
  Object.entries(ops).forEach(([cmd, sym]) => {
    let idx;
    while ((idx = s.indexOf(cmd)) !== -1) {
      let j = idx + cmd.length;
      let lo = null, hi = null;
      let lastMatchEnd = j;

      for (let k = 0; k < 2; k++) {
        let chunk = s.slice(lastMatchEnd).match(/^\s*([_^])\s*(\{)?/);
        if (chunk) {
          let type = chunk[1];
          let isBraced = chunk[2];
          let start = lastMatchEnd + chunk[0].length - (isBraced ? 1 : 0);
          if (isBraced) {
            let res = getBracedContent(s, start - 1);
            if (type === '_') lo = res.content; else hi = res.content;
            lastMatchEnd = res.end + 1;
          } else {
            let val = s[start];
            if (type === '_') lo = val; else hi = val;
            lastMatchEnd = start + 1;
          }
        }
      }
      let replacement = sym + (lo || hi ? `[${lo || ''}${hi ? ' to ' + hi : ''}] ` : '');
      s = s.slice(0, idx) + replacement + s.slice(lastMatchEnd);
    }
  });

  // STEP C: DICTIONARY & FINAL POWERS
  Object.entries(CMD).sort((a,b) => b[0].length - a[0].length).forEach(([k,v]) => {
    s = s.replace(new RegExp(k.replace(/\\/g, '\\\\') + '(?![a-zA-Z])', 'g'), v);
  });

  for(let i = 0; i < 2; i++) {
    s = s.replace(/\^\{([^{}]+)\}/g, (_, x) => toSup(x));
    s = s.replace(/_\{([^{}]+)\}/g, (_, x) => toSub(x));
    s = s.replace(/\^([0-9a-zA-Z∞√])/g, (_, x) => toSup(x));
    s = s.replace(/_([0-9a-zA-Z*])/g, (_, x) => toSub(x));
  }

  // STEP B2: ACCENTS (runs after Step C so dictionary has already converted \omega→ω etc.)

  // Center anchor — symbol goes on the middle character
  const centerAnchor = {
    'vec': '\u0350',   // combining right arrow above
    'hat': '\u0302',   // combining circumflex
    'tilde': '\u0303', // combining tilde
  };
  Object.entries(centerAnchor).forEach(([cmd, sym]) => {
    s = s.replace(new RegExp(`\\\\${cmd}\\{([^{}]+)\\}`, 'g'), (_, content) => {
      const chars = [...content];
      const mid = Math.floor((chars.length - 1) / 2);
      chars[mid] += sym;
      return chars.join('');
    });
    s = s.replace(new RegExp(`\\\\${cmd}\\s?([^\\\\\\s{])`, 'g'), `$1${sym}`);
  });

  s = s.replace(/\\bar\{([^{}]+)\}/g, (_, content) => {
    const chars = [...content];
    const sym = chars.length === 1 ? '\u0304' : '\u0305';
    return chars.map(c => c + sym).join('');
  });
  s = s.replace(/\\bar\s?([^\\\s{])/g, (_, c) => c + '\u0304');

  // Overline — add a leading \u0305 to anchor it, then every char
  s = s.replace(/\\overline\{([^{}]+)\}/g, (_, content) => {
    return [...content].map(c => c + '\u0305').join('');
  });
  s = s.replace(/\\overline\s?([^\\\s{])/g, (_, c) => c + '\u0305');

  return s.replace(/\\/g, '').replace(/[{}]/g, '').replace(/\s+/g, ' ').trim();
}

// ─────────────────────────────────────────────────────────────
//  STEP 3: Wiring it to the UI
// ─────────────────────────────────────────────────────────────
const input = document.getElementById('input');

// Live preview — fires 400ms after you stop typing
let timer;
input.addEventListener('input', () => {
  clearTimeout(timer);
  timer = setTimeout(updatePreview, 400);
});

function updatePreview() {
  const v = input.value.trim();
  const preview = document.getElementById('preview');
  if (!v) { preview.innerHTML = '<span style="color:#444">Type something above…</span>'; return; }
  // Wrap in \( \) so MathJax knows to render it
  preview.innerHTML = `\\(${v}\\)`;
  if (window.MathJax) MathJax.typesetPromise([preview]);
}

function copyToClipboard() {
  const textToCopy = document.getElementById('out-unicode').textContent;
  
  if (!textToCopy) return;

  // This API ensures ONLY the string is copied, with no CSS or HTML attached
  navigator.clipboard.writeText(textToCopy).then(() => {
    const btn = document.getElementById('copy-btn');
    const originalText = btn.textContent;
    
    // Quick visual feedback that it worked
    btn.textContent = 'Copied!';
    setTimeout(() => btn.textContent = originalText, 2000);
  });
}

function convert() {
  const v = input.value.trim();
  if (!v) return;

  const cleanInput = v.replace(/^\$\$?|\$\$?$/g, '').trim();
  document.getElementById('out-clean').textContent = cleanInput;

  const unicodeResult = latexToUnicode(cleanInput);
  
  // Display it in the UI
  document.getElementById('out-unicode').textContent = unicodeResult;
}

function copyEl(el) {
  navigator.clipboard.writeText(el.textContent).then(() => {
    el.classList.add('copied');
    setTimeout(() => el.classList.remove('copied'), 1800);
  });
}

const EXAMPLES = [
  { label: 'Quadratic formula', latex: '\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}' },
  { label: 'Pythagorean theorem', latex: 'a^2 + b^2 = c^2' },
  { label: "Gauss's law", latex: '\\oint \\vec{E}\\cdot\\\\d\\vec{A} = \\frac{Q_{\\text{enc}}}{\\varepsilon_0}' },
  { label: "Gibbs free energy", latex: '\\Delta\\\\G = \\Delta\\\\H - T\\Delta\\\\S' },
];

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-convert').addEventListener('click', convert);

  document.getElementById('out-unicode').addEventListener('click', function() { copyEl(this); });
  document.getElementById('out-clean').addEventListener('click', function() { copyEl(this); });

  EXAMPLES.forEach(ex => {
    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.textContent = ex.label;
    chip.addEventListener('click', () => load(ex.latex));
    document.getElementById('chips').appendChild(chip);
  });
});

function load(latex) {
  input.value = latex;
  updatePreview();
  convert();
}