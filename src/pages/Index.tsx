import { Link } from "react-router-dom";
import { ArrowRight, Play, Shield, Zap, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import NFTCard from "@/components/ui/nft-card";
import { Badge } from "@/components/ui/badge";

const Index = () => {
  // Featured NFTs for Hero/Showcase
  const featuredNFTs = [
    {
      id: "1",
      name: "Ethereal Dreams #001",
      image: "https://images.unsplash.com/photo-1634193295627-1cdddf751ebf?w=400",
      price: "3.5",
      rentalPrice: "0.15",
      currency: "ETH",
      collection: "Ethereal Collection",
      creator: "DigitalArtist",
      likes: 120
    },
    {
      id: "2",
      name: "Neon Genesis #256",
      image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400",
      price: "2.8",
      rentalPrice: "0.12",
      currency: "ETH",
      collection: "Genesis Series",
      creator: "NeonCreator",
      likes: 85
    },
    {
      id: "3",
      name: "Cosmic Voyage #078",
      image: "https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=400",
      price: "4.2",
      rentalPrice: "0.18",
      currency: "ETH",
      collection: "Cosmic Collection",
      creator: "SpaceArt",
      likes: 210
    }
  ];

  return (
    <div className="relative">
      {/* Hero Background Effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-primary/20 blur-[120px] rounded-full pointer-events-none opacity-50" />
      <div className="absolute top-[200px] right-0 w-[600px] h-[400px] bg-purple-500/20 blur-[100px] rounded-full pointer-events-none opacity-40" />

      {/* HERO SECTION */}
      <section className="relative pt-12 pb-20 md:pt-20 md:pb-32 text-center">
        <Badge variant="premium" className="mb-6 px-4 py-1.5 text-sm uppercase tracking-wider">
          The Future of NFT Utility
        </Badge>

        <h1 className="text-6xl md:text-8xl font-bold font-heading tracking-tight mb-8">
          Rent. Use. <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-blue-400 to-purple-500 animate-gradient-pan bg-[length:200%_auto]">
            Monetize.
          </span>
        </h1>

        <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto mb-10 leading-relaxed">
          Unlock the potential of digital assets. Rent NFTs for gaming, utility, or art.
          Lend your collection to earn passive income.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button size="lg" variant="premium" className="h-14 px-8 text-lg rounded-full" asChild>
            <Link to="/marketplace">
              Start Exploring
              <ArrowRight className="ml-2 w-5 h-5" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" className="h-14 px-8 text-lg rounded-full border-white/10 bg-white/5 hover:bg-white/10" asChild>
            <Link to="/register">
              <Play className="mr-2 w-5 h-5 fill-current" />
              How it Works
            </Link>
          </Button>
        </div>
      </section>

      {/* STATS / TRUST */}
      <section className="py-10 border-y border-white/5 bg-white/5 backdrop-blur-sm mb-20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-5xl mx-auto text-center">
          <div>
            <p className="text-3xl font-bold text-white mb-1">$12M+</p>
            <p className="text-sm text-muted-foreground">Volume Traded</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-white mb-1">45K+</p>
            <p className="text-sm text-muted-foreground">NFTs Listed</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-white mb-1">10K+</p>
            <p className="text-sm text-muted-foreground">Active Users</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-white mb-1">0%</p>
            <p className="text-sm text-muted-foreground">Platform Fees</p>
          </div>
        </div>
      </section>

      {/* TRENDING SECTION */}
      <section className="mb-24">
        <div className="flex items-end justify-between mb-10">
          <div>
            <h2 className="text-3xl font-bold mb-2">Trending Rentals</h2>
            <p className="text-muted-foreground">Hot assets being rented right now</p>
          </div>
          <Button variant="link" className="text-primary">View All</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {featuredNFTs.map(nft => (
            <div key={nft.id} className="tilt-on-hover">
              <NFTCard nft={nft} />
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES GRID */}
      <section className="grid md:grid-cols-3 gap-8 mb-24">
        <FeatureCard
          icon={<Zap className="w-8 h-8 text-yellow-400" />}
          title="Instant Utility"
          description="Access token-gated communities and games instantly without buying the full asset."
        />
        <FeatureCard
          icon={<Wallet className="w-8 h-8 text-green-400" />}
          title="Passive Income"
          description="List your idle NFTs for rent and earn yield on your digital collectibles."
        />
        <FeatureCard
          icon={<Shield className="w-8 h-8 text-blue-400" />}
          title="Secure Protocol"
          description="Trustless renting via smart contracts. Your ownership is never compromised."
        />
      </section>

      {/* CTA */}
      <section className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-blue-600 to-purple-600 p-12 md:p-20 text-center">
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
  );
};

const FeatureCard = ({ icon, title, description }: { icon: any, title: string, description: string }) => (
  <div className="p-8 rounded-2xl bg-card/40 border border-white/5 hover:bg-card/60 transition-colors">
    <div className="w-14 h-14 rounded-xl bg-white/5 flex items-center justify-center mb-6">
      {icon}
    </div>
    <h3 className="text-xl font-bold mb-3">{title}</h3>
    <p className="text-muted-foreground leading-relaxed">
      {description}
    </p>
  </div>
);

export default Index;
