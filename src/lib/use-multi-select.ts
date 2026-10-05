"use client";

import { useEffect, useRef, useState } from "react";

export function useMultiSelect(ids: string[], enabled: boolean) {
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClick = useRef(false);

  useEffect(
    () => () => {
      if (holdTimer.current) clearTimeout(holdTimer.current);
    },
    [],
  );

  function startHold(id: string) {
    if (!enabled || selectMode) return;
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      suppressClick.current = true;
      setSelectMode(true);
      setSelected(new Set([id]));
      window.setTimeout(() => {
        suppressClick.current = false;
      }, 500);
    }, 600);
  }

  function cancelHold() {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleClick(id: string): boolean {
    if (suppressClick.current) {
      suppressClick.current = false;
      return true;
    }
    if (!selectMode) return false;
    toggle(id);
    return true;
  }

  function toggleAll() {
    setSelected((prev) =>
      ids.length > 0 && prev.size === ids.length ? new Set() : new Set(ids),
    );
  }

  function clear() {
    setSelected(new Set());
    setSelectMode(false);
  }

  return {
    selectMode,
    selected,
    allSelected: ids.length > 0 && selected.size === ids.length,
    nothingSelected: selected.size === 0,
    startHold,
    cancelHold,
    handleClick,
    toggleAll,
    clear,
  };
}
