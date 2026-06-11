import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import {
  ArrowRight,
  FileSearch,
  FileText,
  Gauge,
  GitCompareArrows,
  KanbanSquare,
  ShieldCheck,
  Sparkles,
  Target,
  Upload,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const features = [
  {
    icon: FileSearch,
    title: "Job Description Analysis",
    description:
      "Paste any posting and instantly see required skills, preferred skills, technologies, keywords, and responsibilities.",
  },
  {
    icon: Target,
    title: "Experience & Project Ranking",
    description:
      "Every experience and project is scored against the job with transparent reasoning, so the most relevant work leads.",
  },
  {
    icon: Sparkles,
    title: "Truthful AI Tailoring",
    description:
      "Bullets are rewritten in your voice with the job's language — never fabricated experience, metrics, or skills.",
  },
  {
    icon: Gauge,
    title: "ATS Score Engine",
    description:
      "A deterministic 0–100 score across keywords, skills, experience, projects, and formatting — with a full breakdown.",
  },
  {
    icon: GitCompareArrows,
    title: "Side-by-Side Comparison",
    description:
      "See exactly what changed: added keywords, rewritten bullets, and content that was trimmed for relevance.",
  },
  {
    icon: KanbanSquare,
    title: "Application Tracker",
    description:
      "Track every application from saved to offer, with response-rate analytics and your average ATS score over time.",
  },
];

const steps = [
  {
    icon: Upload,
    step: "1",
    title: "Upload your master resume",
    description: "PDF, DOCX, or TXT. We parse your education, skills, experience, and projects automatically.",
  },
  {
    icon: FileSearch,
    step: "2",
    title: "Paste a job description",
    description: "The analyzer extracts everything the employer is actually screening for.",
  },
  {
    icon: Sparkles,
    step: "3",
    title: "Generate & export",
    description: "Get a tailored, ATS-scored resume in seconds. Export to PDF, DOCX, or TXT and track the application.",
  },
];

export default async function LandingPage() {
  const { userId } = await auth();
  const ctaHref = userId ? "/dashboard" : "/sign-up";

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <FileText className="h-5 w-5 text-primary" aria-hidden />
            <span>ResumeForge</span>
          </Link>
          <nav className="flex items-center gap-2">
            {userId ? (
              <Button asChild>
                <Link href="/dashboard">
                  Dashboard <ArrowRight aria-hidden />
                </Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" asChild>
                  <Link href="/sign-in">Sign in</Link>
                </Button>
                <Button asChild>
                  <Link href="/sign-up">Get started</Link>
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6 sm:py-28">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
            Truthful by design — no fabricated experience, ever
          </div>
          <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
            Tailor your resume to any job in <span className="text-primary">minutes</span>, not hours
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Upload your master resume once. ResumeForge analyzes each job description, ranks your
            most relevant experience, and generates an ATS-optimized resume — then tracks every
            application until the offer.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <Link href={ctaHref}>
                Optimize my resume <ArrowRight aria-hidden />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="#how-it-works">See how it works</Link>
            </Button>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="border-y bg-muted/40">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <h2 className="text-center text-3xl font-bold tracking-tight">How it works</h2>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {steps.map(({ icon: Icon, step, title, description }) => (
                <Card key={step}>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" aria-hidden />
                      </div>
                      <span className="text-sm font-medium text-muted-foreground">Step {step}</span>
                    </div>
                    <h3 className="mt-4 font-semibold">{title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">{description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="text-center text-3xl font-bold tracking-tight">
            Everything you need to land the interview
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground">
            Built for students applying to dozens of internships — without copy-pasting bullets at
            midnight.
          </p>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, description }) => (
              <Card key={title} className="transition-shadow hover:shadow-md">
                <CardContent className="p-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" aria-hidden />
                  </div>
                  <h3 className="mt-4 font-semibold">{title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="border-t bg-muted/40">
          <div className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6">
            <h2 className="text-3xl font-bold tracking-tight">
              Stop rewriting your resume by hand
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              Join students who tailor every application in minutes and track their entire search in
              one place.
            </p>
            <Button size="lg" className="mt-8" asChild>
              <Link href={ctaHref}>
                Get started — it&apos;s free <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4" aria-hidden />
            <span>ResumeForge © {new Date().getFullYear()}</span>
          </div>
          <p>Built with Next.js, FastAPI, and Claude.</p>
        </div>
      </footer>
    </div>
  );
}
