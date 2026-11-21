import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import clsx from "clsx";

type ToastKind = "success" | "error" | "info";

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  toast: (kind: ToastKind, message: string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);
  const timers = useRef<number[]>([]);

  const remove = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    (kind: ToastKind, message: string) => {
      const id = ++counter.current;
      setItems((current) => [...current.slice(-3), { id, kind, message }]);
      const timer = window.setTimeout(() => remove(id), 4200);
      timers.current.push(timer);
    },
    [remove],
  );

  useEffect(() => {
    return () => {
      timers.current.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({
      toast,
      success: (message) => toast("success", message),
      error: (message) => toast("error", message),
      info: (message) => toast("info", message),
    }),
    [toast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 z-[100] flex w-full flex-col gap-2 px-4 sm:bottom-6 sm:start-6 sm:w-auto sm:max-w-md sm:px-0">
        {items.map((item) => (
          <div
            key={item.id}
            role="status"
            className={clsx(
              "animate-in pointer-events-auto flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm font-semibold shadow-pop",
              item.kind === "success" && "border-emerald-200 bg-emerald-50 text-emerald-900",
              item.kind === "error" && "border-red-200 bg-red-50 text-red-900",
              item.kind === "info" && "border-sky-200 bg-sky-50 text-sky-900",
            )}
          >
            {item.kind === "success" && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
            {item.kind === "error" && <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
            {item.kind === "info" && <Info className="mt-0.5 h-4 w-4 shrink-0" />}
            <span className="flex-1 leading-6">{item.message}</span>
            <button
              type="button"
              onClick={() => remove(item.id)}
              className="rounded p-0.5 opacity-60 transition hover:opacity-100"
              aria-label="close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}
