// Claim-topic glyphs — one icon + label per ClaimTopic, so a record reads as its KIND
// of thing at a glance (a pain, a process step, a tool) instead of an undifferentiated
// row. Shared by the Snapshot's Learned cards and the Knowledge Base browser; the
// neutral fallback covers a card/record with no resolvable topic.
import {
  Flame,
  GitBranch,
  User,
  Wrench,
  BookOpen,
  Clock,
  Building2,
  Target,
  Sparkles,
} from "lucide-react";
import type { ClaimTopic } from "./types";

export const TOPIC_META: Record<ClaimTopic, { icon: typeof Flame; label: string }> = {
  pain: { icon: Flame, label: "Pain point" },
  process_step: { icon: GitBranch, label: "Process" },
  person: { icon: User, label: "People" },
  tool: { icon: Wrench, label: "Tool" },
  vocabulary: { icon: BookOpen, label: "Vocabulary" },
  time_or_cost: { icon: Clock, label: "Time & cost" },
  company_fact: { icon: Building2, label: "Company" },
  success_criteria: { icon: Target, label: "Goal" },
};

export const NEUTRAL_TOPIC = { icon: Sparkles, label: "Insight" };

export function topicMeta(topic: ClaimTopic | null | undefined) {
  return topic ? TOPIC_META[topic] : NEUTRAL_TOPIC;
}
