// Main application logic
import { generateForm, getFormData, isFormValid } from "./form.js";
import { initPreview, renderPreview } from "./preview.js";
import {
    initGoogleAuth,
    requestAuth,
    isAuthenticated,
    createGoogleDoc,
    generatePlainText,
} from "./google-docs.js";

// ===== Config =====
// Google Cloud Console で取得した OAuth 2.0 Client ID をここに設定
// 空文字の場合、Google Docs 出力機能は無効化されます
const GOOGLE_CLIENT_ID = "858462833179-s3br03k4o3duulgn87a26v8jj3ct98nv.apps.googleusercontent.com";

// ===== App Init =====
document.addEventListener("DOMContentLoaded", async () => {
    const formContainer = document.getElementById("form-container");
    const previewContainer = document.getElementById("preview-container");
    const previewToolbar = document.getElementById("preview-toolbar");
    const btnExportDocs = document.getElementById("btn-export-docs");
    const btnDownloadText = document.getElementById("btn-download-text");

    // Initialize preview tabs
    initPreview(previewContainer, previewToolbar);

    // Generate form
    generateForm(formContainer, (data) => {
        renderPreview(previewContainer, data);
    });

    // Initial preview render
    renderPreview(previewContainer, getFormData());

    // Listen for tab changes
    document.addEventListener("tabchange", () => {
        renderPreview(previewContainer, getFormData());
    });

    // ===== Google Docs Export =====
    if (GOOGLE_CLIENT_ID) {
        try {
            await initGoogleAuth(GOOGLE_CLIENT_ID);
            btnExportDocs.disabled = false;
        } catch (err) {
            console.warn("Google API initialization failed:", err);
        }
    } else {
        btnExportDocs.title = "Google Client ID を設定してください";
    }

    btnExportDocs.addEventListener("click", async () => {
        if (!GOOGLE_CLIENT_ID) {
            showModal(
                "Google Docs連携の設定",
                `Google Docs にエクスポートするには、<strong>このアプリのコード</strong>に OAuth 2.0 クライアントIDを設定する必要があります。<br><br>
                <strong>手順：</strong><br>
                1. Google Cloud Console で「認証情報」→ OAuth 2.0 クライアントID（ウェブアプリケーション）の値をコピー<br>
                2. このリポジトリの <code>js/app.js</code> の <code>GOOGLE_CLIENT_ID</code> にその値を貼り付け<br>
                3. <code>firebase deploy</code> で再デプロイ（デプロイしないと本番サイトに反映されません）<br><br>
                承認済みの JavaScript 生成元に <code>https://agreementwriter.web.app</code> と <code>http://localhost:3000</code> が含まれているかも確認してください。<br><br>
                <a href="https://console.cloud.google.com/apis/credentials" target="_blank" style="color: var(--accent-light);">Google Cloud Console を開く →</a>`,
                [{ label: "閉じる", action: "close" }]
            );
            return;
        }

        if (!isAuthenticated()) {
            try {
                showToast("info", "Googleにログインしています...");
                await requestAuth();
                showToast("success", "Googleにログインしました");
            } catch (err) {
                showToast("error", "ログインに失敗しました");
                return;
            }
        }

        try {
            btnExportDocs.disabled = true;
            btnExportDocs.innerHTML = '<div class="loading-spinner"></div> 作成中...';

            const data = getFormData();
            const { contractText, appendixText } = generatePlainText(data);
            const title = `開発委託契約書_${data.client_name || "ドラフト"}_${new Date().toISOString().split("T")[0]}`;

            const result = await createGoogleDoc(title, contractText, appendixText);

            showModal(
                "✅ Google Docs に作成しました",
                `ドキュメントが作成されました。<br><br>
        <a href="${result.url}" target="_blank" style="color: var(--accent-light); font-weight: 600;">
          📄 ${title} を開く →
        </a>`,
                [{ label: "閉じる", action: "close" }]
            );

            showToast("success", "Google Docs にドキュメントを作成しました");
        } catch (err) {
            showToast("error", `エラー: ${err.message}`);
        } finally {
            btnExportDocs.disabled = false;
            btnExportDocs.innerHTML = '<span class="btn-icon">📤</span> Google Docs に出力';
        }
    });

    // ===== Download Text =====
    btnDownloadText.addEventListener("click", () => {
        const data = getFormData();
        const { contractText, appendixText } = generatePlainText(data);
        const fullText =
            contractText + "\n\n" + "═".repeat(50) + "\n\n" + appendixText;

        const blob = new Blob([fullText], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `開発委託契約書_${data.client_name || "ドラフト"}_${new Date().toISOString().split("T")[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast("success", "テキストファイルをダウンロードしました");
    });
});

// ===== Toast notifications =====
function showToast(type, message) {
    const container =
        document.querySelector(".toast-container") || createToastContainer();
    const icons = { success: "✅", error: "❌", info: "ℹ️" };
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${icons[type] || ""}</span> ${message}`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateX(100%)";
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function createToastContainer() {
    const container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
    return container;
}

// ===== Modal =====
function showModal(title, content, buttons) {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
    <div class="modal">
      <h3>${title}</h3>
      <p>${content}</p>
      <div class="modal-actions">
        ${buttons
            .map(
                (b) =>
                    `<button class="btn btn-${b.action === "close" ? "secondary" : "primary"}" data-action="${b.action}">${b.label}</button>`
            )
            .join("")}
      </div>
    </div>
  `;

    document.body.appendChild(overlay);

    // Animate in
    requestAnimationFrame(() => overlay.classList.add("active"));

    // Handle close
    overlay.querySelectorAll("button").forEach((btn) => {
        btn.addEventListener("click", () => {
            overlay.classList.remove("active");
            setTimeout(() => overlay.remove(), 300);
        });
    });

    overlay.addEventListener("click", (e) => {
        if (e.target === overlay) {
            overlay.classList.remove("active");
            setTimeout(() => overlay.remove(), 300);
        }
    });
}
