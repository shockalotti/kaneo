import { assertPublicWebhookDestination } from "../generic-webhook/config";

export type MattermostAttachment = {
  color?: string;
  title?: string;
  title_link?: string;
  text?: string;
  fields?: Array<{ title: string; value: string; short?: boolean }>;
};

export type MattermostMessage = {
  text: string;
  username?: string;
  attachments?: MattermostAttachment[];
};

const MATTERMOST_TIMEOUT_MS = 10_000;

export async function lookupMattermostUserByEmail(
  serverUrl: string,
  token: string,
  email: string,
): Promise<string | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5_000);

  try {
    const response = await fetch(
      `${serverUrl}/api/v4/users/email/${encodeURIComponent(email)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      },
    );

    if (!response.ok) return null;

    const user = (await response.json()) as { username?: string };
    return user.username ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function postToMattermost(
  webhookUrl: string,
  message: MattermostMessage,
): Promise<void> {
  await assertPublicWebhookDestination(webhookUrl);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), MATTERMOST_TIMEOUT_MS);

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Mattermost webhook request failed (${response.status}): ${errorText}`,
      );
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        `Mattermost webhook request timed out after ${MATTERMOST_TIMEOUT_MS}ms`,
      );
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
