import "server-only";

import { auth, currentUser } from "@clerk/nextjs/server";
import type { User } from "@prisma/client";

import { db } from "@/lib/db";

export class UnauthorizedError extends Error {
  override name = "UnauthorizedError";
  constructor() {
    super("You must be signed in to do that.");
  }
}

/**
 * Resolve the database User for the current Clerk session, creating the row
 * lazily on first authenticated request. Clerk remains the auth source of
 * truth; this row anchors all user-owned data.
 */
export async function requireUser(): Promise<User> {
  const { userId: clerkId } = await auth();
  if (!clerkId) throw new UnauthorizedError();

  const existing = await db.user.findUnique({ where: { clerkId } });
  if (existing) return existing;

  const clerkUser = await currentUser();
  if (!clerkUser) throw new UnauthorizedError();

  const email =
    clerkUser.primaryEmailAddress?.emailAddress ??
    clerkUser.emailAddresses[0]?.emailAddress;
  if (!email) {
    throw new Error("Your account has no email address; cannot create a profile.");
  }

  // Upsert on clerkId; if the email already exists from a previous account,
  // re-link it to the new Clerk identity.
  return db.user.upsert({
    where: { clerkId },
    update: {},
    create: {
      clerkId,
      email,
      firstName: clerkUser.firstName,
      lastName: clerkUser.lastName,
    },
  });
}
