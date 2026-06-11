import "server-only";

import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";

import type { ParsedResume } from "@/lib/schemas";

/**
 * Generate an ATS-safe DOCX: single column, standard headings, no tables,
 * no text boxes, no images — everything a resume parser can read.
 */
export async function resumeToDocx(resume: ParsedResume): Promise<Buffer> {
  const children: Paragraph[] = [];
  const { contact } = resume;

  // ── Header ──────────────────────────────────────────────────────────────
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: contact.name || "Resume", bold: true, size: 32 })],
    })
  );
  const contactLine = [contact.email, contact.phone, contact.location, ...contact.links]
    .filter(Boolean)
    .join("  |  ");
  if (contactLine) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [new TextRun({ text: contactLine, size: 20 })],
      })
    );
  }

  const sectionHeading = (text: string) =>
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 240, after: 80 },
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 4, color: "999999" },
      },
      children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 22 })],
    });

  const bullet = (text: string) =>
    new Paragraph({
      bullet: { level: 0 },
      spacing: { after: 40 },
      children: [new TextRun({ text, size: 21 })],
    });

  // ── Summary ─────────────────────────────────────────────────────────────
  if (resume.summary) {
    children.push(sectionHeading("Summary"));
    children.push(
      new Paragraph({
        spacing: { after: 80 },
        children: [new TextRun({ text: resume.summary, size: 21 })],
      })
    );
  }

  // ── Skills ──────────────────────────────────────────────────────────────
  if (resume.skills.length > 0) {
    children.push(sectionHeading("Skills"));
    children.push(
      new Paragraph({
        spacing: { after: 80 },
        children: [new TextRun({ text: resume.skills.join(", "), size: 21 })],
      })
    );
  }

  // ── Experience ──────────────────────────────────────────────────────────
  if (resume.experiences.length > 0) {
    children.push(sectionHeading("Experience"));
    for (const exp of resume.experiences) {
      const dates = exp.current
        ? `${exp.startDate} – Present`
        : [exp.startDate, exp.endDate].filter(Boolean).join(" – ");
      children.push(
        new Paragraph({
          spacing: { before: 120 },
          children: [
            new TextRun({ text: `${exp.title} — ${exp.company}`, bold: true, size: 22 }),
          ],
        })
      );
      const meta = [exp.location, dates].filter(Boolean).join("  |  ");
      if (meta) {
        children.push(
          new Paragraph({
            spacing: { after: 40 },
            children: [new TextRun({ text: meta, italics: true, size: 20, color: "555555" })],
          })
        );
      }
      for (const b of exp.bullets) children.push(bullet(b));
    }
  }

  // ── Projects ────────────────────────────────────────────────────────────
  if (resume.projects.length > 0) {
    children.push(sectionHeading("Projects"));
    for (const project of resume.projects) {
      const tech =
        project.technologies.length > 0 ? `  (${project.technologies.join(", ")})` : "";
      children.push(
        new Paragraph({
          spacing: { before: 120 },
          children: [
            new TextRun({ text: project.name, bold: true, size: 22 }),
            new TextRun({ text: tech, italics: true, size: 20, color: "555555" }),
          ],
        })
      );
      if (project.description) {
        children.push(
          new Paragraph({
            spacing: { after: 40 },
            children: [new TextRun({ text: project.description, size: 21 })],
          })
        );
      }
      for (const b of project.bullets) children.push(bullet(b));
    }
  }

  // ── Education ───────────────────────────────────────────────────────────
  if (resume.education.length > 0) {
    children.push(sectionHeading("Education"));
    for (const edu of resume.education) {
      const degree = [edu.degree, edu.field].filter(Boolean).join(", ");
      const dates = [edu.startDate, edu.endDate].filter(Boolean).join(" – ");
      children.push(
        new Paragraph({
          spacing: { before: 120 },
          children: [new TextRun({ text: edu.institution, bold: true, size: 22 })],
        })
      );
      const meta = [degree, dates, edu.gpa ? `GPA: ${edu.gpa}` : ""].filter(Boolean).join("  |  ");
      if (meta) {
        children.push(
          new Paragraph({
            spacing: { after: 40 },
            children: [new TextRun({ text: meta, size: 20, color: "555555" })],
          })
        );
      }
      for (const h of edu.highlights) children.push(bullet(h));
    }
  }

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: "Calibri" } },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, bottom: 720, left: 720, right: 720 }, // 0.5" margins
          },
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}
