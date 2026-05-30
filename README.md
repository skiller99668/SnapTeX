# SnapTeX

A Chrome extension that combines a **multi-shot screenshot tool** with a **LaTeX-to-Unicode equation converter**. Capture screenshots into a "bag," stitch them into a single tall image, and convert LaTeX into paste-ready Unicode for Google Docs, Word, or Slack — all without leaving the browser.

## Features

### Screenshot Bag
- **Select Region** — drag a box anywhere on the page to capture just that area
- **Visible Area** — instantly grab the current viewport
- **Full Page** — auto-scroll and stitch an entire scrollable page into one image
- **The Bag** — every capture drops into a side panel as a thumbnail; remove individual shots or clear them all
- **Download** — export the whole bag as one tall PNG (mismatched widths are padded with black)
- **Paste** — copy the stitched image straight to your clipboard for pasting into any app

### Equation Converter
- Live **MathJax** preview as you type
- Converts LaTeX into Unicode you can paste anywhere: `\frac{-b \pm \sqrt{b^2-4ac}}{2a}` becomes `(-b ± √(b²-4ac))/(2a)`
- Handles nested fractions, square roots, nth roots, integrals and sums with bracketed bounds, Greek letters, operators, and combining accents (`\vec`, `\hat`, `\tilde`, `\bar`, `\overline`)
- One-click copy on every output
- Example chips for common formulas (quadratic, Pythagorean, Gauss's law, and more)

## Installation

Since SnapTeX isn't on the Chrome Web Store yet, load it as an unpacked extension:

1. Download and unzip `snaptex-extension.zip`
2. Download MathJax separately and save it as `mathjax.js` inside the unzipped folder. Get it from `https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js` (right-click → Save As)
3. Open `chrome://extensions` in Chrome
4. Toggle **Developer mode** on (top-right)
5. Click **Load unpacked** and select the extension folder
6. The SnapTeX icon will appear in your toolbar

## Usage

Click the toolbar icon to open the popup. From there:

| Action | What happens |
|--------|--------------|
| Select Region | Popup closes, drag a box on the page, the region is added to the bag |
| Visible Area | Current viewport is captured immediately |
| Full Page | Page scrolls top-to-bottom and stitches into one capture |
| Download | Bag is merged into a single PNG and saved |
| Paste | Merged PNG is copied to the clipboard |
| Clear | Empties the bag |
| Equation Converter | Opens the LaTeX converter in a new tab |

> **Note:** Screenshots can't be taken on browser-internal pages like `chrome://` or the New Tab page. Chrome blocks extensions from running there.

## How It Works

### Architecture
- **`manifest.json`** — Manifest V3 config, permissions, and resource declarations
- **`popup.html` / `popup.js`** — the toolbar UI; manages the bag display and stitches images for download/paste
- **`background.js`** — service worker that owns the bag state in `chrome.storage.local` and handles `captureVisibleTab` calls
- **`content.js`** — injected into pages to draw the region-select overlay and perform full-page scroll capture
- **`equation.html` / `equation.js`** — the standalone converter page and its parser

### Why the bag lives in the background
When you click "Select Region," the popup has to close so you can draw on the page. A popup's JavaScript is destroyed the moment it closes, so the bag can't live there. Instead, `background.js` stores every screenshot in `chrome.storage.local`, which persists independently of the popup and has no practical size cap (thanks to the `unlimitedStorage` permission).

### The LaTeX parser
The converter doesn't rely on an external library for the Unicode output. It runs a multi-stage pipeline:
1. **Symbol dictionary** — Greek letters, operators, and functions become Unicode
2. **Bounded operators** — integral and sum bounds are extracted with brace-depth tracking and rewritten as `∫[lo to hi]`
3. **Structural resolution** — fractions, roots, and nth-roots resolve recursively, innermost first, so deeply nested expressions like `\sqrt[3]{\frac{\bar{\gamma}}{\int_0^1 \xi^n d\xi}}` come out clean
4. **Accents** — combining characters are placed on the correct character (center for vectors/hats, every character for overlines)
5. **Super/subscripts** — converted to Unicode superscript and subscript glyphs

The key trick throughout is **brace-depth tracking**: a simple regex like `\sqrt\{([^{}]*)\}` breaks on nested braces, so the parser counts `{` and `}` to find the true matching close brace.

## Tech Stack

JavaScript · HTML/CSS · Chrome Extensions API (Manifest V3) · Canvas API · MathJax · Regular Expressions

## Limitations

- Pasting copies the screenshots as **one stitched image**, not as separate files. The clipboard API only holds a single item at a time, so multiple separate PNGs isn't possible.
- Full-page capture works best on pages with normal scrolling. Pages with sticky headers or virtualized scrolling may show artifacts.
- The equation converter targets common math notation. Very exotic LaTeX packages or macros aren't supported.

## Roadmap

- Publish to the Chrome Web Store
- Per-screenshot reordering in the bag
- Additional converter output formats (MathML)

## License

MIT