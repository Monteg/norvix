import type { Metadata } from "next";
import { AuroraConfigurator } from "../components/AuroraConfigurator";

export const metadata: Metadata = {
  title: "Aurora Settings",
  description: "Configure the procedural aurora and starfield.",
};

export default function AuroraSettingsPage() {
  return <AuroraConfigurator />;
}
