'use client';

import { useEffect, useRef, type RefObject } from 'react';

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const openDialogs: HTMLElement[] = [];
let bodyOverflowBeforeDialogs: string | null = null;

export function useModalDialog(
  open: boolean,
  dialogRef: RefObject<HTMLElement | null>,
  onClose: () => void,
) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (openDialogs.length === 0) bodyOverflowBeforeDialogs = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    openDialogs.push(dialog);

    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector));
    const focusInitial = () => {
      const initial = dialog.querySelector<HTMLElement>('[data-dialog-initial-focus]');
      (initial ?? focusable()[0] ?? dialog).focus();
    };
    focusInitial();
    const focusFrame = window.requestAnimationFrame(focusInitial);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (openDialogs.at(-1) !== dialog) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const elements = focusable();
      if (elements.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = elements[0]!;
      const last = elements.at(-1)!;
      if (!dialog.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      window.cancelAnimationFrame(focusFrame);
      const dialogIndex = openDialogs.lastIndexOf(dialog);
      if (dialogIndex >= 0) openDialogs.splice(dialogIndex, 1);
      if (openDialogs.length === 0 && bodyOverflowBeforeDialogs !== null) {
        document.body.style.overflow = bodyOverflowBeforeDialogs;
        bodyOverflowBeforeDialogs = null;
      }
      previousFocus?.focus();
    };
  }, [dialogRef, open]);
}
