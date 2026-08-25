import type { Metadata } from "next";
import { AuroraPrototype } from "../components/AuroraPrototype";

export const metadata: Metadata = {
  title: "Aurora Motion Study",
  description: "A WebGL motion study based on the supplied northern lights artwork.",
};

export default function AuroraPrototypePage() {
  return <AuroraPrototype />;
}
