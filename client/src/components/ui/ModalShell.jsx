export default function ModalShell({ isOpen, onClose, children, widthClass = "max-w-[760px]" }) {
  if (!isOpen) {
    return null;
  }

  return (
    <>
      <button className="modal-backdrop" type="button" aria-label="Close modal" onClick={onClose} />
      <div className={`modal-panel ${widthClass}`}>
        <button
          className="sticky left-[calc(100%-2.5rem)] top-0 z-10 mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-xl text-white transition hover:bg-white/10"
          type="button"
          onClick={onClose}
          aria-label="Close modal"
        >
          ×
        </button>
        {children}
      </div>
    </>
  );
}
