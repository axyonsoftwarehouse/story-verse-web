import { useState } from "react";
import { Icon } from "./Icon";

/** Campo de senha com o "olhinho" para mostrar ou esconder o que foi digitado. */
export function PasswordInput(props: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="password-field">
      <input {...props} type={visible ? "text" : "password"} />
      <button
        type="button"
        className="password-toggle"
        // Mantém o cursor no campo ao mostrar/esconder.
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Esconder senha" : "Mostrar senha"}
        aria-pressed={visible}
        title={visible ? "Esconder senha" : "Mostrar senha"}
        disabled={props.disabled}
      >
        {visible ? Icon.eyeOff : Icon.eye}
      </button>
    </span>
  );
}
