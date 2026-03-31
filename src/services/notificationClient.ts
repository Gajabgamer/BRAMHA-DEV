"use client";

type BrowserNotificationInput = {
  id?: string;
  title: string;
  body: string;
  url?: string | null;
};

const sentTimestamps = new Map<string, number>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_NOTIFICATIONS_PER_WINDOW = 3;

function now() {
  return Date.now();
}

function getPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || typeof Notification === "undefined") {
    return "unsupported";
  }

  return Notification.permission;
}

export function getBrowserNotificationPermission() {
  return getPermission();
}

export async function requestBrowserNotificationPermission() {
  if (typeof window === "undefined" || typeof Notification === "undefined") {
    return "unsupported" as const;
  }

  return Notification.requestPermission();
}

function canSendWithinRateLimit(key: string) {
  const cutoff = now() - RATE_LIMIT_WINDOW_MS;
  for (const [entryKey, timestamp] of sentTimestamps.entries()) {
    if (timestamp < cutoff) {
      sentTimestamps.delete(entryKey);
    }
  }

  if (sentTimestamps.has(key)) {
    return false;
  }

  if (sentTimestamps.size >= MAX_NOTIFICATIONS_PER_WINDOW) {
    return false;
  }

  sentTimestamps.set(key, now());
  return true;
}

export function sendBrowserNotification({ id, title, body, url }: BrowserNotificationInput) {
  if (getPermission() !== "granted") {
    return null;
  }

  const dedupeKey = id || `${title}::${body}`;
  if (!canSendWithinRateLimit(dedupeKey)) {
    return null;
  }

  const notification = new Notification(title, {
    body,
    icon: "/file.svg",
    tag: dedupeKey,
  });

  notification.onclick = () => {
    if (typeof window !== "undefined") {
      window.focus();
      window.location.href = url || "/dashboard";
    }
    notification.close();
  };

  return notification;
}
