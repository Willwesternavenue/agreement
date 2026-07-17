// Preview panel - renders the contract with filled-in values
import {
    CONTRACT_TEMPLATE,
    APPENDIX_TEMPLATE,
    TEMPLATE_FIELDS,
    APPENDIX_FIELDS,
} from "./template.js";

let currentTab = "contract";
let diffMode = false;

// 変数ID → フォームのラベル（差分表示で「元テンプレートの空欄」を表す見出しに使う）
const FIELD_LABELS = {};
[...TEMPLATE_FIELDS, ...APPENDIX_FIELDS].forEach((f) => {
    FIELD_LABELS[f.id] = f.label;
});

export function initPreview(container, toolbar) {
    // Set up toolbar tabs
    toolbar.innerHTML = `
    <button class="tab active" data-tab="contract">📄 契約書本文</button>
    <button class="tab" data-tab="appendix">📎 別紙</button>
    <button class="diff-toggle" id="diff-toggle" title="元テンプレートとの差分（レッドライン）を表示">🔍 差分表示</button>
  `;

    toolbar.querySelectorAll(".tab").forEach((tab) => {
        tab.addEventListener("click", () => {
            toolbar.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
            tab.classList.add("active");
            currentTab = tab.dataset.tab;
            // Re-render with current data
            const event = new CustomEvent("tabchange");
            document.dispatchEvent(event);
        });
    });

    const diffToggle = toolbar.querySelector("#diff-toggle");
    diffToggle.addEventListener("click", () => {
        diffMode = !diffMode;
        diffToggle.classList.toggle("active", diffMode);
        document.dispatchEvent(new CustomEvent("tabchange"));
    });
}

export function renderPreview(container, data) {
    const template = currentTab === "contract" ? CONTRACT_TEMPLATE : APPENDIX_TEMPLATE;
    const rendered = diffMode
        ? renderTemplateDiff(template, data)
        : renderTemplate(template, data);
    const appendixClass = currentTab === "appendix" ? " appendix-preview" : "";
    const diffClass = diffMode ? " diff-mode" : "";
    const legend = diffMode
        ? `<div class="diff-legend">
             <span class="diff-legend-item"><span class="diff-del">元テンプレート</span> 差し替え前（空欄）</span>
             <span class="diff-legend-item"><span class="diff-ins">入力値</span> 差し替え後</span>
           </div>`
        : "";
    container.innerHTML = `${legend}<div class="document-preview${appendixClass}${diffClass}">${formatDocument(rendered, currentTab)}</div>`;
}

function renderTemplate(template, data) {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        const value = data[key];
        if (value && value.trim() !== "") {
            return `<span class="filled">${escapeHtml(value)}</span>`;
        } else {
            return `<span class="placeholder">【未入力】</span>`;
        }
    });
}

/**
 * 差分（レッドライン）表示：各プレースホルダを
 * 「元テンプレートの空欄（ラベル）を削除 → 入力値を追加」の redline で描画する。
 */
function renderTemplateDiff(template, data) {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        const label = FIELD_LABELS[key] || key;
        const del = `<del class="diff-del">【${escapeHtml(label)}】</del>`;
        const value = data[key];
        if (value && value.trim() !== "") {
            return `${del}<ins class="diff-ins">${escapeHtml(value)}</ins>`;
        }
        return `${del}<ins class="diff-ins diff-empty">（未入力）</ins>`;
    });
}

function formatDocument(text, tab = "contract") {
    if (tab === "appendix") {
        return formatAppendixPreview(text);
    }

    const lines = text.split("\n");
    let html = "";
    let inList = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (trimmed === "") {
            if (inList) {
                inList = false;
            }
            html += "<br>";
            continue;
        }

        // Title (first non-empty line or appendix header)
        if (trimmed === "開発委託契約書" || trimmed === "【別紙】本件業務の詳細") {
            html += `<h2>${trimmed}</h2>`;
            continue;
        }

        // Section titles (第X条)
        if (/^第\d+条/.test(trimmed)) {
            html += `<p class="section-title">${line}</p>`;
            continue;
        }

        // Numbered items (１, ２, etc or (1), (2))
        if (/^[１-９]|^\d+[．.]|^（\d+）/.test(trimmed)) {
            html += `<p style="padding-left: 1em;">${line}</p>`;
            continue;
        }

        // Indented content
        if (line.startsWith("　　")) {
            html += `<p style="padding-left: 2em;">${line.trim()}</p>`;
            continue;
        }

        if (line.startsWith("　")) {
            html += `<p style="padding-left: 1em;">${line.trim()}</p>`;
            continue;
        }

        html += `<p>${line}</p>`;
    }

    return html;
}

/** 別紙タブ：大見出し・小見出し・注記を判別して整形 */
function formatAppendixPreview(text) {
    const lines = text.split("\n");
    let html = "";
    let lastWasBlank = true;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (trimmed === "") {
            if (!lastWasBlank) {
                html += `<div class="appendix-gap"></div>`;
            }
            lastWasBlank = true;
            continue;
        }
        lastWasBlank = false;

        if (trimmed === "【別紙】本件業務の詳細") {
            html += `<h2>${trimmed}</h2>`;
            continue;
        }

        // １．〜９．、１０．〜１４．（全角番号）
        if (isAppendixMajorHeading(trimmed)) {
            html += `<p class="appendix-major">${line}</p>`;
            continue;
        }

        // （１）（２）… の小見出し
        if (/^（[１２３４５６７８９１０]+）/.test(trimmed)) {
            html += `<p class="appendix-sub">${line}</p>`;
            continue;
        }

        // 注記行
        if (trimmed.startsWith("※")) {
            html += `<p class="appendix-note">${line}</p>`;
            continue;
        }

        if (line.startsWith("　")) {
            html += `<p class="appendix-body">${line}</p>`;
            continue;
        }

        html += `<p class="appendix-body">${line}</p>`;
    }

    return html;
}

function isAppendixMajorHeading(trimmed) {
    return /^(１０|１１|１２|１３|１４|[１-９])[．.].+/.test(trimmed);
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

export function getCurrentTab() {
    return currentTab;
}
