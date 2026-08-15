import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import ConfirmDialog from "./ConfirmDialog";

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const resolverRef = useRef(null);

  const close = useCallback((result) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setDialog(null);
    resolve?.(Boolean(result));
  }, []);

  const confirm = useCallback((options = {}) => {
    const {
      title = "Confirmar",
      message = "¿Deseas continuar?",
      confirmLabel = "Aceptar",
      cancelLabel = "Cancelar",
      variant = "warn",
    } = typeof options === "string" ? { message: options } : options;

    return new Promise((resolve) => {
      // Si ya hay un diálogo abierto, cancela el anterior
      if (resolverRef.current) {
        resolverRef.current(false);
      }
      resolverRef.current = resolve;
      setDialog({ title, message, confirmLabel, cancelLabel, variant });
    });
  }, []);

  const value = useMemo(() => ({ confirm }), [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <ConfirmDialog
        open={Boolean(dialog)}
        title={dialog?.title}
        message={dialog?.message}
        confirmLabel={dialog?.confirmLabel}
        cancelLabel={dialog?.cancelLabel}
        variant={dialog?.variant}
        onConfirm={() => close(true)}
        onCancel={() => close(false)}
      />
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("useConfirm debe usarse dentro de ConfirmProvider");
  }
  return ctx.confirm;
}
