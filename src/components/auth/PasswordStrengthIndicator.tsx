import { useMemo } from "react";
import { Check, X } from "lucide-react";

interface PasswordStrengthIndicatorProps {
  password: string;
}

const criteria = [
  { label: "At least 6 characters", test: (p: string) => p.length >= 6 },
  { label: "Uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { label: "Lowercase letter", test: (p: string) => /[a-z]/.test(p) },
  { label: "Number", test: (p: string) => /\d/.test(p) },
  { label: "Special character", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

export default function PasswordStrengthIndicator({ password }: PasswordStrengthIndicatorProps) {
  const passed = useMemo(() => criteria.filter((c) => c.test(password)).length, [password]);

  const strength = passed <= 2 ? "Weak" : passed <= 3 ? "Fair" : passed <= 4 ? "Good" : "Strong";
  const color =
    passed <= 2
      ? "bg-destructive"
      : passed <= 3
        ? "bg-yellow-500"
        : passed <= 4
          ? "bg-blue-500"
          : "bg-green-500";

  if (!password) return null;

  return (
    <div className="space-y-2 pt-1">
      <div className="flex items-center gap-2">
        <div className="flex-1 flex gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${i < passed ? color : "bg-muted"}`}
            />
          ))}
        </div>
        <span className="text-xs font-medium text-muted-foreground">{strength}</span>
      </div>
      <ul className="grid grid-cols-2 gap-x-2 gap-y-0.5">
        {criteria.map((c) => {
          const met = c.test(password);
          return (
            <li key={c.label} className="flex items-center gap-1 text-xs">
              {met ? (
                <Check className="h-3 w-3 text-green-500" />
              ) : (
                <X className="h-3 w-3 text-muted-foreground" />
              )}
              <span className={met ? "text-foreground" : "text-muted-foreground"}>{c.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
