"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Field, fieldControlProps } from "@/components/post/field";
import {
  BIO_LIMIT,
  GRAD_YEAR_MAX,
  GRAD_YEAR_MIN,
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
  bio: string;
  linkedinUrl: string;
  githubUrl: string;
};
type FieldName = keyof Values;

const FIELD_ORDER: FieldName[] = ["fullName", "major", "gradYear", "bio", "linkedinUrl", "githubUrl"];

function toValues(profile: Profile | null): Values {
  return {
    fullName: profile?.fullName ?? "",
    major: profile?.major ?? "",
    gradYear: profile?.gradYear ? String(profile.gradYear) : "",
    bio: profile?.bio ?? "",
    linkedinUrl: profile?.linkedinUrl ?? "",
    githubUrl: profile?.githubUrl ?? "",
  };
}

function validate(values: Values): Partial<Record<FieldName, string>> {
  const errors: Partial<Record<FieldName, string>> = {};
  if (!values.fullName.trim()) errors.fullName = "Enter your name.";

  const year = values.gradYear.trim();
  if (year) {
    const number = Number(year);
    if (!/^\d{4}$/.test(year)) errors.gradYear = "Use a 4 digit year, like 2027.";
    else if (number < GRAD_YEAR_MIN || number > GRAD_YEAR_MAX) {
      errors.gradYear = `Pick a year from ${GRAD_YEAR_MIN} to ${GRAD_YEAR_MAX}.`;
    }
  }

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

  return (
    <Card>
      <CardHeader>
        <h2 className="font-heading text-base leading-snug font-medium text-balance">Your details</h2>
        <CardDescription>Only you see this unless you turn on recruiter visibility.</CardDescription>
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

          <Field id="profile-major" label="Major" optional issues={issuesFor("major")}>
            <Input
              {...controlProps("major")}
              name="major"
              type="text"
              autoComplete="off"
              maxLength={120}
              placeholder="Computer Science…"
            />
          </Field>

          <Field id="profile-gradYear" label="Graduation year" optional issues={issuesFor("gradYear")}>
            <Input
              {...controlProps("gradYear")}
              name="gradYear"
              type="number"
              inputMode="numeric"
              autoComplete="off"
              min={GRAD_YEAR_MIN}
              max={GRAD_YEAR_MAX}
              step={1}
              placeholder="2027…"
              className="tabular-nums"
            />
          </Field>

          <Field id="profile-bio" label="Short bio" optional issues={issuesFor("bio")}>
            <Textarea
              {...controlProps("bio")}
              aria-describedby={cn("profile-bio-count", issuesFor("bio").length > 0 && "profile-bio-issues")}
              name="bio"
              autoComplete="off"
              maxLength={BIO_LIMIT}
              rows={3}
              placeholder="What you are into, in a sentence or two…"
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
