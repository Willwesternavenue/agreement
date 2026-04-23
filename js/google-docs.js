// Google Docs API integration
// Uses Google Identity Services (GIS) for OAuth 2.0

const SCOPES = "https://www.googleapis.com/auth/documents https://www.googleapis.com/auth/drive.file";

let tokenClient = null;
let accessToken = null;

// Initialize Google API client
export function initGoogleAuth(clientId) {
    return new Promise((resolve, reject) => {
        if (!clientId) {
            reject(new Error("Google Client ID が設定されていません"));
            return;
        }

        // Load GIS script
        const script = document.createElement("script");
        script.src = "https://accounts.google.com/gsi/client";
        script.onload = () => {
            tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: clientId,
                scope: SCOPES,
                callback: (response) => {
                    if (response.error) {
                        reject(response);
                    } else {
                        accessToken = response.access_token;
                        resolve(response);
                    }
                },
            });
            resolve(true);
        };
        script.onerror = () => reject(new Error("Google API の読み込みに失敗しました"));
        document.head.appendChild(script);
    });
}

export function requestAuth() {
    return new Promise((resolve, reject) => {
        if (!tokenClient) {
            reject(new Error("Google API が初期化されていません"));
            return;
        }
        tokenClient.callback = (response) => {
            if (response.error) {
                reject(response);
            } else {
                accessToken = response.access_token;
                resolve(response);
            }
        };
        tokenClient.requestAccessToken({ prompt: "consent" });
    });
}

export function isAuthenticated() {
    return !!accessToken;
}

// Create a Google Doc with the contract content
export async function createGoogleDoc(title, contractText, appendixText) {
    if (!accessToken) {
        throw new Error("認証されていません。先にGoogleにログインしてください。");
    }

    // Step 1: Create blank document
    const createResponse = await fetch("https://docs.googleapis.com/v1/documents", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ title }),
    });

    if (!createResponse.ok) {
        const err = await createResponse.json();
        throw new Error(`ドキュメント作成に失敗しました: ${err.error?.message || "Unknown error"}`);
    }

    const doc = await createResponse.json();
    const documentId = doc.documentId;

    // Step 2: Build requests to insert content
    const requests = buildDocumentRequests(contractText, appendixText);

    // Step 3: Batch update the document
    const updateResponse = await fetch(
        `https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ requests }),
        }
    );

    if (!updateResponse.ok) {
        const err = await updateResponse.json();
        throw new Error(`ドキュメント更新に失敗しました: ${err.error?.message || "Unknown error"}`);
    }

    return {
        documentId,
        url: `https://docs.google.com/document/d/${documentId}/edit`,
    };
}

function buildDocumentRequests(contractText, appendixText) {
    const requests = [];

    // Combine contract and appendix with a page break between them
    const fullText = contractText + "\n\n" + "─".repeat(40) + "\n\n" + appendixText;

    // Insert the full text first
    requests.push({
        insertText: {
            location: { index: 1 },
            text: fullText,
        },
    });

    // Find and style the title
    const titleEnd = fullText.indexOf("\n");
    if (titleEnd > 0) {
        // Center-align title
        requests.push({
            updateParagraphStyle: {
                range: { startIndex: 1, endIndex: titleEnd + 1 },
                paragraphStyle: {
                    alignment: "CENTER",
                    spaceAbove: { magnitude: 24, unit: "PT" },
                    spaceBelow: { magnitude: 24, unit: "PT" },
                },
                fields: "alignment,spaceAbove,spaceBelow",
            },
        });

        // Bold and larger font for title
        requests.push({
            updateTextStyle: {
                range: { startIndex: 1, endIndex: titleEnd + 1 },
                textStyle: {
                    bold: true,
                    fontSize: { magnitude: 16, unit: "PT" },
                },
                fields: "bold,fontSize",
            },
        });
    }

    // Style section headers (第X条)
    const sectionRegex = /第\d+条（[^）]+）/g;
    let match;
    while ((match = sectionRegex.exec(fullText)) !== null) {
        const startIdx = match.index + 1;
        const endIdx = startIdx + match[0].length;
        requests.push({
            updateTextStyle: {
                range: { startIndex: startIdx, endIndex: endIdx },
                textStyle: { bold: true },
                fields: "bold",
            },
        });
    }

    // Set the whole document font size only (font family causes "Unknown name fontFamily" in some API versions)
    requests.push({
        updateTextStyle: {
            range: { startIndex: 1, endIndex: fullText.length + 1 },
            textStyle: {
                fontSize: { magnitude: 10.5, unit: "PT" },
            },
            fields: "fontSize",
        },
    });

    return requests;
}

// Generate plain text (no HTML) from template
import { CONTRACT_TEMPLATE, APPENDIX_TEMPLATE } from "./template.js";

export function generatePlainText(data) {
    const contractText = CONTRACT_TEMPLATE.replace(
        /\{\{(\w+)\}\}/g,
        (match, key) => data[key] || "【未入力】"
    );
    const appendixText = APPENDIX_TEMPLATE.replace(
        /\{\{(\w+)\}\}/g,
        (match, key) => data[key] || "【未入力】"
    );
    return { contractText, appendixText };
}
