import { mergeAttributes, Node } from "@tiptap/core";
import type { NodeViewProps } from "@tiptap/react";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";

function MentionView({ node }: NodeViewProps) {
  const name = String(node.attrs.name || "Unknown");

  return (
    <NodeViewWrapper
      as="span"
      className="kaneo-mention"
      contentEditable={false}
    >
      @{name}
    </NodeViewWrapper>
  );
}

export const Mention = Node.create({
  name: "mention",
  group: "inline",
  inline: true,
  atom: true,
  selectable: false,

  addAttributes() {
    return {
      userId: { default: "" },
      name: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: "mention[user-id]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "mention",
      mergeAttributes(HTMLAttributes, {
        "data-type": "mention",
        "user-id": HTMLAttributes.userId,
        name: HTMLAttributes.name,
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MentionView);
  },

  renderMarkdown(
    node: { attrs?: { userId?: string; name?: string } },
    _helpers: unknown,
    _context: unknown,
  ) {
    const userId = String(node.attrs?.userId || "");
    const name = String(node.attrs?.name || "");
    if (!userId) return "";
    return `<mention user-id="${userId}" name="${name}" />`;
  },
});
