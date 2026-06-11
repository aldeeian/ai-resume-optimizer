import { PageHeader } from "@/components/page-header";
import { ProfileForm } from "@/components/profile/profile-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { requireUser } from "@/server/users";

export const metadata = { title: "Profile" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await requireUser();

  const [resumeCount, generatedCount, applicationCount] = await Promise.all([
    db.resume.count({ where: { userId: user.id } }),
    db.generatedResume.count({ where: { userId: user.id } }),
    db.application.count({ where: { userId: user.id } }),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Profile" description="Your account details." />

      <Card>
        <CardHeader>
          <CardTitle>Personal information</CardTitle>
          <CardDescription>Shown on your dashboard greeting.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm
            initialFirstName={user.firstName ?? ""}
            initialLastName={user.lastName ?? ""}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="font-medium">{user.email}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Member since</dt>
              <dd className="font-medium">{formatDate(user.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Resumes</dt>
              <dd className="font-medium">{resumeCount}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Optimizations</dt>
              <dd className="font-medium">{generatedCount}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Applications tracked</dt>
              <dd className="font-medium">{applicationCount}</dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-muted-foreground">
            Email and password are managed through your sign-in provider (the avatar menu in the
            top right).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
