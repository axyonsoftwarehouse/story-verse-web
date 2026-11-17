import { useState } from "react";
import { Icon } from "../../components/Icon";
import {
  disableDailyNotifications,
  downloadIcs,
  enableDailyNotifications,
  googleCalendarUrl,
  loadReminderPrefs,
  notificationSupport,
  reminderText,
  saveReminderPrefs,
  sendTestNotification,
} from "../../lib/reminders";

export type LastBook = { title: string; chapterLabel?: string; character?: string };

/** Lembrete diário: calendário (qualquer aparelho) e notificação (Android com o app instalado). */
export function ReminderSetup({
  lastBook,
  time,
  onTimeChange,
}: {
  lastBook?: LastBook;
  /** No perfil o horário é rascunho: quem salva é o botão "Salvar alterações". */
  time?: string;
  onTimeChange?: (time: string) => void;
}) {
  const [savedPrefs, setPrefs] = useState(loadReminderPrefs);
  const prefs = time ? { ...savedPrefs, time } : savedPrefs;
  const [status, setStatus] = useState<string | null>(null);
  const support = notificationSupport();
  const text = reminderText(lastBook);

  const update = (p: typeof prefs) => {
    if (onTimeChange && p.time !== savedPrefs.time) {
      onTimeChange(p.time);
      p = { ...p, time: savedPrefs.time };
    }
    setPrefs(p);
    saveReminderPrefs(p);
  };

  async function toggleNotifications() {
    if (prefs.notifications) {
      await disableDailyNotifications();
      update({ ...prefs, notifications: false });
      setStatus("Notificações desligadas.");
      return;
    }
    const result = await enableDailyNotifications();
    if (result === "enabled") {
      update({ ...prefs, notifications: true });
      setStatus("Pronto! Veja um exemplo de como o lembrete vai chegar.");
      void sendTestNotification();
    } else if (result === "denied") {
      setStatus("As notificações foram bloqueadas. Libere nas configurações do navegador para este site.");
    } else {
      setStatus("Este aparelho não permite lembretes automáticos. Use o calendário acima.");
    }
  }

  return (
    <div className="reminder">
      <div className="reminder-when">
        <span className="reminder-label">Lembrete diário</span>
        <label className="reminder-time">
          <span className="sr-only">Horário do lembrete</span>
          <input
            type="time"
            value={prefs.time}
            onChange={(e) => e.target.value && update({ ...prefs, time: e.target.value })}
          />
        </label>
        <p className="reminder-note">
          Você vai receber: <em>“{text.details}”</em>
        </p>
      </div>

      <div className="reminder-how">
        <span className="reminder-label">Como avisar</span>
        <div className="reminder-options">
          <a className="reminder-option" href={googleCalendarUrl(prefs.time, text)} target="_blank" rel="noreferrer">
            <span className="reminder-option-icon" aria-hidden="true">{Icon.calendar}</span>
            <strong>Google Agenda</strong>
            <span>Android e computador</span>
          </a>
          <button type="button" className="reminder-option" onClick={() => downloadIcs(prefs.time, text)}>
            <span className="reminder-option-icon" aria-hidden="true">{Icon.download}</span>
            <strong>Outro calendário</strong>
            <span>iPhone, Outlook e Apple</span>
          </button>
          {support === "supported" ? (
            <button
              type="button"
              className={`reminder-option ${prefs.notifications ? "is-on" : ""}`}
              onClick={() => void toggleNotifications()}
              aria-pressed={prefs.notifications}
            >
              <span className="reminder-option-icon" aria-hidden="true">{Icon.bell}</span>
              <strong>{prefs.notifications ? "Notificações ligadas" : "Notificação do app"}</strong>
              <span>{prefs.notifications ? "Toque para desligar" : "Avisa só se você esquecer"}</span>
            </button>
          ) : support === "install-first" ? (
            <div className="reminder-option is-disabled">
              <span className="reminder-option-icon" aria-hidden="true">{Icon.bell}</span>
              <strong>Notificação do app</strong>
              <span>Instale o app para ativar</span>
            </div>
          ) : null}
        </div>
        {status ? <p className="reminder-status" role="status">{status}</p> : null}
      </div>
    </div>
  );
}
