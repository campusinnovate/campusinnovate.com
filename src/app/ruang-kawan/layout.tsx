import WorkspaceMiniNav from '@/components/ruang-kawan/WorkspaceMiniNav';

export default function RuangKawanLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <><WorkspaceMiniNav />{children}</>;
}
