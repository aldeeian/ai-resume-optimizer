import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requireUser, UnauthorizedError } from "@/server/users";

export const dynamic = "force-dynamic";

/** Tracker list, consumed by React Query on the tracker page. */
export async function GET() {
  try {
    const user = await requireUser();
    const applications = await db.application.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        jobDescription: { select: { id: true, title: true, company: true } },
        generatedResume: { select: { id: true, atsScore: true } },
      },
    });
    return NextResponse.json({ applications });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/applications failed:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
