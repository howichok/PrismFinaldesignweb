"use client";

import Input from "@/components/ui/Input";

type DiscoverySearchProps = {
  value: string;
  onChange: (value: string) => void;
};

export default function DiscoverySearch({
  value,
  onChange,
}: DiscoverySearchProps) {
  return (
    <Input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Search by name..."
    />
  );
}
