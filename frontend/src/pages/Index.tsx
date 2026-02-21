import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Play, Shield, Zap, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import NFTCard from "@/components/ui/nft-card";
import { useAuth } from "@/context/AuthContext";
import api from "@/api/client";

const Index = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    volumeTraded: 0,
    totalListings: 0,
    activeUsers: 0,
    platformFees: 0
  });
  const [trendingNFTs, setTrendingNFTs] = useState<any[]>([]);
  const [loadingNFTs, setLoadingNFTs] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await api.get('/marketplace/stats');
        if (response.data?.status === 'success') {
          const data = response.data.data;
          setStats({
            volumeTraded: data.volumeTraded || 0,
            totalListings: data.totalListings || 0,
            activeUsers: data.activeUsers || 0,
            platformFees: 0
          });
        }
      } catch (error) {
        console.error("Failed to fetch marketplace stats:", error);
      }
    };

    fetchStats();
  }, []);

  useEffect(() => {
    const fetchTrendingNFTs = async () => {
      try {
        setLoadingNFTs(true);
        const response = await api.get(`/marketplace/trending?limit=3`);
        if (response.data?.status === 'success') {
          setTrendingNFTs(response.data.data || []);
        }
      } catch (error) {
        console.error("Failed to fetch trending NFTs:", error);
      } finally {
        setLoadingNFTs(false);
      }
    };

    fetchTrendingNFTs();
  }, [user]);

  return (
    <div className="relative">

      {/* HERO SECTION */}
      <section className="relative w-full h-screen flex items-center justify-center overflow-hidden -mt-24 pt-24">

        {/* Background Image */}
        <div
          className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url('/neuraldao.jpg')`,
            // filter: 'brightness(0.7)' // Handled by overlays now
          }}
        />

        {/* Overlay 1: For Readability */}
        <div
          className="absolute inset-0 z-0"
          style={{ backgroundColor: 'rgba(10, 11, 18, 0.55)' }}
        />

        {/* Overlay 2: Subtle Gradient */}
        <div
          className="absolute inset-0 z-0"
          style={{
            background: 'linear-gradient(to bottom, rgba(10, 11, 18, 0.25), rgba(10, 11, 18, 0.70))'
          }}
        />

        {/* Hero Content */}
        <div className="relative z-10 text-center max-w-4xl mx-auto px-4 mt-[-50px]">

          {/* Tag Line */}
          <h3
            className="text-sm md:text-base font-bold uppercase mb-6"
            style={{
              color: '#B98CFF',
              opacity: 0.9,
              letterSpacing: '1.8px'
            }}
          >
            The Future of NFT Utility
          </h3>

          {/* Main Headline */}
          <h1 className="text-6xl md:text-8xl font-bold font-heading tracking-tight mb-6 text-white leading-tight">
            Rent. Use. Earn.
          </h1>

          {/* Subtitle */}
          <p
            className="text-lg md:text-xl text-white mx-auto mb-10 leading-relaxed max-w-[620px]"
            style={{ opacity: 0.85 }}
          >
            Rent NFTs for gaming, access, and virtual experiences. <br className="hidden md:block" />
            Lend your assets securely and earn passive yield.
          </p>

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-5">
            <Button
              size="lg"
              className="h-14 px-10 text-lg rounded-full text-white border-0 transition-transform hover:scale-105"
              style={{
                background: 'linear-gradient(90deg, #7B61FF, #FF4FD8)',
                boxShadow: '0px 0px 20px rgba(123,97,255,0.35)'
              }}
              asChild
            >
              <Link to="/marketplace">
                Start Exploring <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
            </Button>

            <Button
              size="lg"
              variant="outline"
              className="h-14 px-10 text-lg rounded-full text-white hover:bg-white/10 hover:text-white backdrop-blur-sm bg-transparent transition-transform hover:scale-105"
              style={{
                border: '1px solid rgba(255,255,255,0.7)'
              }}
              asChild
            >
              <Link to="/register">
                Watch Demo <Play className="ml-2 w-5 h-5 fill-current" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Floating Glass Cards */}
        {/* Card 1: Bottom Left */}
        <div className="absolute bottom-10 left-10 md:bottom-20 md:left-20 z-20 hidden lg:block animate-float-slow">
          <div
            className="flex items-center gap-4 p-4 rounded-2xl border border-white/15 bg-white/5 backdrop-blur-md"
            style={{ maxWidth: '300px' }}
          >
            <div className="w-12 h-12 rounded-lg bg-indigo-500/20 flex items-center justify-center">
              <span className="text-2xl">💎</span>
            </div>
            <div>
              <p className="text-white font-medium text-sm">Bored Ape #2341</p>
              <p className="text-emerald-400 text-xs font-bold">Available for rent</p>
            </div>
          </div>
        </div>

        {/* Card 2: Bottom Right */}
        <div className="absolute bottom-10 right-10 md:bottom-32 md:right-20 z-20 hidden lg:block animate-float-reverse">
          <div
            className="flex items-center gap-4 p-4 rounded-2xl border border-white/15 bg-white/5 backdrop-blur-md"
            style={{ maxWidth: '300px' }}
          >
            <div className="w-12 h-12 rounded-lg bg-pink-500/20 flex items-center justify-center">
              <span className="text-2xl">💰</span>
            </div>
            <div>
              <p className="text-white font-medium text-sm">Earn up to 12% APY</p>
              <p className="text-gray-300 text-xs">Lending your NFTs</p>
            </div>
          </div>
        </div>
      </section>

      <div className="w-full -mt-32 p-8 md:p-12 bg-[#0A0B12] border-t border-white/10 shadow-2xl relative z-10 text-white">
        {/* STATS / TRUST */}
        <section className="py-10 mb-20 px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-6xl mx-auto text-center bg-[#6495ED] rounded-[2.5rem] p-12 shadow-xl">
            <div>
              <p className="text-4xl font-bold text-black mb-1">${stats.volumeTraded}</p>
              <p className="text-sm font-medium text-black/60 uppercase tracking-wider">Volume Traded</p>
            </div>
            <div>
              <p className="text-4xl font-bold text-black mb-1">{stats.totalListings}+</p>
              <p className="text-sm font-medium text-black/60 uppercase tracking-wider">NFTs Listed</p>
            </div>
            <div>
              <p className="text-4xl font-bold text-black mb-1">{stats.activeUsers}+</p>
              <p className="text-sm font-medium text-black/60 uppercase tracking-wider">Active Users</p>
            </div>
            <div>
              <p className="text-4xl font-bold text-black mb-1">{stats.platformFees}%</p>
              <p className="text-sm font-medium text-black/60 uppercase tracking-wider">Platform Fees</p>
            </div>
          </div>
        </section>

        {/* TRENDING SECTION */}
        <section className="mb-24 px-6 md:px-12 max-w-7xl mx-auto">
          <div className="flex items-end justify-between mb-10">
            <div>
              <h2 className="text-3xl font-bold mb-2 text-white">Trending Rentals</h2>
              <p className="text-gray-400">Hot items available on the market</p>
            </div>
            <Button variant="link" className="text-primary" asChild>
              <Link to="/marketplace">View All</Link>
            </Button>
          </div>

          {loadingNFTs ? (
            <div className="text-center text-gray-400 py-10">Loading trending items...</div>
          ) : trendingNFTs.length === 0 ? (
            <div className="text-center text-gray-400 py-10">No trending items right now.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {trendingNFTs.slice(0, 3).map((item: any) => (
                <div key={item.id || item._id} className="transform hover:translate-y-[-10px] transition-transform duration-300">
                  <NFTCard nft={{ ...item.nft, price: item.price }} status="listing" />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* FEATURES GRID */}
        <section className="grid md:grid-cols-3 gap-8 mb-24 px-6 md:px-12 max-w-7xl mx-auto">
          <FeatureCard
            icon={<Zap className="w-8 h-8 text-yellow-400" />}
            iconBg="bg-yellow-500/20"
            title="Instant Utility"
            description="Access token-gated communities and games instantly without buying the full asset."
          />
          <FeatureCard
            icon={<Wallet className="w-8 h-8 text-green-400" />}
            iconBg="bg-green-500/20"
            title="Passive Income"
            description="List your idle NFTs for rent and earn yield on your digital collectibles."
          />
          <FeatureCard
            icon={<Shield className="w-8 h-8 text-blue-400" />}
            iconBg="bg-blue-500/20"
            title="Secure Protocol"
            description="Trustless renting via smart contracts. Your ownership is never compromised."
          />
        </section>

        {/* CTA */}
        <section className="relative mx-4 md:mx-12 rounded-3xl overflow-hidden bg-gradient-to-r from-blue-600 to-purple-600 p-12 md:p-20 text-center mb-20">
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20" />
          <div className="relative z-10">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-white">Ready to start your journey?</h2>
            <p className="text-xl text-blue-100 mb-10 max-w-2xl mx-auto">
              Join thousands of users renting and lending on the most secure marketplace.
            </p>
            <Button size="lg" className="h-14 px-10 text-lg rounded-full bg-white text-blue-600 hover:bg-gray-100 shadow-xl">
              Connect Wallet
            </Button>
          </div>
        </section>
      </div>

    </div>
  );
};

const FeatureCard = ({ icon, title, description, iconBg }: { icon: any, title: string, description: string, iconBg: string }) => (
  <div className="p-8 rounded-2xl bg-card/40 border border-white/5 hover:bg-card/60 transition-colors">
    <div className={`w-14 h-14 rounded-xl ${iconBg} flex items-center justify-center mb-6`}>
      {icon}
    </div>
    <h3 className="text-xl font-bold mb-3 text-white">{title}</h3>
    <p className="text-gray-400 leading-relaxed">
      {description}
    </p>
  </div>
);

export default Index;
