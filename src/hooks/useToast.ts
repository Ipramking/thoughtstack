"use client";

import * as React from "react";
import type { ToastActionElement, ToastProps } from "@/components/ui/toast";

const TOAST_LIMIT = 4;
const TOAST_REMOVE_DELAY = 4000;

type ToasterToast = ToastProps & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
};

let count = 0;
const genId = () => `toast-${++count}`;

type Action =
  | { type: "ADD"; toast: ToasterToast }
  | { type: "DISMISS"; id?: string }
  | { type: "REMOVE"; id?: string };

interface State { toasts: ToasterToast[] }

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

function addToRemoveQueue(id: string, dispatch: React.Dispatch<Action>) {
  if (toastTimeouts.has(id)) return;
  const t = setTimeout(() => {
    toastTimeouts.delete(id);
    dispatch({ type: "REMOVE", id });
  }, TOAST_REMOVE_DELAY);
  toastTimeouts.set(id, t);
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "ADD":
      return { toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT) };
    case "DISMISS":
      return {
        toasts: state.toasts.map((t) =>
          !action.id || t.id === action.id ? { ...t, open: false } : t
        ),
      };
    case "REMOVE":
      return {
        toasts: action.id
          ? state.toasts.filter((t) => t.id !== action.id)
          : [],
      };
    default:
      return state;
  }
}

// Global listeners so toast() works outside React components too
const listeners: Array<React.Dispatch<Action>> = [];
let memState: State = { toasts: [] };

function dispatch(action: Action) {
  memState = reducer(memState, action);
  listeners.forEach((l) => l(action));
}

type ToastInput = Omit<ToasterToast, "id">;

function toast(props: ToastInput) {
  const id = genId();
  const dismiss = () => dispatch({ type: "DISMISS", id });
  dispatch({
    type: "ADD",
    toast: { ...props, id, open: true, onOpenChange: (open) => { if (!open) dismiss(); } },
  });
  // Auto-dismiss
  setTimeout(dismiss, TOAST_REMOVE_DELAY - 500);
  return { id, dismiss };
}

// Convenience shorthands
toast.success = (title: string, description?: string) =>
  toast({ title, description, variant: "success" });
toast.error = (title: string, description?: string) =>
  toast({ title, description, variant: "destructive" });
toast.info = (title: string, description?: string) =>
  toast({ title, description, variant: "info" });

function useToast() {
  const [state, setState] = React.useState<State>(memState);

  React.useEffect(() => {
    const dispatch2: React.Dispatch<Action> = (action) => {
      setState((s) => reducer(s, action));
      if (action.type === "DISMISS" && action.id) {
        addToRemoveQueue(action.id, dispatch2);
      }
    };
    listeners.push(dispatch2);
    return () => {
      const idx = listeners.indexOf(dispatch2);
      if (idx > -1) listeners.splice(idx, 1);
    };
  }, []);

  return { toasts: state.toasts, toast, dismiss: (id?: string) => dispatch({ type: "DISMISS", id }) };
}

export { toast, useToast };
