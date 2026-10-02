// Mobbin reference: Tally onboarding, one narrow centered column with a few
// stacked fields and one button.
// https://mobbin.com/flows/4ad8acc8-87b1-4bf6-9a97-58aff989c810
"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Field, fieldControlProps } from "@/components/post/field";
import { GradYearSelect } from "@/components/profile/grad-year-select";
import { MajorPicker } from "@/components/profile/major-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { saveMyProfile } from "@/lib/db";
import type { Profile, Role } from "@/lib/types";

type Props = {
  role: Role;
  profile: Profile | null;
  onDone: (profile: Profile) => void;
};

// One screen per role. Only the name is needed, the rest can wait.
export function DetailsStep({ role, profile, onDone }: Props) {
  const [fullName, setFullName] = useState(profile?.fullName ?? "");
  const [major, setMajor] = useState(profile?.major ?? "");
  const [gradYear, setGradYear] = useState(profile?.gradYear ? String(profile.gradYear) : "");
  const [department, setDepartment] = useState(profile?.department ?? "");
  const [company, setCompany] = useState(profile?.company ?? "");
  const [visible, setVisible] = useState(profile?.recruiterVisible ?? false);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const nameIssues =
    submitted && !fullName.trim() ? [{ message: "Enter your name.", severity: "error" as const }] : [];

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (!fullName.trim()) {
      document.getElementById("welcome-name")?.focus();
      return;
    }

    setSaving(true);
    try {
      const saved = await saveMyProfile({
        fullName: fullName.trim(),
        ...(role === "student" && {
          major: major.trim(),
          gradYear: gradYear ? Number(gradYear) : null,
          recruiterVisible: visible,
        }),
        ...(role === "faculty" && { department: department.trim() }),
        ...(role === "recruiter" && { company: company.trim() }),
      });
      onDone(saved);
    } catch {
      toast.error("Could not save. Try again.");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight text-balance">About you</h1>

      <div className="flex flex-col gap-4">
        <Field id="welcome-name" label="Name" issues={nameIssues}>
          <Input
            {...fieldControlProps("welcome-name", nameIssues)}
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            name="name"
            type="text"
            autoComplete="name"
            autoFocus
            required
            maxLength={120}
          />
        </Field>

        {role === "student" && (
          <>
            <Field id="welcome-major" label="Major">
              <MajorPicker id="welcome-major" value={major} onChange={setMajor} />
            </Field>
            <Field id="welcome-year" label="Graduation year">
              <GradYearSelect id="welcome-year" value={gradYear} onChange={setGradYear} />
            </Field>
            <div className="flex items-center justify-between gap-4 rounded-lg border px-3 py-2.5">
              <span id="welcome-visible-label" className="text-sm font-medium">
                Visible to recruiters
              </span>
              <Switch
                checked={visible}
                onCheckedChange={setVisible}
                aria-labelledby="welcome-visible-label"
              />
            </div>
          </>
        )}

        {role === "faculty" && (
          <Field id="welcome-department" label="Department">
            <Input
              id="welcome-department"
              value={department}
              onChange={(event) => setDepartment(event.target.value)}
              name="department"
              type="text"
              autoComplete="off"
              maxLength={120}
            />
          </Field>
        )}

        {role === "recruiter" && (
          <Field id="welcome-company" label="Company">
            <Input
              id="welcome-company"
              value={company}
              onChange={(event) => setCompany(event.target.value)}
              name="organization"
              type="text"
              autoComplete="organization"
              maxLength={120}
            />
          </Field>
        )}
      </div>

      <Button type="submit" size="lg" className="h-10" disabled={saving}>
        {saving && <Loader2 aria-hidden className="animate-spin motion-reduce:animate-none" />}
        {saving ? "Saving" : "Finish"}
      </Button>
    </form>
  );
}
