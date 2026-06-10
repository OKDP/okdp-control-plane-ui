/* Class lists for sidebar navigation entries, shared by the console shell
   and the project console's nav sections. */

interface NavLinkClassOptions {
  active?: boolean;
  collapsed: boolean;
  sub?: boolean;
  disabled?: boolean;
}

/** Class list for a sidebar navigation entry (link or inert placeholder). */
export function sideNavLinkClass({ active, collapsed, sub, disabled }: NavLinkClassOptions) {
  return [
    'group mb-px flex items-center no-underline transition-[color,background-color] duration-150 ease-smooth',
    sub ? 'text-sm' : 'text-base',
    collapsed
      ? 'justify-center rounded-md p-2'
      : [
          'rounded-r-md border-l-2 px-2.5 py-1.5 max-lg:justify-center max-lg:rounded-md max-lg:border-l-0 max-lg:p-2',
          sub && 'pl-[2.1rem] max-lg:pl-[2.1rem]',
          active ? 'border-l-primary' : 'border-l-transparent',
        ],
    active
      ? 'bg-primary-50 font-semibold text-primary'
      : disabled
        ? 'cursor-not-allowed font-medium text-fg-muted opacity-45 hover:bg-transparent hover:text-fg-muted'
        : 'font-medium text-fg-secondary hover:bg-surface-secondary hover:text-fg',
  ]
    .flat()
    .filter(Boolean)
    .join(' ');
}

/** Class list for the icon of a sidebar navigation entry. */
export function sideNavIconClass(active: boolean) {
  return `w-[18px] text-center text-[1rem] transition-colors duration-150 ease-smooth ${
    active ? 'text-primary' : 'text-fg-muted group-hover:text-fg-secondary'
  }`;
}

/** Class list for the label of a sidebar navigation entry. */
export function sideNavLabelClass(collapsed: boolean) {
  return `overflow-hidden whitespace-nowrap transition-[max-width,margin] duration-400 ease-smooth ${
    collapsed ? 'ml-0 max-w-0' : 'ml-2 max-w-[200px] max-lg:ml-0 max-lg:max-w-0'
  }`;
}
