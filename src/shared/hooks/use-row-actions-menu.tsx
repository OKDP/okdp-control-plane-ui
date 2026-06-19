import { useRef } from 'react';
import type { ReactNode, SyntheticEvent } from 'react';
import { Menu } from 'primereact/menu';
import type { MenuItem } from 'primereact/menuitem';

export type RowAction<T> =
  | { label: string; icon: string; command: (row: T) => void }
  | { separator: true };

/** Shared popup menu for per-row "actions" buttons in tables. Owns the single
 *  PrimeReact Menu instance and the selected-row ref, so commands receive the
 *  row the menu was opened for. Render `menuElement` once per table and call
 *  `openMenu(row, event)` from each row's trigger. */
export function useRowActionsMenu<T>(actions: RowAction<T>[]): {
  menuElement: ReactNode;
  openMenu: (row: T, event: SyntheticEvent) => void;
} {
  const menuRef = useRef<Menu>(null);
  const selectedRowRef = useRef<T | null>(null);

  const model: MenuItem[] = actions.map((action) =>
    'separator' in action
      ? { separator: true }
      : {
          label: action.label,
          icon: action.icon,
          command: () => {
            if (selectedRowRef.current !== null) action.command(selectedRowRef.current);
          },
        },
  );

  const menuElement = <Menu ref={menuRef} model={model} popup appendTo={document.body} />;

  const openMenu = (row: T, event: SyntheticEvent) => {
    selectedRowRef.current = row;
    menuRef.current?.toggle(event);
  };

  return { menuElement, openMenu };
}
