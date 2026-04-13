import { FileUp, Upload } from 'lucide-react';
import { useId, useRef, useState } from 'react';

type DocumentDropzoneProps = {
  accept: string;
  disabled?: boolean;
  uploading?: boolean;
  title: string;
  subtitle?: string;
  onFileSelected: (file: File | null) => void | Promise<void>;
};

export default function DocumentDropzone({
  accept,
  disabled = false,
  uploading = false,
  title,
  subtitle,
  onFileSelected,
}: DocumentDropzoneProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const isDisabled = disabled || uploading;

  const submitFile = (file: File | null) => {
    if (isDisabled) return;
    void onFileSelected(file);
  };

  const openPicker = () => {
    if (isDisabled) return;
    inputRef.current?.click();
  };

  return (
    <div
      role="button"
      tabIndex={isDisabled ? -1 : 0}
      onClick={openPicker}
      onKeyDown={(event) => {
        if (isDisabled) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openPicker();
        }
      }}
      onDragEnter={(event) => {
        if (isDisabled) return;
        event.preventDefault();
        setDragActive(true);
      }}
      onDragOver={(event) => {
        if (isDisabled) return;
        event.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        setDragActive(false);
      }}
      onDrop={(event) => {
        if (isDisabled) return;
        event.preventDefault();
        setDragActive(false);
        submitFile(event.dataTransfer.files?.[0] ?? null);
      }}
      className={`mt-3 rounded-xl border border-dashed px-4 py-4 transition ${
        isDisabled
          ? 'cursor-not-allowed border-[var(--border-subtle)] bg-[var(--surface-ambient)] opacity-70'
          : dragActive
            ? 'cursor-pointer border-[var(--brand-primary)] bg-[var(--surface-highlight)]'
            : 'cursor-pointer border-[var(--border-strong)] bg-[var(--surface-glow)] hover:border-[var(--brand-primary)] hover:bg-[var(--surface-highlight)]'
      }`}
    >
      <input
        id={inputId}
        ref={inputRef}
        type="file"
        className="hidden"
        accept={accept}
        disabled={isDisabled}
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          event.currentTarget.value = '';
          submitFile(file);
        }}
      />

      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface-ambient)] text-[var(--brand-primary)]">
          {uploading ? <Upload size={18} className="animate-pulse" /> : <FileUp size={18} />}
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-[var(--text-primary)]">
            {uploading ? 'Μεταφόρτωση...' : title}
          </p>
          <p className="text-xs text-[var(--text-tertiary)]">
            {subtitle ?? 'Σύρετε αρχείο εδώ ή πατήστε για επιλογή.'}
          </p>
        </div>
      </div>
    </div>
  );
}
