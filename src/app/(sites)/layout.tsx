import Navbar from '@/components/layout/navbar';
import Footer from '@/components/layout/footer';

export default function DashboardLayout({children}: Readonly<{children: React.ReactNode}>){
     return (
           <div className="public-site min-h-screen">
                <Navbar />
               {children}
                <Footer />
           </div>
     )
}
