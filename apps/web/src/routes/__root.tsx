import { createRootRoute, Outlet } from '@tanstack/react-router'
export const Route = createRootRoute({ component: () => <Outlet />, notFoundComponent: () => <p className="p-8">页面不存在</p> })
