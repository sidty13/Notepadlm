import { FileText, Globe, Youtube, Captions, File } from "lucide-react";
import type { SourceType } from "@/lib/types";

const ICONS: Record<SourceType, typeof FileText> = {
  pdf: FileText,
  text: File,
  website: Globe,
  youtube: Youtube,
  vtt: Captions,
};

export default function SourceIcon({ type, size = 15 }: { type: SourceType; size?: number }) {
  const Icon = ICONS[type] ?? File;
  return <Icon size={size} strokeWidth={1.75} />;
}
