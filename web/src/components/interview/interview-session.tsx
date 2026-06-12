"use client";

import { useState, useTransition } from "react";
import { ArrowRight, CheckCircle2, Lightbulb, Loader2, Send, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { cn, scoreColor } from "@/lib/utils";
import type { InterviewAnswer, InterviewQuestion, StarAnalysis } from "@/lib/schemas";
import { submitInterviewAnswer } from "@/server/actions/interviews";

const TYPE_LABELS: Record<InterviewQuestion["type"], string> = {
  behavioral: "Behavioral",
  technical: "Technical",
  resume: "About your resume",
};

const TYPE_STYLES: Record<InterviewQuestion["type"], string> = {
  behavioral: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  technical: "bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-400",
  resume: "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-400",
};

function QuestionBadges({ question }: { question: InterviewQuestion }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="secondary" className={TYPE_STYLES[question.type]}>
        {TYPE_LABELS[question.type]}
      </Badge>
      {question.focusArea ? (
        <Badge variant="outline">{question.focusArea}</Badge>
      ) : null}
    </div>
  );
}

function StarChecklist({ star }: { star: StarAnalysis }) {
  const parts: Array<{ label: string; ok: boolean }> = [
    { label: "Situation", ok: star.situation },
    { label: "Task", ok: star.task },
    { label: "Action", ok: star.action },
    { label: "Result", ok: star.result },
  ];
  return (
    <div>
      <p className="text-sm font-medium">STAR structure</p>
      <div className="mt-1.5 flex flex-wrap gap-3">
        {parts.map((part) => (
          <span key={part.label} className="inline-flex items-center gap-1 text-sm">
            {part.ok ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />
            ) : (
              <XCircle className="h-4 w-4 text-muted-foreground" aria-hidden />
            )}
            {part.label}
          </span>
        ))}
      </div>
      {star.note ? <p className="mt-1 text-sm text-muted-foreground">{star.note}</p> : null}
    </div>
  );
}

function FeedbackCard({ answer }: { answer: InterviewAnswer }) {
  const { feedback } = answer;
  return (
    <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Coach feedback</p>
        <p className={cn("text-2xl font-bold", scoreColor(feedback.score))}>
          {feedback.score}
          <span className="text-sm font-normal text-muted-foreground">/100</span>
        </p>
      </div>

      {feedback.strengths.length > 0 ? (
        <div>
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
            What worked
          </p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
            {feedback.strengths.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {feedback.improvements.length > 0 ? (
        <div>
          <p className="text-sm font-medium text-amber-700 dark:text-amber-400">To improve</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
            {feedback.improvements.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {feedback.star ? <StarChecklist star={feedback.star} /> : null}

      {feedback.exampleAnswer ? (
        <div className="rounded-md border bg-background p-3">
          <p className="inline-flex items-center gap-1.5 text-sm font-medium">
            <Lightbulb className="h-4 w-4 text-amber-500" aria-hidden /> A strong answer
          </p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {feedback.exampleAnswer}
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function InterviewSessionClient({
  sessionId,
  questions,
  initialAnswers,
  overallScore,
}: {
  sessionId: string;
  questions: InterviewQuestion[];
  initialAnswers: InterviewAnswer[];
  overallScore: number | null;
}) {
  const [answers, setAnswers] = useState<InterviewAnswer[]>(initialAnswers);
  const [finalScore, setFinalScore] = useState<number | null>(overallScore);
  const [draft, setDraft] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);
  const [pending, startTransition] = useTransition();

  const completed = answers.length >= questions.length;
  const current = completed ? null : questions[answers.length];
  const lastAnswer = answers[answers.length - 1];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!current) return;
    startTransition(async () => {
      const result = await submitInterviewAnswer({
        sessionId,
        questionId: current.id,
        answer: draft,
      });
      if (result.ok) {
        setAnswers((prev) => [
          ...prev,
          { questionId: current.id, answer: draft, feedback: result.data.feedback },
        ]);
        setFinalScore(result.data.overallScore);
        setDraft("");
        setShowFeedback(true);
      } else {
        toast.error(result.error);
      }
    });
  };

  // ── Review screen: feedback for the answer just submitted ─────────────────
  if (showFeedback && lastAnswer) {
    const question = questions.find((q) => q.id === lastAnswer.questionId);
    return (
      <div className="space-y-6">
        <Progress value={(answers.length / questions.length) * 100} aria-label="Progress" />
        <Card>
          <CardHeader className="space-y-3">
            {question ? <QuestionBadges question={question} /> : null}
            <CardTitle className="text-lg leading-snug">{question?.question}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border p-4">
              <p className="text-sm font-medium text-muted-foreground">Your answer</p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
                {lastAnswer.answer}
              </p>
            </div>
            <FeedbackCard answer={lastAnswer} />
            <Button onClick={() => setShowFeedback(false)} size="lg">
              {answers.length >= questions.length ? "See your results" : "Next question"}{" "}
              <ArrowRight aria-hidden />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Summary screen ─────────────────────────────────────────────────────────
  if (completed) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Interview complete</CardTitle>
          </CardHeader>
          <CardContent className="flex items-baseline gap-3">
            <p className={cn("text-5xl font-bold", scoreColor(finalScore ?? 0))}>
              {finalScore ?? "—"}
            </p>
            <p className="text-muted-foreground">/ 100 overall</p>
          </CardContent>
        </Card>

        {questions.map((question, i) => {
          const answer = answers.find((a) => a.questionId === question.id);
          if (!answer) return null;
          return (
            <Card key={question.id}>
              <CardHeader className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <QuestionBadges question={question} />
                  <p className={cn("text-lg font-bold", scoreColor(answer.feedback.score))}>
                    {answer.feedback.score}
                  </p>
                </div>
                <CardTitle className="text-base leading-snug">
                  {i + 1}. {question.question}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border p-4">
                  <p className="text-sm font-medium text-muted-foreground">Your answer</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
                    {answer.answer}
                  </p>
                </div>
                <FeedbackCard answer={answer} />
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  }

  // ── Answering screen ───────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <p>
            Question {answers.length + 1} of {questions.length}
          </p>
          {answers.length > 0 ? (
            <p>
              Average so far:{" "}
              <span
                className={cn(
                  "font-semibold",
                  scoreColor(
                    Math.round(
                      answers.reduce((sum, a) => sum + a.feedback.score, 0) / answers.length
                    )
                  )
                )}
              >
                {Math.round(
                  answers.reduce((sum, a) => sum + a.feedback.score, 0) / answers.length
                )}
              </span>
            </p>
          ) : null}
        </div>
        <Progress value={(answers.length / questions.length) * 100} aria-label="Progress" />
      </div>

      <Card>
        <CardHeader className="space-y-3">
          {current ? <QuestionBadges question={current} /> : null}
          <CardTitle className="text-lg leading-snug">{current?.question}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Answer as you would out loud in a real interview. For behavioral questions, try the STAR structure: Situation, Task, Action, Result."
              rows={8}
              disabled={pending}
              aria-label="Your answer"
            />
            <div className="flex items-center justify-between gap-4">
              <p className="text-xs text-muted-foreground">
                {draft.trim().length < 20
                  ? "Write at least a few sentences."
                  : `${draft.trim().length.toLocaleString()} characters`}
              </p>
              <Button type="submit" disabled={pending || draft.trim().length < 20}>
                {pending ? (
                  <>
                    <Loader2 className="animate-spin" aria-hidden /> Scoring your answer…
                  </>
                ) : (
                  <>
                    <Send aria-hidden /> Submit answer
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
