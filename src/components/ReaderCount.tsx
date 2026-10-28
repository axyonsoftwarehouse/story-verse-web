import { readersLabel, useReaderCount } from "../lib/readers";
import "./readerCount.css";

/** "12 pessoas leram" no card ou na página do livro. Some quando ninguém leu ainda. */
export function ReaderCount({ bookKey, className }: { bookKey: string | null | undefined; className?: string }) {
  const count = useReaderCount(bookKey);
  if (!count) return null;
  const label = readersLabel(count);
  return (
    <span className={`reader-count${className ? ` ${className}` : ""}`} title={label}>
      <svg
        viewBox="0 0 24 24"
        width="13"
        height="13"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.2a6.5 6.5 0 0 1 3 5.8" />
      </svg>
      {label}
    </span>
  );
}
