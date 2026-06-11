import { NextResponse } from "next/server";

import { resumeToPlainText } from "@/lib/ats/score";
import { db } from "@/lib/db";
import { resumeToDocx } from "@/lib/export/docx";
import { resumeToPdf } from "@/lib/export/pdf";
import { parsedResumeSchema } from "@/lib/schemas";
import { requireUser, UnauthorizedError } from "@/server/users";

export const dynamic = "force-dynamic";

const CONTENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain; charset=utf-8",
};

function safeFileName(base: string, ext: string): string {
  const cleaned = base.replace(/[^a-zA-Z0-9 _-]/g, "").trim() || "resume";
  return `${cleaned.replace(/\s+/g, "_")}.${ext}`;
}

/** Export a generated resume as PDF, DOCX, or TXT (ownership enforced). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; format: string }> }
) {
  try {
    const { id, format } = await params;
    const contentType = CONTENT_TYPES[format];
    if (!contentType) {
      return NextResponse.json(
        { error: "Unsupported format. Use pdf, docx, or txt." },
        { status: 400 }
      );
    }

    const user = await requireUser();
    const row = await db.generatedResume.findFirst({
      where: { id, userId: user.id },
      include: { jobDescription: { select: { company: true, title: true } } },
    });
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const content = parsedResumeSchema.parse(row.content);
    const baseName = `${content.contact.name || "Resume"} ${row.jobDescription.company}`;

    let body: Buffer | string;
    switch (format) {
      case "pdf":
        body = await resumeToPdf(content);
        break;
      case "docx":
        body = await resumeToDocx(content);
        break;
      default:
        body = resumeToPlainText(content);
    }

    return new NextResponse(typeof body === "string" ? body : new Uint8Array(body), {
      headers: {
        "content-type": contentType,
        "content-disposition": `attachment; filename="${safeFileName(baseName, format)}"`,
        "cache-control": "private, no-store",
      },
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/export failed:", err);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
