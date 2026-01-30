"use client";

import Tabs from "@/components/ui/Tabs";
import type { DiscoveryTab } from "@/lib/discovery/types";

const tabs = ["All", "Posts", "Projects", "Companies"];

type DiscoveryTabsProps = {
  value: DiscoveryTab;
  onChange: (value: DiscoveryTab) => void;
};

export default function DiscoveryTabs({ value, onChange }: DiscoveryTabsProps) {
  const activeLabel =
    tabs.find((tab) => tab.toLowerCase() === value) ?? "All";

  return (
    <Tabs
      items={tabs}
      value={activeLabel}
      onChange={(label) => onChange(label.toLowerCase() as DiscoveryTab)}
    />
  );
}
