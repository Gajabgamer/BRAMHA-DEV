export default function Toast({ message }) {
  if (!message) {
    return null;
  }

  return (
    <div className="fixed bottom-5 right-5 z-[60] max-w-xs rounded-2xl border border-gold/20 bg-card/95 px-4 py-3 text-sm text-white shadow-soft backdrop-blur">
      {message}
    </div>
  );
}
