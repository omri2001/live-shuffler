import { useEffect } from "react";

interface ToastProps {
  message: string;
  type?: "error" | "info";
  onClose: () => void;
}

export default function Toast({
  message,
  type = "error",
  onClose,
}: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 animate-[fadeIn_0.2s_ease-out]">
      <div
        className={`px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium ${
          type === "error"
            ? "bg-red-500/90 text-white"
            : "bg-spotify-dark-lighter text-spotify-white"
        }`}
      >
        {message}
      </div>
    </div>
  );
}
