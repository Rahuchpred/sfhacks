// Mobbin reference: Mercor profile (web), "Search and select" field that opens a filtered list.
"use client";

import { useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// Common SFSU undergraduate majors, in alphabetical order.
export const SFSU_MAJORS = [
  "Accounting",
  "Anthropology",
  "Apparel Design and Merchandising",
  "Art",
  "Asian American Studies",
  "Biochemistry",
  "Biology",
  "Broadcast and Electronic Communication Arts",
  "Business Administration",
  "Chemistry",
  "Child and Adolescent Development",
  "Cinema",
  "Civil Engineering",
  "Communication Studies",
  "Computer Engineering",
  "Computer Science",
  "Creative Writing",
  "Criminal Justice Studies",
  "Dance",
  "Decision Sciences",
  "Design",
  "Economics",
  "Electrical Engineering",
  "English",
  "Environmental Studies",
  "Finance",
  "History",
  "Hospitality and Tourism Management",
  "Information Systems",
  "International Business",
  "International Relations",
  "Journalism",
  "Kinesiology",
  "Latina/Latino Studies",
  "Liberal Studies",
  "Management",
  "Marketing",
  "Mathematics",
  "Mechanical Engineering",
  "Music",
  "Nursing",
  "Nutrition and Dietetics",
  "Philosophy",
  "Physics",
  "Political Science",
  "Psychology",
  "Public Health",
  "Social Work",
  "Sociology",
  "Statistics",
  "Theatre Arts",
  "Urban Studies and Planning",
  "Visual Communication Design",
  "Undeclared",
] as const;

const NONE = "Not set";
const OTHER = "Other";

type Props = {
  id: string;
  value: string;
  onChange: (value: string) => void;
};

function isListed(value: string) {
  return (SFSU_MAJORS as readonly string[]).includes(value);
}

// A searchable choice of majors. "Other" reveals a text field for anything not listed.
export function MajorPicker({ id, value, onChange }: Props) {
  const listId = useId();
  const otherRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  // A saved major that is not on the list is an "Other" major.
  const [other, setOther] = useState(() => value !== "" && !isListed(value));

  const selected = other ? OTHER : value || NONE;

  const options = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const majors = SFSU_MAJORS.filter((major) => major.toLowerCase().includes(needle));
    // "Other" always stays in reach, so a search with no match still has a way forward.
    return needle ? [...majors, OTHER] : [NONE, ...majors, OTHER];
  }, [query]);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setQuery("");
      setActive(0);
    }
  }

  function choose(option: string) {
    setOpen(false);
    if (option === OTHER) {
      if (!other) onChange("");
      setOther(true);
      // The text field mounts with this render, so focus it on the next frame.
      requestAnimationFrame(() => otherRef.current?.focus());
      return;
    }
    setOther(false);
    onChange(option === NONE ? "" : option);
  }

  function move(next: number) {
    const index = Math.max(0, Math.min(options.length - 1, next));
    setActive(index);
    document.getElementById(`${listId}-${index}`)?.scrollIntoView({ block: "nearest" });
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      move(active + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      move(active - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      move(0);
    } else if (event.key === "End") {
      event.preventDefault();
      move(options.length - 1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (options[active]) choose(options[active]);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger
          id={id}
          type="button"
          className="flex h-8 w-full min-w-0 items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent pr-2 pl-2.5 text-left text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
        >
          <span className={cn("min-w-0 truncate", selected === NONE && "text-muted-foreground")}>
            {selected}
          </span>
          <ChevronDown aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-(--anchor-width) min-w-64 gap-0 p-0">
          <div className="relative border-b">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              role="combobox"
              aria-label="Search majors"
              aria-expanded
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={options.length > 0 ? `${listId}-${active}` : undefined}
              autoFocus
              autoComplete="off"
              spellCheck={false}
              placeholder="Search majors"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
              className="h-9 rounded-none border-0 pl-8 shadow-none focus-visible:ring-0"
            />
          </div>
          <ul
            id={listId}
            role="listbox"
            aria-label="Majors"
            className="max-h-60 overflow-y-auto overscroll-contain p-1"
          >
            {options.map((option, index) => (
              <li
                key={option}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={option === selected}
                data-active={index === active || undefined}
                onPointerMove={() => setActive(index)}
                onClick={() => choose(option)}
                className={cn(
                  "flex cursor-default items-center gap-1.5 rounded-md py-1.5 pr-2 pl-2 text-sm select-none data-active:bg-muted",
                  (option === NONE || option === OTHER) && "text-muted-foreground",
                )}
              >
                <span className="min-w-0 flex-1 break-words">{option}</span>
                {option === selected && <Check aria-hidden className="size-4 shrink-0" />}
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>

      {other && (
        <Input
          ref={otherRef}
          name="major"
          type="text"
          aria-label="Your major"
          autoComplete="off"
          maxLength={120}
          placeholder="Your major"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </div>
  );
}
