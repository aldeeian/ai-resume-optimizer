import "server-only";

import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";

import { ALLOWED_RESUME_EXTENSIONS, MAX_RESUME_FILE_BYTES } from "@/lib/schemas";

export type ResumeFileType = "PDF" | "DOCX" | "TXT";

export interface ExtractedFile {
  text: string;
  fileType: ResumeFileType;
}

export class FileValidationError extends Error {
  override name = "FileValidationError";
}

function extensionOf(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  return idx === -1 ? "" : fileName.slice(idx + 1).toLowerCase();
}

/**
 * Validate an uploaded resume file and extract its plain text.
 * Supports PDF (unpdf / pdf.js), DOCX (mammoth), and UTF-8 TXT.
 */
export async function extractResumeText(file: File): Promise<ExtractedFile> {
  if (file.size === 0) {
    throw new FileValidationError("The uploaded file is empty.");
  }
  if (file.size > MAX_RESUME_FILE_BYTES) {
    throw new FileValidationError("File is too large. The maximum size is 5 MB.");
  }

  const ext = extensionOf(file.name);
  if (!(ALLOWED_RESUME_EXTENSIONS as readonly string[]).includes(ext)) {
    throw new FileValidationError("Unsupported file type. Upload a PDF, DOCX, or TXT file.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let text: string;
  let fileType: ResumeFileType;

  switch (ext) {
    case "pdf": {
      fileType = "PDF";
      try {
        const pdf = await getDocumentProxy(new Uint8Array(buffer));
        const result = await extractText(pdf, { mergePages: true });
        text = result.text;
      } catch {
        throw new FileValidationError(
          "Could not read this PDF. It may be corrupted or password-protected."
        );
      }
      break;
    }
    case "docx": {
      fileType = "DOCX";
      try {
        const result = await mammoth.extractRawText({ buffer });
        text = result.value;
      } catch {
        throw new FileValidationError("Could not read this DOCX file. It may be corrupted.");
      }
      break;
    }
    default: {
      fileType = "TXT";
      text = buffer.toString("utf-8");
    }
  }

  const cleaned = normalizeWhitespace(text);
  if (cleaned.length < 100) {
    throw new FileValidationError(
      "We couldn't extract enough text from this file. If it's a scanned PDF, export a text-based version and try again."
    );
  }

  return { text: cleaned, fileType };
}

function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000\u00AD\u200B-\u200D\uFEFF]/g, "") // strip NUL, soft hyphen, zero-width chars
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
