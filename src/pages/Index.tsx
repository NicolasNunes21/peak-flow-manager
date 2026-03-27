import { useNavigate } from "react-router-dom";
import { BackgroundPaths } from "@/components/ui/background-paths";
import { LiquidButton } from "@/components/ui/liquid-glass-button";

export default function Index() {
  const navigate = useNavigate();

  return (
    <BackgroundPaths title="Peak Suplementos">
      <LiquidButton onClick={() => navigate("/dashboard")}>
        Acessar sistema →
      </LiquidButton>
    </BackgroundPaths>
  );
}
