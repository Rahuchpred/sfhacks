"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useAuth } from "@/components/auth-provider";
import {
  listConversations,
  markConversationRead,
  subscribeToMessages,
  type Conversation,
} from "@/lib/db-messages";

// One shared inbox for the whole page: the sidebar badge, the inbox list and an
// open thread all read the same list, kept live by a single Realtime channel.

export type InboxState = {
  status: "loading" | "ready" | "error";
  conversations: Conversation[];
};

const LOADING: InboxState = { status: "loading", conversations: [] };

let state: InboxState = LOADING;
// The account the list belongs to. Null for guests, who have no inbox.
let owner: string | null = null;
let stopRealtime: (() => void) | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let requests = 0;
const listeners = new Set<() => void>();

function emit(next: InboxState) {
  state = next;
  listeners.forEach((listener) => listener());
}

async function load() {
  const request = (requests += 1);
  const account = owner;
  if (!account) return;
  try {
    const conversations = await listConversations();
    if (request !== requests || owner !== account) return;
    emit({ status: "ready", conversations });
  } catch {
    if (request !== requests || owner !== account) return;
    // A failed refresh keeps the list already on screen.
    if (state.status !== "ready") emit({ status: "error", conversations: [] });
  }
}

// Reloads the inbox soon. Calls close together become one read.
export function refreshInbox() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(load, 150);
}

function onVisible() {
  if (document.visibilityState === "visible") refreshInbox();
}

function connect() {
  if (stopRealtime || !owner || listeners.size === 0) return;
  const stop = subscribeToMessages(refreshInbox);
  // Catches up on anything missed while the tab was in the background.
  document.addEventListener("visibilitychange", onVisible);
  stopRealtime = () => {
    stop();
    document.removeEventListener("visibilitychange", onVisible);
  };
}

function disconnect() {
  stopRealtime?.();
  stopRealtime = null;
}

function setOwner(account: string | null) {
  if (owner === account) return;
  owner = account;
  disconnect();
  emit(LOADING);
  if (account) {
    load();
    connect();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  connect();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) disconnect();
  };
}

function getState() {
  return state;
}

function getServerState() {
  return LOADING;
}

// Clears the unread dot at once, then saves it.
export function markInboxRead(id: string) {
  if (state.conversations.some((item) => item.id === id && item.unread)) {
    emit({
      ...state,
      conversations: state.conversations.map((item) =>
        item.id === id ? { ...item, unread: false } : item,
      ),
    });
  }
  markConversationRead(id).then(refreshInbox, () => {});
}

export function retryInbox() {
  emit(LOADING);
  load();
}

// The signed-in account's conversations, live. Guests stay in "loading".
export function useInbox(): InboxState {
  const { user, role } = useAuth();
  const account = role && user ? user.id : null;
  useEffect(() => {
    setOwner(account);
  }, [account]);
  return useSyncExternalStore(subscribe, getState, getServerState);
}

// Live number of conversations with something new, for a sidebar badge.
export function useUnreadCount(): number {
  const { conversations } = useInbox();
  return conversations.filter((item) => item.unread).length;
}
