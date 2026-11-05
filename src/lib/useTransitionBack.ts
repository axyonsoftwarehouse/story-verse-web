import { useNavigate } from "react-router-dom";
import { navigateWithTransition } from "./motion";

/** "Voltar" com transição no sentido contrário (ou para `fallback` se não há para onde voltar). */
export function useTransitionBack(fallback: string) {
  const navigate = useNavigate();
  return () =>
    navigateWithTransition(() => (window.history.length > 1 ? navigate(-1) : navigate(fallback)), { back: true });
}
