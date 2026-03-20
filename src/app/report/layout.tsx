import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "CEO report — Roadmap Impact Calculator 2026",
  description: "Краткий отчёт для печати или сохранения в PDF.",
};

export default function ReportLayout({ children }: { children: ReactNode }) {
  return children;
}
