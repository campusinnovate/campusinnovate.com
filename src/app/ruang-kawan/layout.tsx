import WorkspaceMiniNav from '@/components/ruang-kawan/WorkspaceMiniNav';
import KawanAiPanel from '@/components/ruang-kawan/KawanAiPanel';
import RuangKawanNotificationProvider from '@/components/ruang-kawan/RuangKawanNotificationProvider';
import DesktopBridge from '@/components/ruang-kawan/DesktopBridge';

export default function RuangKawanLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <><DesktopBridge/><RuangKawanNotificationProvider/><WorkspaceMiniNav />{children}<KawanAiPanel /></>;
}
