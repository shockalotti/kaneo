/**
 * Extract all user IDs from mention tags embedded in markdown content.
 *
 * Mentions are serialized by the TipTap Mention node as:
 *   <mention user-id="<userId>" name="<name>" />
 *
 * Returns a deduplicated array of user IDs found in the content.
 */
export function parseMentionedUserIds(content: string): string[] {
  const pattern = /<mention\s+user-id="([^"]+)"[^/]*/g;
  const ids = new Set<string>();

  for (const match of content.matchAll(pattern)) {
    const userId = match[1];
    if (userId) {
      ids.add(userId);
    }
  }

  return Array.from(ids);
}
