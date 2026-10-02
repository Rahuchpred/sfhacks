// Messages: questions to an event's team, announcements to everyone registered,
// and help board chats. Every write goes through a database function, which
// decides who may do it. See supabase/migrations/20261003043000_messages.sql.
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";

// The generated database types do not know these tables and functions yet.
const db = supabase as unknown as SupabaseClient;

export const MESSAGE_MAX_LENGTH = 1000;

export type ConversationKind = "question" | "announcement" | "help";

// The signed-in person's place in a conversation.
export type ConversationSide = "student" | "team" | "audience" | "helper" | "requester";

export type Conversation = {
  id: string;
  kind: ConversationKind;
  side: ConversationSide;
  eventId: string | null;
  helpRequestId: string | null;
  title: string; // the event or the help request
  counterpart: string; // who is on the other side, a name and never an email
  lastBody: string | null;
  lastAt: string | null;
  lastMine: boolean;
  unread: boolean;
  closed: boolean;
  canReopen: boolean; // true for the side that closed it
  createdAt: string;
};

export type Message = {
  id: string;
  senderName: string;
  mine: boolean;
  body: string;
  createdAt: string;
};

export type Announcement = { id: string; conversationId: string; body: string; createdAt: string };

// What the signed-in person may do with messages on one event.
export type EventMessaging = {
  hasHost: boolean; // false for an imported event nobody manages
  isTeam: boolean;
  registered: boolean;
  audience: number | null; // people registered, for the team only
};

type ConversationRow = {
  conversation_id: string;
  kind: ConversationKind;
  side: ConversationSide;
  event_id: string | null;
  help_request_id: string | null;
  title: string;
  counterpart: string;
  last_body: string | null;
  last_at: string | null;
  last_mine: boolean;
  unread: boolean;
  closed: boolean;
  can_reopen: boolean;
  created_at: string;
};

function toConversation(row: ConversationRow): Conversation {
  return {
    id: row.conversation_id,
    kind: row.kind,
    side: row.side,
    eventId: row.event_id,
    helpRequestId: row.help_request_id,
    title: row.title,
    counterpart: row.counterpart,
    lastBody: row.last_body,
    lastAt: row.last_at,
    lastMine: row.last_mine,
    unread: row.unread,
    closed: row.closed,
    canReopen: row.can_reopen,
    createdAt: row.created_at,
  };
}

// The database raises short codes. These are the words a person reads.
const SEND_ERRORS: Record<string, string> = {
  rate_limited: "Too many messages. Wait a minute.",
  closed: "This conversation is closed.",
  too_long: `Keep it under ${MESSAGE_MAX_LENGTH} characters.`,
  empty: "Write a message first.",
  not_allowed: "You cannot write here.",
  not_signed_in: "Sign in first.",
  no_host: "This event has no host to ask.",
  is_team: "You are on this event's team.",
  not_found: "Not found.",
};

export function messageError(error: unknown, fallback: string): string {
  const text =
    typeof error === "object" && error !== null && "message" in error ? String(error.message) : "";
  return SEND_ERRORS[text] ?? fallback;
}

// Every conversation with at least one message, newest first.
export async function listConversations(): Promise<Conversation[]> {
  const { data, error } = await db.rpc("my_conversations");
  if (error) throw error;
  return (data as ConversationRow[]).map(toConversation);
}

// One conversation, even an empty one. Null when it is not yours to see.
export async function getConversation(id: string): Promise<Conversation | null> {
  const { data, error } = await db.rpc("my_conversations", { p_conversation_id: id });
  if (error) throw error;
  const row = (data as ConversationRow[])[0];
  return row ? toConversation(row) : null;
}

export async function listMessages(conversationId: string): Promise<Message[]> {
  const { data, error } = await db.rpc("conversation_messages", {
    p_conversation_id: conversationId,
  });
  if (error) throw error;
  return (
    data as { message_id: string; sender_name: string; mine: boolean; body: string; created_at: string }[]
  ).map((row) => ({
    id: row.message_id,
    senderName: row.sender_name,
    mine: row.mine,
    body: row.body,
    createdAt: row.created_at,
  }));
}

// Returns the id and time of the stored message.
export async function sendMessage(
  conversationId: string,
  body: string,
): Promise<{ id: string; createdAt: string }> {
  const { data, error } = await db.rpc("send_message", {
    p_conversation_id: conversationId,
    p_body: body,
  });
  if (error) throw error;
  const row = data as { id: string; created_at: string };
  return { id: row.id, createdAt: row.created_at };
}

export async function sendAnnouncement(eventId: string, body: string): Promise<void> {
  const { error } = await db.rpc("send_announcement", { p_event_id: eventId, p_body: body });
  if (error) throw error;
}

// The student's private conversation with an event's team, created on first use.
export async function openEventConversation(eventId: string): Promise<string> {
  const { data, error } = await db.rpc("open_event_conversation", { p_event_id: eventId });
  if (error) throw error;
  return data as string;
}

// The chat of an accepted or done help offer, for the requester or the student.
export async function openHelpConversation(offerId: string): Promise<string> {
  const { data, error } = await db.rpc("open_help_conversation", { p_offer_id: offerId });
  if (error) throw error;
  return data as string;
}

export async function setConversationClosed(id: string, closed: boolean): Promise<void> {
  const { error } = await db.rpc("set_conversation_closed", {
    p_conversation_id: id,
    p_closed: closed,
  });
  if (error) throw error;
}

export async function markConversationRead(id: string): Promise<void> {
  const { error } = await db.rpc("mark_conversation_read", { p_conversation_id: id });
  if (error) throw error;
}

export async function getEventMessaging(eventId: string): Promise<EventMessaging | null> {
  const { data, error } = await db.rpc("event_messaging", { p_event_id: eventId });
  if (error) throw error;
  const row = (
    data as { has_host: boolean; is_team: boolean; registered: boolean; audience: number | null }[]
  )[0];
  if (!row) return null;
  return {
    hasHost: row.has_host,
    isTeam: row.is_team,
    registered: row.registered,
    audience: row.audience,
  };
}

// Newest first. Empty for someone who is neither registered nor on the team.
export async function listEventAnnouncements(eventId: string): Promise<Announcement[]> {
  const { data, error } = await db.rpc("event_announcements", { p_event_id: eventId });
  if (error) throw error;
  return (
    data as { message_id: string; conversation_id: string; body: string; created_at: string }[]
  ).map((row) => ({
    id: row.message_id,
    conversationId: row.conversation_id,
    body: row.body,
    createdAt: row.created_at,
  }));
}

let channelCount = 0;

// Calls onChange when a message arrives, or a conversation is closed or reopened.
// Row level security decides which rows reach this person, so no filter is needed
// for the inbox. Pass a conversation id to hear one thread only.
export function subscribeToMessages(onChange: () => void, conversationId?: string): () => void {
  channelCount += 1;
  const channel = db
    .channel(`messages-${conversationId ?? "all"}-${channelCount}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        ...(conversationId ? { filter: `conversation_id=eq.${conversationId}` } : {}),
      },
      onChange,
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "conversations",
        ...(conversationId ? { filter: `id=eq.${conversationId}` } : {}),
      },
      onChange,
    )
    .subscribe();
  return () => {
    db.removeChannel(channel);
  };
}
