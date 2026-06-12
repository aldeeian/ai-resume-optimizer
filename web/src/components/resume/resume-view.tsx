import { ExternalLink } from "lucide-react";

import { EvidenceBullet, evidenceLookup } from "@/components/generated/evidence-bullet";
import { SkillBadges } from "@/components/skill-badges";
import { Separator } from "@/components/ui/separator";
import type { BulletEvidence, ParsedResume } from "@/lib/schemas";

/**
 * Read-only rendering of a structured resume (uploaded or generated).
 * When `evidence` is provided (generated resumes), every bullet renders its
 * provenance badge linking it back to the master resume.
 */
export function ResumeView({
  resume,
  evidence,
}: {
  resume: ParsedResume;
  evidence?: BulletEvidence[];
}) {
  const { contact } = resume;
  const contactItems = [contact.email, contact.phone, contact.location].filter(Boolean);
  const byLocation = evidence && evidence.length > 0 ? evidenceLookup(evidence) : null;

  return (
    <article className="space-y-6">
      {/* Header */}
      <header className="text-center">
        <h2 className="text-xl font-bold">{contact.name || "Resume"}</h2>
        {contactItems.length > 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">{contactItems.join("  ·  ")}</p>
        ) : null}
        {contact.links.length > 0 ? (
          <p className="mt-1 flex flex-wrap items-center justify-center gap-x-3 text-sm">
            {contact.links.map((link) => (
              <a
                key={link}
                href={link.startsWith("http") ? link : `https://${link}`}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                {link.replace(/^https?:\/\//, "")}
                <ExternalLink className="h-3 w-3" aria-hidden />
              </a>
            ))}
          </p>
        ) : null}
      </header>

      {resume.summary ? (
        <section aria-labelledby="rv-summary">
          <h3 id="rv-summary" className="text-sm font-semibold uppercase tracking-wide">
            Summary
          </h3>
          <Separator className="my-2" />
          <p className="text-sm leading-relaxed">
            {byLocation ? (
              <EvidenceBullet text={resume.summary} evidence={byLocation.get("summary:0:0")} />
            ) : (
              resume.summary
            )}
          </p>
        </section>
      ) : null}

      {resume.skills.length > 0 ? (
        <section aria-labelledby="rv-skills">
          <h3 id="rv-skills" className="text-sm font-semibold uppercase tracking-wide">
            Skills
          </h3>
          <Separator className="my-2" />
          <SkillBadges skills={resume.skills} />
        </section>
      ) : null}

      {resume.experiences.length > 0 ? (
        <section aria-labelledby="rv-experience">
          <h3 id="rv-experience" className="text-sm font-semibold uppercase tracking-wide">
            Experience
          </h3>
          <Separator className="my-2" />
          <div className="space-y-4">
            {resume.experiences.map((exp, i) => {
              const dates = exp.current
                ? `${exp.startDate} – Present`
                : [exp.startDate, exp.endDate].filter(Boolean).join(" – ");
              return (
                <div key={i}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                    <p className="font-medium">
                      {exp.title} <span className="text-muted-foreground">·</span> {exp.company}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {[exp.location, dates].filter(Boolean).join("  ·  ")}
                    </p>
                  </div>
                  <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm leading-relaxed">
                    {exp.bullets.map((bullet, j) => (
                      <li key={j}>
                        {byLocation ? (
                          <EvidenceBullet
                            text={bullet}
                            evidence={byLocation.get(`experience:${i}:${j}`)}
                          />
                        ) : (
                          bullet
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {resume.projects.length > 0 ? (
        <section aria-labelledby="rv-projects">
          <h3 id="rv-projects" className="text-sm font-semibold uppercase tracking-wide">
            Projects
          </h3>
          <Separator className="my-2" />
          <div className="space-y-4">
            {resume.projects.map((project, i) => (
              <div key={i}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                  <p className="font-medium">{project.name}</p>
                  {project.technologies.length > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {project.technologies.join(", ")}
                    </p>
                  ) : null}
                </div>
                {project.description ? (
                  <p className="mt-1 text-sm text-muted-foreground">{project.description}</p>
                ) : null}
                <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm leading-relaxed">
                  {project.bullets.map((bullet, j) => (
                    <li key={j}>
                      {byLocation ? (
                        <EvidenceBullet
                          text={bullet}
                          evidence={byLocation.get(`project:${i}:${j}`)}
                        />
                      ) : (
                        bullet
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {resume.education.length > 0 ? (
        <section aria-labelledby="rv-education">
          <h3 id="rv-education" className="text-sm font-semibold uppercase tracking-wide">
            Education
          </h3>
          <Separator className="my-2" />
          <div className="space-y-3">
            {resume.education.map((edu, i) => {
              const degree = [edu.degree, edu.field].filter(Boolean).join(", ");
              const dates = [edu.startDate, edu.endDate].filter(Boolean).join(" – ");
              return (
                <div key={i}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                    <p className="font-medium">{edu.institution}</p>
                    <p className="text-xs text-muted-foreground">{dates}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {[degree, edu.gpa ? `GPA: ${edu.gpa}` : ""].filter(Boolean).join("  ·  ")}
                  </p>
                  {edu.highlights.length > 0 ? (
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                      {edu.highlights.map((h, j) => (
                        <li key={j}>{h}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
    </article>
  );
}
