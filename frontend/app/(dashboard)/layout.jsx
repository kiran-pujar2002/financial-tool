// app/(dashboard)/layout.jsx
'use client';

import DashboardLayout from '@/components/DashboardLayout';
import { usePathname } from 'next/navigation';

export default function DashboardLayoutWrapper({ children }) {
    const pathname = usePathname();
    
    // Pages where we don't want the sidebar
    const noSidebarPages = ['/login', '/signup', '/share'];
    if (noSidebarPages.some(page => pathname?.startsWith(page))) {
        return <>{children}</>;
    }

    return <DashboardLayout>{children}</DashboardLayout>;
}