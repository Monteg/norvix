import type { Metadata } from "next";
import { CodepenAuroraPrototype } from "../components/CodepenAuroraPrototype";

export const metadata: Metadata = {
  title: "Nimitz Aurora Study",
  description: "A transparent aurora study adapted from Nimitz's ShaderToy field.",
};

export default function AuroraCodepenPage() {
  return <CodepenAuroraPrototype />;
}
