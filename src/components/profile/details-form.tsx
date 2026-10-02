// Mobbin reference: Mercor profile (web), stacked labelled fields with select and search-and-select controls.
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Field, fieldControlProps } from "@/components/post/field";
import { GradYearSelect } from "@/components/profile/grad-year-select";
import { MajorPicker } from "@/components/profile/major-picker";
import {
  BIO_LIMIT,
  errorMessage,
  urlError,
  useUnsavedWarning,
} from "@/components/profile/profile-utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveMyProfile } from "@/lib/db";
import { cn } from "@/lib/utils";
import type { Profile } from "@/lib/types";

type Values = {
  fullName: string;
  major: string;
  gradYear: string;
  department: string;
  company: string;
  bio: string;
  linkedinUrl: string;
  githubUrl: string;
};
type FieldName = keyof Values;

const FIELD_ORDER: FieldName[] = [
  "fullName",
  "major",
  "gradYear",
  "department",
  "company",
  "bio",
  "linkedinUrl",
  "githubUrl",
];

function toValues(profile: Profile | null): Values {
  return {
    fullName: profile?.fullName ?? "",
    major: profile?.major ?? "",
    gradYear: profile?.gradYear ? String(profile.gradYear) : "",
    department: profile?.department ?? "",
    company: profile?.company ?? "",
    bio: profile?.bio ?? "",
    linkedinUrl: profile?.linkedinUrl ?? "",
    githubUrl: profile?.githubUrl ?? "",
  };
}

function validate(values: Values): Partial<Record<FieldName, string>> {
  const errors: Partial<Record<FieldName, string>> = {};
  if (!values.fullName.trim()) errors.fullName = "Enter your name.";

  if (values.bio.length > BIO_LIMIT) errors.bio = `Keep it to ${BIO_LIMIT} characters.`;

  const linkedin = urlError(values.linkedinUrl);
  if (linkedin) errors.linkedinUrl = linkedin;
  const github = urlError(values.githubUrl);
  if (github) errors.githubUrl = github;
  return errors;
}

type Props = {
  profile: Profile | null;
  onSaved: (profile: Profile) => void;
};

// Render with a key so the fields start from the loaded profile.
export function DetailsForm({ profile, onSaved }: Props) {
  const [values, setValues] = useState(() => toValues(profile));
  const [saved, setSaved] = useState(() => toValues(profile));
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const dirty = FIELD_ORDER.some((name) => values[name] !== saved[name]);
  useUnsavedWarning(dirty);

  const errors = validate(values);
  const issuesFor = (name: FieldName) =>
    errors[name] && (submitted || touched[name])
      ? [{ message: errors[name], severity: "error" as const }]
      : [];

  function controlProps(name: FieldName) {
    return {
      ...fieldControlProps(`profile-${name}`, issuesFor(name)),
      value: values[name],
      onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setValues((current) => ({ ...current, [name]: event.target.value })),
      onBlur: () => setTouched((current) => ({ ...current, [name]: true })),
    };
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    const firstInvalid = FIELD_ORDER.find((name) => errors[name]);
    if (firstInvalid) {
      document.getElementById(`profile-${firstInvalid}`)?.focus();
      return;
    }

    setSaving(true);
    try {
      const next = await saveMyProfile({
        fullName: values.fullName.trim(),
        major: values.major.trim(),
        gradYear: values.gradYear.trim() ? Number(values.gradYear.trim()) : null,
        department: values.department.trim(),
        company: values.company.trim(),
        bio: values.bio.trim(),
        linkedinUrl: values.linkedinUrl.trim() || null,
        githubUrl: values.githubUrl.trim() || null,
      });
      const fresh = toValues(next);
      setValues(fresh);
      setSaved(fresh);
      setTouched({});
      setSubmitted(false);
      onSaved(next);
      toast.success("Profile saved");
    } catch (error) {
      toast.error(errorMessage(error, "Could not save your profile. Try again."));
    } finally {
      setSaving(false);
    }
  }

  const bioLeft = BIO_LIMIT - values.bio.length;
  // Major and year are for students. Faculty have a department, recruiters a company.
  const role = profile?.role ?? null;

  return (
    <Card>
      <CardHeader>
        <h2 className="font-heading text-base leading-snug font-medium text-balance">Your details</h2>
        {role !== "faculty" && role !== "recruiter" && (
          <CardDescription>Private unless you turn on recruiter visibility.</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <Field id="profile-fullName" label="Full name" issues={issuesFor("fullName")}>
            <Input
              {...controlProps("fullName")}
              name="name"
              type="text"
              autoComplete="name"
              required
              aria-required
              maxLength={120}
            />
          </Field>

          {role === "faculty" && (
            <Field id="profile-department" label="Department" optional>
              <Input
                {...controlProps("department")}
                name="department"
                type="text"
                autoComplete="off"
                maxLength={120}
              />
            </Field>
          )}

          {role === "recruiter" && (
            <Field id="profile-company" label="Company" optional>
              <Input
                {...controlProps("company")}
                name="organization"
                type="text"
                autoComplete="organization"
                maxLength={120}
              />
            </Field>
          )}

          {role !== "faculty" && role !== "recruiter" && (
            <>
              <Field id="profile-major" label="Major" optional>
                <MajorPicker
                  id="profile-major"
                  value={values.major}
                  onChange={(major) => setValues((current) => ({ ...current, major }))}
                />
              </Field>

              <Field id="profile-gradYear" label="Graduation year" optional>
                <GradYearSelect
                  id="profile-gradYear"
                  value={values.gradYear}
                  keep={saved.gradYear}
                  onChange={(gradYear) => setValues((current) => ({ ...current, gradYear }))}
                />
              </Field>
            </>
          )}

          <Field id="profile-bio" label="Short bio" optional issues={issuesFor("bio")}>
            <Textarea
              {...controlProps("bio")}
              aria-describedby={cn("profile-bio-count", issuesFor("bio").length > 0 && "profile-bio-issues")}
              name="bio"
              autoComplete="off"
              maxLength={BIO_LIMIT}
              rows={3}
              placeholder="What you are into"
            />
            <p
              id="profile-bio-count"
              className={cn(
                "text-right text-xs tabular-nums",
                bioLeft <= 20 ? "font-medium text-foreground" : "text-muted-foreground",
              )}
            >
              {values.bio.length} / {BIO_LIMIT}
              <span className="sr-only"> characters used</span>
            </p>
          </Field>

          <Field id="profile-linkedinUrl" label="LinkedIn" optional issues={issuesFor("linkedinUrl")}>
            <Input
              {...controlProps("linkedinUrl")}
              name="linkedin"
              type="url"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              autoCapitalize="none"
              placeholder="https://linkedin.com/in/you…"
            />
          </Field>

          <Field id="profile-githubUrl" label="GitHub" optional issues={issuesFor("githubUrl")}>
            <Input
              {...controlProps("githubUrl")}
              name="github"
              type="url"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              autoCapitalize="none"
              placeholder="https://github.com/you…"
            />
          </Field>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save profile"}
            </Button>
            <p aria-live="polite" className="text-xs text-muted-foreground">
              {dirty && !saving ? "Unsaved changes" : ""}
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
