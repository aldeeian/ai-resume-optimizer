import "server-only";

import React from "react";
import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";

import type { ParsedResume } from "@/lib/schemas";

/**
 * ATS-safe PDF: single column, real text (no images), standard section
 * headings, Helvetica. Rendered server-side with @react-pdf/renderer.
 */

const styles = StyleSheet.create({
  page: {
    paddingVertical: 36,
    paddingHorizontal: 40,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#111111",
    lineHeight: 1.35,
  },
  name: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
  },
  contactLine: {
    marginTop: 4,
    textAlign: "center",
    fontSize: 9,
    color: "#444444",
  },
  sectionHeading: {
    marginTop: 14,
    marginBottom: 4,
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    borderBottomWidth: 1,
    borderBottomColor: "#999999",
    paddingBottom: 2,
  },
  itemTitle: {
    marginTop: 6,
    fontSize: 10.5,
    fontFamily: "Helvetica-Bold",
  },
  itemMeta: {
    fontSize: 9,
    color: "#555555",
    marginBottom: 2,
  },
  bulletRow: {
    flexDirection: "row",
    marginBottom: 1.5,
  },
  bulletGlyph: {
    width: 10,
  },
  bulletText: {
    flex: 1,
  },
  paragraph: {
    marginBottom: 2,
  },
});

function Bullet({ children }: { children: string }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bulletGlyph}>•</Text>
      <Text style={styles.bulletText}>{children}</Text>
    </View>
  );
}

function ResumeDocument({ resume }: { resume: ParsedResume }) {
  const { contact } = resume;
  const contactLine = [contact.email, contact.phone, contact.location, ...contact.links]
    .filter(Boolean)
    .join("  |  ");

  return (
    <Document
      title={contact.name ? `${contact.name} — Resume` : "Resume"}
      author={contact.name || undefined}
    >
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.name}>{contact.name || "Resume"}</Text>
        {contactLine ? <Text style={styles.contactLine}>{contactLine}</Text> : null}

        {resume.summary ? (
          <View>
            <Text style={styles.sectionHeading}>Summary</Text>
            <Text style={styles.paragraph}>{resume.summary}</Text>
          </View>
        ) : null}

        {resume.skills.length > 0 ? (
          <View>
            <Text style={styles.sectionHeading}>Skills</Text>
            <Text style={styles.paragraph}>{resume.skills.join(", ")}</Text>
          </View>
        ) : null}

        {resume.experiences.length > 0 ? (
          <View>
            <Text style={styles.sectionHeading}>Experience</Text>
            {resume.experiences.map((exp, i) => {
              const dates = exp.current
                ? `${exp.startDate} – Present`
                : [exp.startDate, exp.endDate].filter(Boolean).join(" – ");
              const meta = [exp.location, dates].filter(Boolean).join("  |  ");
              return (
                <View key={i} wrap={false}>
                  <Text style={styles.itemTitle}>
                    {exp.title} — {exp.company}
                  </Text>
                  {meta ? <Text style={styles.itemMeta}>{meta}</Text> : null}
                  {exp.bullets.map((b, j) => (
                    <Bullet key={j}>{b}</Bullet>
                  ))}
                </View>
              );
            })}
          </View>
        ) : null}

        {resume.projects.length > 0 ? (
          <View>
            <Text style={styles.sectionHeading}>Projects</Text>
            {resume.projects.map((project, i) => (
              <View key={i} wrap={false}>
                <Text style={styles.itemTitle}>
                  {project.name}
                  {project.technologies.length > 0
                    ? `  (${project.technologies.join(", ")})`
                    : ""}
                </Text>
                {project.description ? (
                  <Text style={styles.paragraph}>{project.description}</Text>
                ) : null}
                {project.bullets.map((b, j) => (
                  <Bullet key={j}>{b}</Bullet>
                ))}
              </View>
            ))}
          </View>
        ) : null}

        {resume.education.length > 0 ? (
          <View>
            <Text style={styles.sectionHeading}>Education</Text>
            {resume.education.map((edu, i) => {
              const degree = [edu.degree, edu.field].filter(Boolean).join(", ");
              const dates = [edu.startDate, edu.endDate].filter(Boolean).join(" – ");
              const meta = [degree, dates, edu.gpa ? `GPA: ${edu.gpa}` : ""]
                .filter(Boolean)
                .join("  |  ");
              return (
                <View key={i} wrap={false}>
                  <Text style={styles.itemTitle}>{edu.institution}</Text>
                  {meta ? <Text style={styles.itemMeta}>{meta}</Text> : null}
                  {edu.highlights.map((h, j) => (
                    <Bullet key={j}>{h}</Bullet>
                  ))}
                </View>
              );
            })}
          </View>
        ) : null}
      </Page>
    </Document>
  );
}

export async function resumeToPdf(resume: ParsedResume): Promise<Buffer> {
  return renderToBuffer(<ResumeDocument resume={resume} />);
}
