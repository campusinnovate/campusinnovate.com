import Navbar from '@/components/layout/navbar';
import Footer from '@/components/layout/footer';
import Homepage from '@/components/public/Homepage';

export default function RootPage() {
  return (
    <div className="public-site min-h-screen">
      <Navbar />
      <Homepage />
      <Footer />
    </div>
  );
}
