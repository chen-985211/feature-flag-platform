import { NavLink, useLocation } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuLink,
} from './ui/navigation-menu';
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipContent,
} from './ui/tooltip';
export function WorkspaceNavigation({
  items,
  mobile = false,
}: {
  items: readonly {
    path: string;
    href: string;
    label: string;
    icon: LucideIcon;
  }[];
  mobile?: boolean;
}) {
  const { pathname } = useLocation();
  return (
    <TooltipProvider delayDuration={400}>
      <NavigationMenu
        viewport={false}
        orientation={mobile ? 'horizontal' : 'vertical'}
        className={'workspace-nav ' + (mobile ? 'mobile-nav' : 'desktop-nav')}
        aria-label={mobile ? '工作空间导航' : '主要导航'}
      >
        <NavigationMenuList>
          {items.map(({ path, href, label, icon: Icon }) => {
            const active = pathname === path || pathname.startsWith(path + '/');
            return (
              <NavigationMenuItem key={path}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <NavigationMenuLink
                      asChild
                      active={active}
                      className={'nav-item' + (active ? ' active' : '')}
                    >
                      <NavLink aria-label={label} to={href}>
                        <Icon aria-hidden="true" />
                        <span>{label}</span>
                      </NavLink>
                    </NavigationMenuLink>
                  </TooltipTrigger>
                  <TooltipContent side={mobile ? 'bottom' : 'right'}>
                    {label}
                  </TooltipContent>
                </Tooltip>
              </NavigationMenuItem>
            );
          })}
        </NavigationMenuList>
      </NavigationMenu>
    </TooltipProvider>
  );
}
