import { createHash } from "node:crypto";
import JSZip from "jszip";
import mammoth from "mammoth";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export const MAX_MATERIAL_BYTES = 20 * 1024 * 1024;
export const ALLOWED_MATERIAL_EXTENSIONS = new Set(["pdf", "ppt", "pptx", "doc", "docx", "txt", "png", "jpg", "jpeg", "webp"]);

export type DocumentPage = { page: number; text: string };
export type ExtractedDocument = {
  sha256: string;
  pages: DocumentPage[];
  pageCount: number | null;
  status: "ready" | "partial" | "unsupported" | "failed";
  note?: string;
};

function extensionOf(fileName: string) {
  return fileName.split(".").pop()?.trim().toLowerCase() ?? "";
}

function decodeXml(value: string) {
  return value
    .replace(/<a:br\s*\/?\s*>/gi, "\n")
    .replace(/<\/a:p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, n: string) => String.fromCodePoint(Number(n)))
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

export async function extractDocument(fileName: string, mimeType: string, data: Buffer): Promise<ExtractedDocument> {
  if (data.byteLength === 0) throw new Error("The uploaded file is empty.");
  if (data.byteLength > MAX_MATERIAL_BYTES) throw new Error("Files must be 20 MB or smaller.");
  const ext = extensionOf(fileName);
  if (!ALLOWED_MATERIAL_EXTENSIONS.has(ext)) throw new Error("This file type is not supported.");
  const sha256 = createHash("sha256").update(data).digest("hex");

  if (ext === "txt") {
    return { sha256, pages: [{ page: 1, text: data.toString("utf8") }], pageCount: 1, status: "ready" };
  }

  if (ext === "pdf") {
    const doc = await getDocument({ data: new Uint8Array(data), useSystemFonts: true }).promise;
    const pages: DocumentPage[] = [];
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
      const page = await doc.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items
        .map(item => "str" in item ? item.str : "")
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      pages.push({ page: pageNumber, text });
    }
    const anyText = pages.some(p => p.text.length > 0);
    return { sha256, pages, pageCount: doc.numPages, status: anyText ? "ready" : "partial", note: anyText ? undefined : "No selectable text was found; this PDF may be scanned." };
  }

  if (ext === "docx") {
    const result = await mammoth.extractRawText({ buffer: data });
    const text = result.value.trim();
    return { sha256, pages: text ? [{ page: 1, text }] : [], pageCount: null, status: text ? "ready" : "partial", note: text ? undefined : "No readable text was found." };
  }

  if (ext === "pptx") {
    const zip = await JSZip.loadAsync(data);
    const slidePaths = Object.keys(zip.files)
      .filter(path => /^ppt\/slides\/slide\d+\.xml$/.test(path))
      .sort((a, b) => Number(a.match(/slide(\d+)/)?.[1]) - Number(b.match(/slide(\d+)/)?.[1]));
    const pages: DocumentPage[] = [];
    for (let i = 0; i < slidePaths.length; i += 1) {
      const xml = await zip.file(slidePaths[i]!)!.async("text");
      pages.push({ page: i + 1, text: decodeXml(xml) });
    }
    return { sha256, pages, pageCount: pages.length || null, status: pages.some(p => p.text) ? "ready" : "partial", note: pages.some(p => p.text) ? undefined : "No readable slide text was found." };
  }

  if (ext === "doc" || ext === "ppt") {
    return { sha256, pages: [], pageCount: null, status: "unsupported", note: `Stored as a study material (${ext.toUpperCase()}); convert to DOCX or PPTX for text extraction.` };
  }

  // Images are safely accepted and indexed as materials, but this app does not claim OCR support.
  return { sha256, pages: [], pageCount: null, status: "unsupported", note: `Stored as a study material (${mimeType || ext}); text extraction/OCR is not configured for images.` };
}

export function chunkDocument(pages: DocumentPage[], size = 1100, overlap = 140) {
  const chunks: Array<{ chunkIndex: number; pageNumber: number; chunkText: string }> = [];
  for (const page of pages) {
    const text = page.text.trim();
    if (!text) continue;
    let start = 0;
    while (start < text.length) {
      const end = Math.min(text.length, start + size);
      const chunkText = text.slice(start, end).trim();
      if (chunkText) chunks.push({ chunkIndex: chunks.length, pageNumber: page.page, chunkText });
      if (end === text.length) break;
      start = Math.max(start + 1, end - overlap);
    }
  }
  return chunks;
}

/** Transparent keyword/term retrieval fallback. This is not a vector-embedding search. */
export function rankPassages<T extends { pageNumber: number | null; chunkText: string }>(question: string, passages: T[], limit = 5): Array<T & { score: number }> {
  const terms = [...new Set((question.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []))];
  if (!terms.length) return [];
  return passages
    .map(passage => {
      const text = passage.chunkText.toLowerCase();
      const score = terms.reduce((sum, term) => sum + (text.includes(term) ? 1 + Math.min(2, (text.split(term).length - 1) * 0.12) : 0), 0);
      return { ...passage, score };
    })
    .filter(passage => passage.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
