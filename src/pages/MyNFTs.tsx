import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, TrendingUp, Clock, Wallet, LayoutGrid } from 'lucide-react';
import NFTCard from '@/components/ui/nft-card';

const MyNFTs = () => {
  // Mock data
  const userStats = [
    { label: "Total NFTs", value: "12", icon: Wallet, color: "text-primary", bg: "bg-primary/10" },
    { label: "Total Value", value: "45.2 ETH", icon: TrendingUp, color: "text-green-400", bg: "bg-green-400/10" },
    { label: "Active Listings", value: "3", icon: LayoutGrid, color: "text-blue-400", bg: "bg-blue-400/10" },
    { label: "Total Rentals", value: "8", icon: Clock, color: "text-orange-400", bg: "bg-orange-400/10" },
  ];

  const ownedNFTs = [
    {
      id: '1',
      name: 'My Cosmic Art #124',
      image: 'https://images.unsplash.com/photo-1634193295627-1cdddf751ebf?w=400',
      price: '2.8',
      currency: 'ETH',
      collection: 'Personal Collection',
      creator: 'You',
      likes: 24
    },
    {
      id: '2',
      name: 'Digital Portrait #89',
      image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400',
      price: '1.2',
      currency: 'ETH',
      collection: 'Art Collection',
      creator: 'You',
      likes: 12
    },
  ];

  const rentedNFTs = [
    {
      id: '3',
      name: 'Borrowed Dreams #256',
      image: 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=400',
      price: '0.08', // Using price field for rental price display in owned view context if needed, but NFTCard handles rentalPrice
      rentalPrice: '0.08',
      currency: 'ETH',
      collection: 'Dream Series',
      creator: 'ArtistX',
      timeLeft: '3d 12h',
    },
    {
      id: '4',
      name: 'Neon Future #89',
      image: 'https://images.unsplash.com/photo-1634193295627-1cdddf751ebf?w=400',
      rentalPrice: '0.15',
      currency: 'ETH',
      collection: 'Future Collection',
      creator: 'TechArtist',
      timeLeft: '1d 4h',
    },
  ];

  const [activeTab, setActiveTab] = useState('owned');

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold font-heading mb-2">My Dashboard</h1>
          <p className="text-muted-foreground">Manage your collection and listings</p>
        </div>
        <Button variant="premium">
          <Plus className="w-4 h-4 mr-2" />
          Create New Listing
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {userStats.map((stat) => (
          <div key={stat.label} className="bg-card/40 backdrop-blur-md border border-white/5 p-6 rounded-xl hover:bg-card/60 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
                <p className="text-2xl font-bold">{stat.value}</p>
              </div>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${stat.bg}`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs Content */}
      <Tabs defaultValue="owned" className="w-full" onValueChange={setActiveTab}>
        <TabsList className="bg-white/5 border border-white/5 p-1 rounded-xl mb-8 w-full max-w-md">
          <TabsTrigger value="owned" className="flex-1 rounded-lg data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
            Owned
          </TabsTrigger>
          <TabsTrigger value="rented" className="flex-1 rounded-lg data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
            Rented
          </TabsTrigger>
          <TabsTrigger value="listings" className="flex-1 rounded-lg data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
            Listings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="owned" className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {ownedNFTs.map((nft) => (
              <NFTCard
                key={nft.id}
                nft={nft}
                status="owned"
                onAction={(action, id) => console.log(action, id)}
              />
            ))}
            {/* Add New Placeholder */}
            <div className="border border-dashed border-white/10 rounded-xl bg-white/5 flex flex-col items-center justify-center cursor-pointer hover:bg-white/10 transition-colors min-h-[350px] group">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Plus className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="font-medium text-muted-foreground">Mint New NFT</p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="rented" className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {rentedNFTs.map((nft) => (
              <NFTCard
                key={nft.id}
                nft={nft}
                status="rented"
                onAction={(action, id) => console.log(action, id)}
              />
            ))}
          </div>
          {rentedNFTs.length === 0 && (
            <div className="text-center py-20 text-muted-foreground">
              No active rentals found.
            </div>
          )}
        </TabsContent>

        <TabsContent value="listings" className="animate-fade-in">
          <div className="flex flex-col items-center justify-center py-20 border border-dashed border-white/10 rounded-xl bg-white/5">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
              <LayoutGrid className="w-10 h-10 text-primary" />
            </div>
            <h3 className="text-2xl font-bold mb-2">No Active Listings</h3>
            <p className="text-muted-foreground mb-8 max-w-md text-center">
              You haven't listed any NFTs for rent or sale yet. Start listening to earn passive income.
            </p>
            <Button variant="premium">
              Create Listing
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MyNFTs;