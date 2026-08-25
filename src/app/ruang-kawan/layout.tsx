import WorkspaceMiniNav from '@/components/ruang-kawan/WorkspaceMiniNav';
import KawanAiPanel from '@/components/ruang-kawan/KawanAiPanel';

export default function RuangKawanLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <><WorkspaceMiniNav />{children}<KawanAiPanel /></>;
}
