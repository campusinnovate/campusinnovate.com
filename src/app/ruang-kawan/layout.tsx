import WorkspaceMiniNav from '@/components/ruang-kawan/WorkspaceMiniNav';
import KawanAiPanel from '@/components/ruang-kawan/KawanAiPanel';
import RuangKawanNotificationProvider from '@/components/ruang-kawan/RuangKawanNotificationProvider';

export default function RuangKawanLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <><RuangKawanNotificationProvider/><WorkspaceMiniNav />{children}<KawanAiPanel /></>;
}
