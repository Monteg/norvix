import type { Metadata } from "next";
import { CleanAuroraView } from "../components/CleanAuroraView";

export const metadata: Metadata = {
  title: "Aurora Clean View",
  description: "A clean procedural starfield and northern lights output view.",
};

export default function AuroraCleanPage() {
  return <CleanAuroraView />;
}
