// Form generation and management
import { TEMPLATE_FIELDS, APPENDIX_FIELDS } from "./template.js";

const GROUP_ICONS = {
    基本情報: "📋",
    開発内容: "💼",
    対象データ: "🗂️",
    作業体制: "👥",
    作業内容: "⚙️",
    連絡協議会: "📞",
    "作業期間・納品": "📅",
    成果物明細: "📦",
    "業務完了・委託料": "💰",
};

export function generateForm(container, onChange) {
    const allFields = [...TEMPLATE_FIELDS, ...APPENDIX_FIELDS];
    const groups = {};

    // Group fields
    allFields.forEach((field) => {
        if (!groups[field.group]) {
            groups[field.group] = [];
        }
        groups[field.group].push(field);
    });

    let html = "";

    // Progress bar
    html += `
    <div class="progress-bar">
      <span class="progress-text" id="progress-text">0/${allFields.filter((f) => f.required).length} 必須項目</span>
      <div class="progress-track">
        <div class="progress-fill" id="progress-fill" style="width: 0%"></div>
      </div>
    </div>
  `;

    // Generate form groups
    for (const [groupName, fields] of Object.entries(groups)) {
        const icon = GROUP_ICONS[groupName] || "📄";
        html += `
      <div class="form-group-header">
        <div class="group-icon">${icon}</div>
        <h3>${groupName}</h3>
      </div>
    `;

        // Check if this group has date fields to lay them out in a row
        const dateFields = fields.filter((f) =>
            ["contract_year", "contract_month", "contract_day"].includes(f.id)
        );

        if (dateFields.length > 0) {
            // Non-date fields first
            fields.forEach((field) => {
                if (!["contract_year", "contract_month", "contract_day"].includes(field.id)) {
                    html += renderField(field);
                }
            });

            // Date row
            html += '<div class="date-row">';
            dateFields.forEach((field) => {
                html += renderField(field);
            });
            html += "</div>";
        } else {
            fields.forEach((field) => {
                html += renderField(field);
            });
        }
    }

    container.innerHTML = html;

    // Set default values
    allFields.forEach((field) => {
        if (field.defaultValue !== undefined) {
            const el = document.getElementById(`field-${field.id}`);
            if (el) el.value = field.defaultValue;
        }
    });

    // Attach change handlers
    allFields.forEach((field) => {
        const el = document.getElementById(`field-${field.id}`);
        if (el) {
            el.addEventListener("input", () => {
                updateProgress();
                onChange(getFormData());
            });
        }
    });

    function updateProgress() {
        const required = allFields.filter((f) => f.required);
        const filled = required.filter((f) => {
            const el = document.getElementById(`field-${f.id}`);
            return el && el.value.trim() !== "";
        });
        const pct = Math.round((filled.length / required.length) * 100);
        document.getElementById("progress-fill").style.width = `${pct}%`;
        document.getElementById("progress-text").textContent =
            `${filled.length}/${required.length} 必須項目`;
    }
}

function renderField(field) {
    const requiredMark = field.required
        ? '<span class="required">*</span>'
        : "";

    let inputHtml = "";
    if (field.type === "textarea") {
        inputHtml = `<textarea id="field-${field.id}" placeholder="${field.placeholder}" rows="3">${field.defaultValue || ""}</textarea>`;
    } else if (field.type === "number") {
        inputHtml = `<input type="number" id="field-${field.id}" placeholder="${field.placeholder}" value="${field.defaultValue || ""}">`;
    } else {
        inputHtml = `<input type="text" id="field-${field.id}" placeholder="${field.placeholder}" value="${field.defaultValue || ""}">`;
    }

    return `
    <div class="form-field">
      <label for="field-${field.id}">${field.label}${requiredMark}</label>
      ${inputHtml}
    </div>
  `;
}

export function getFormData() {
    const allFields = [...TEMPLATE_FIELDS, ...APPENDIX_FIELDS];
    const data = {};
    allFields.forEach((field) => {
        const el = document.getElementById(`field-${field.id}`);
        data[field.id] = el ? el.value.trim() : "";
    });
    return data;
}

export function isFormValid() {
    const allFields = [...TEMPLATE_FIELDS, ...APPENDIX_FIELDS];
    const required = allFields.filter((f) => f.required);
    return required.every((f) => {
        const el = document.getElementById(`field-${f.id}`);
        return el && el.value.trim() !== "";
    });
}
