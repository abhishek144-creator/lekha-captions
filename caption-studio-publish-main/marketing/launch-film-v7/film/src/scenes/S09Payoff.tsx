import React from "react";
import { FootageSlot } from "../components/FootageSlot";
import { SceneFrame } from "../components/Chrome";
import { LAYOUT } from "../theme";
import { sceneById } from "../timeline";

// The opening shot again, finished in Lekha — and the creator's sound comes back.
export const S09Payoff: React.FC = () => (
  <SceneFrame scene={sceneById("S09Payoff")}>
    <FootageSlot id="F4b" box={LAYOUT.portrait} muted={false} />
  </SceneFrame>
);
