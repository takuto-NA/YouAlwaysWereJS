/**
 * Renders chat messages while keeping Markdown readable.
 * Plain text animates with a typewriter effect so users sense progress,
 * whereas complex markup (tables/code/images) appears instantly to stay legible.
 */
import { useMemo, useState, type JSX } from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { ClipboardDocumentIcon, ClipboardDocumentCheckIcon, UserIcon, CpuChipIcon } from "@heroicons/react/24/outline";
import { Message } from "../types/chat";
import { useTypewriter } from "../hooks/useTypewriter";
import { DEFAULT_TYPEWRITER_SPEED_MS } from "../constants/typewriter";

interface ChatMessageProps {
  message: Message;
  enableTypewriter?: boolean;
  showTimestamp?: boolean;
}

type BlockType = "text" | "code" | "table" | "image";

interface BlockRange {
  type: Exclude<BlockType, "text">;
  start: number;
  end: number;
  content: string;
}

interface MessageBlock {
  type: BlockType;
  content: string;
}

const ROLE_LABELS: Record<Exclude<Message["role"], "system">, string> = {
  user: "You",
  assistant: "AI",
};

const MARKDOWN_PLUGINS = [remarkGfm, remarkBreaks];

const MARKDOWN_COMPONENTS: Components = {
  a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noreferrer" />,
};

const CODE_BLOCK_REGEX = /```[\s\S]*?```/g;
const IMAGE_REGEX = /!\[[^\]]*]\([^)]+\)/g;
const TABLE_DIVIDER_REGEX =
  /^(\s*\|)?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+(\|)?\s*$/;

const SPECIAL_BLOCK_PRIORITY: Record<Exclude<BlockType, "text">, number> = {
  code: 3,
  table: 2,
  image: 1,
};

const renderMarkdown = (content: string, key: string) => (
  <ReactMarkdown key={key} remarkPlugins={MARKDOWN_PLUGINS} components={MARKDOWN_COMPONENTS}>
    {content}
  </ReactMarkdown>
);

const hasTablePipes = (line: string) => (line.match(/\|/g) || []).length >= 2;

const detectCodeBlocks = (content: string): BlockRange[] => {
  const matches: BlockRange[] = [];
  let regexMatch: RegExpExecArray | null;

  CODE_BLOCK_REGEX.lastIndex = 0;
  while ((regexMatch = CODE_BLOCK_REGEX.exec(content)) !== null) {
    matches.push({
      type: "code",
      start: regexMatch.index,
      end: regexMatch.index + regexMatch[0].length,
      content: regexMatch[0],
    });
  }

  return matches;
};

const detectImageBlocks = (content: string): BlockRange[] => {
  const matches: BlockRange[] = [];
  let regexMatch: RegExpExecArray | null;

  IMAGE_REGEX.lastIndex = 0;
  while ((regexMatch = IMAGE_REGEX.exec(content)) !== null) {
    matches.push({
      type: "image",
      start: regexMatch.index,
      end: regexMatch.index + regexMatch[0].length,
      content: regexMatch[0],
    });
  }

  return matches;
};

const overlaps = (range: { start: number; end: number }, other: BlockRange[]) =>
  other.some((item) => !(range.end <= item.start || range.start >= item.end));

const detectTableBlocks = (content: string, excluded: BlockRange[]): BlockRange[] => {
  const lines = content.split("\n");
  const lineStarts: number[] = [];
  let offset = 0;

  for (let i = 0; i < lines.length; i += 1) {
    lineStarts.push(offset);
    offset += lines[i].length;
    if (i < lines.length - 1) {
      offset += 1; // newline
    }
  }

  const ranges: BlockRange[] = [];

  const isInsideExcluded = (index: number) =>
    excluded.some((range) => index >= range.start && index < range.end);

  for (let lineIndex = 0; lineIndex < lines.length - 1; lineIndex += 1) {
    const headerLine = lines[lineIndex];
    const dividerLine = lines[lineIndex + 1];
    const headerStart = lineStarts[lineIndex];

    if (isInsideExcluded(headerStart)) {
      continue;
    }

    if (!hasTablePipes(headerLine)) {
      continue;
    }

    if (!TABLE_DIVIDER_REGEX.test(dividerLine.trim()) || isInsideExcluded(lineStarts[lineIndex + 1])) {
      continue;
    }

    let tableLineIndex = lineIndex + 2;
    while (
      tableLineIndex < lines.length &&
      hasTablePipes(lines[tableLineIndex]) &&
      !isInsideExcluded(lineStarts[tableLineIndex])
    ) {
      tableLineIndex += 1;
    }

    const startIndex = lineStarts[lineIndex];
    const endIndex =
      tableLineIndex < lines.length ? lineStarts[tableLineIndex] : content.length;
    const candidate = { start: startIndex, end: endIndex };

    if (overlaps(candidate, [...excluded, ...ranges])) {
      continue;
    }

    ranges.push({
      type: "table",
      start: startIndex,
      end: endIndex,
      content: content.slice(startIndex, endIndex),
    });

    lineIndex = tableLineIndex - 1;
  }

  return ranges;
};

const mergeAndSortRanges = (blocks: BlockRange[]): BlockRange[] => {
  const sorted = [...blocks].sort((a, b) => {
    if (a.start === b.start) {
      return SPECIAL_BLOCK_PRIORITY[b.type] - SPECIAL_BLOCK_PRIORITY[a.type];
    }
    return a.start - b.start;
  });

  const merged: BlockRange[] = [];

  sorted.forEach((block) => {
    const last = merged[merged.length - 1];
    if (last && block.start < last.end) {
      if (SPECIAL_BLOCK_PRIORITY[block.type] > SPECIAL_BLOCK_PRIORITY[last.type]) {
        merged[merged.length - 1] = block;
      }
      return;
    }

    merged.push(block);
  });

  return merged;
};

// Split content so the typewriter can animate plain text while heavier blocks stay readable.
const buildMessageBlocks = (content: string): MessageBlock[] => {
  if (!content) {
    return [{ type: "text", content: "" }];
  }

  const codeBlocks = detectCodeBlocks(content);
  const tableBlocks = detectTableBlocks(content, codeBlocks);
  const imageBlocks = detectImageBlocks(content);

  const ranges = mergeAndSortRanges([...codeBlocks, ...tableBlocks, ...imageBlocks]);

  if (ranges.length === 0) {
    return [{ type: "text", content }];
  }

  const blocks: MessageBlock[] = [];
  let cursor = 0;

  ranges.forEach((range) => {
    if (range.start > cursor) {
      blocks.push({ type: "text", content: content.slice(cursor, range.start) });
    }

    blocks.push({ type: range.type, content: range.content });
    cursor = range.end;
  });

  if (cursor < content.length) {
    blocks.push({ type: "text", content: content.slice(cursor) });
  }

  return blocks;
};

function ChatMessage({ message, enableTypewriter = true, showTimestamp = false }: ChatMessageProps) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  const isAssistant = message.role === "assistant";
  const [isCopied, setIsCopied] = useState(false);

  const blocks = useMemo(() => buildMessageBlocks(message.content), [message.content]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy message:", err);
    }
  };

  const plainTextContent = useMemo(
    () =>
      blocks
        .filter((block) => block.type === "text")
        .map((block) => block.content)
        .join(""),
    [blocks],
  );

  const totalPlainTextLength = plainTextContent.length;
  const hasPlainText = totalPlainTextLength > 0;

  // Only animate assistant responses when we have plain text to reveal for pacing feedback.
  const shouldUseTypewriter =
    enableTypewriter && isAssistant && message.isTyping !== false && hasPlainText;

  const typewriterSpeed =
    typeof window !== "undefined"
      ? JSON.parse(localStorage.getItem("chat_app_settings") || "{}").typewriterSpeed ||
        DEFAULT_TYPEWRITER_SPEED_MS
      : DEFAULT_TYPEWRITER_SPEED_MS;

  const { displayedText, isTyping } = useTypewriter({
    text: plainTextContent,
    speed: typewriterSpeed,
    enabled: shouldUseTypewriter,
  });

  const totalTypedLength = shouldUseTypewriter ? displayedText.length : totalPlainTextLength;

  // Reveal blocks sequentially so readers get progressive feedback without hiding complex layouts.
  const renderedBlocks = useMemo(() => {
    let textCursor = 0;
    const elements: Array<JSX.Element | null> = [];

    blocks.forEach((block, index) => {
      if (block.type === "text") {
        const blockStart = textCursor;
        const blockLength = block.content.length;
        const blockEnd = blockStart + blockLength;
        const visibleLength = Math.max(
          0,
          Math.min(blockLength, totalTypedLength - blockStart),
        );
        textCursor = blockEnd;

        if (visibleLength <= 0) {
          elements.push(null);
          return;
        }

        const visibleContent = block.content.slice(0, visibleLength);

        elements.push(renderMarkdown(visibleContent, `text-${index}`));
        return;
      }

      const revealThreshold = textCursor;
      if (shouldUseTypewriter && totalTypedLength < revealThreshold) {
        elements.push(null);
        return;
      }

      elements.push(renderMarkdown(block.content, `${block.type}-${index}`));
    });

    return elements;
  }, [blocks, shouldUseTypewriter, totalTypedLength]);

  if (isSystem) {
    return (
      <div className="chat-message chat-message--system chat-message--enter">
        <div className="chat-message__system-text chat-message__markdown">
          {renderedBlocks}
        </div>
        {showTimestamp && (
          <div className="chat-message__timestamp">
            {new Date(message.timestamp).toLocaleString()}
          </div>
        )}
      </div>
    );
  }

  const role = isUser ? "user" : "assistant";
  const label = ROLE_LABELS[role];

  return (
    <div className={`chat-message chat-message--${role} chat-message--enter`}>
      <div className="chat-message__inner">
        <div className="chat-message__header">
          <div className="flex items-center gap-2">
            {isUser ? (
              <UserIcon className="h-5 w-5" />
            ) : (
              <CpuChipIcon className="h-5 w-5" />
            )}
            <span className={`chat-message__label chat-message__label--${role}`}>{label}</span>
          </div>
          <div className="flex items-center gap-2">
            {isTyping && (
              <div className="chat-message__typing" aria-hidden="true">
                <span className="chat-message__typing-dot" />
                <span className="chat-message__typing-dot" />
                <span className="chat-message__typing-dot" />
              </div>
            )}
            <button
              onClick={handleCopy}
              className="p-1 rounded hover:bg-gray-700/50 transition-colors"
              aria-label="メッセージをコピー"
              title={isCopied ? "コピーしました" : "メッセージをコピー"}
            >
              {isCopied ? (
                <ClipboardDocumentCheckIcon className="h-4 w-4 text-green-400" />
              ) : (
                <ClipboardDocumentIcon className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        <div className={`chat-message__body chat-message__body--${role}`}>
          <div className="chat-message__markdown">{renderedBlocks}</div>
          {isTyping && shouldUseTypewriter && (
            <span className="chat-message__cursor" aria-hidden="true" />
          )}
        </div>

        {showTimestamp && (
          <div className="chat-message__timestamp">
            {new Date(message.timestamp).toLocaleString()}
          </div>
        )}
      </div>
    </div>
  );
}

export default ChatMessage;
