import { Badge, type BadgeProps } from "@/components/ui/badge";

export function SkillBadges({
  skills,
  variant = "secondary",
  max,
}: {
  skills: string[];
  variant?: BadgeProps["variant"];
  max?: number;
}) {
  if (skills.length === 0) {
    return <p className="text-sm text-muted-foreground">None</p>;
  }
  const visible = max ? skills.slice(0, max) : skills;
  const hidden = skills.length - visible.length;
  return (
    <div className="flex flex-wrap gap-1.5">
      {visible.map((skill, i) => (
        <Badge key={`${skill}-${i}`} variant={variant}>
          {skill}
        </Badge>
      ))}
      {hidden > 0 ? <Badge variant="outline">+{hidden} more</Badge> : null}
    </div>
  );
}
