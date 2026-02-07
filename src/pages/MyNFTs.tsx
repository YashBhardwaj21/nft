import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, TrendingUp, Clock, Wallet, LayoutGrid, Loader2 } from 'lucide-react';
import NFTCard from '@/components/ui/nft-card';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import { NFT } from '../types';
import { toast } from 'sonner';
import RentListingModal from '@/components/rentals/RentListingModal';

const MyNFTs = () => {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('owned');
  const [ownedNFTs, setOwnedNFTs] = useState<NFT[]>([]);
  const [rentedNFTs, setRentedNFTs] = useState<NFT[]>([]);
  const [activeListings, setActiveListings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Rental Modal State
  const [isRentModalOpen, setIsRentModalOpen] = useState(false);
  const [selectedNftForRent, setSelectedNftForRent] = useState<NFT | null>(null);

  const [stats, setStats] = useState({
    totalNFTs: 0,
    totalValue: '0',
    activeListings: 0,
    totalRentals: 0
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login');
      return;
    }

    if (user?.id) {
      fetchUserData();
    }
  }, [user, authLoading, isAuthenticated]);

  const fetchUserData = async () => {
    setIsLoading(true);
    try {
      // Fetch Owned
      const ownedRes = await api.get(`/users/${user?.id}/owned`);
      setOwnedNFTs(ownedRes.data.data || []);

      // Fetch Rented
      const rentedRes = await api.get(`/users/${user?.id}/rented`);
      setRentedNFTs(rentedRes.data.data || []);

      // Fetch Listings
      const listingsRes = await api.get(`/users/${user?.id}/listings`);
      setActiveListings(listingsRes.data.data || []);

      // Fetch Stats
      const statsRes = await api.get(`/users/${user?.id}/stats`);
      const userStats = statsRes.data.data;

      setStats({
        totalNFTs: userStats.ownedCount || 0,
        totalValue: `${userStats.totalValue || 0} ETH`,
        activeListings: userStats.listingsCount || 0,
        totalRentals: userStats.rentedCount || 0
      });

    } catch (error) {
      console.error("Error fetching user data:", error);
      toast.error("Failed to load your collection");
    } finally {
      setIsLoading(false);
    }
  };

  const dashboardStats = [
    { label: "Total NFTs", value: stats.totalNFTs.toString(), icon: Wallet, color: "text-primary", bg: "bg-primary/10" },
    { label: "Total Value", value: stats.totalValue, icon: TrendingUp, color: "text-green-400", bg: "bg-green-400/10" },
    { label: "Active Listings", value: stats.activeListings.toString(), icon: LayoutGrid, color: "text-blue-400", bg: "bg-blue-400/10" },
    { label: "Total Rentals", value: stats.totalRentals.toString(), icon: Clock, color: "text-orange-400", bg: "bg-orange-400/10" },
  ];

  if (authLoading || isLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  const handleListForRent = (nft: NFT) => {
    setSelectedNftForRent(nft);
    setIsRentModalOpen(true);
  };

  const handleReturn = async (nftId: string) => {
    try {
      await api.put(`/rentals/return/${nftId}`);
      toast.success("NFT Returned successfully");
      fetchUserData();
    } catch (e: any) {
      console.error(e);
      toast.error(e.response?.data?.error || "Failed to return NFT");
    }
  };

  const handleAction = (action: string, id: string) => {
    if (action === 'list') {
      const nft = ownedNFTs.find(n => n.id === id);
      if (nft) handleListForRent(nft);
    } else if (action === 'return') {
      // For return, we now just pass the NFT ID directly
      handleReturn(id);
    }
  };

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
        {dashboardStats.map((stat) => (
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
      <Tabs value={activeTab} className="w-full" onValueChange={setActiveTab}>
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
                onAction={handleAction}
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
          {ownedNFTs.length === 0 && (
            <div className="col-span-full text-center py-10 text-muted-foreground">
              You don't own any NFTs yet.
            </div>
          )}
        </TabsContent>

        <TabsContent value="rented" className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {rentedNFTs.map((nft) => (
              <NFTCard
                key={nft.id}
                nft={nft}
                status="rented"
                onAction={handleAction}
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
          {activeListings.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {/* Reuse NFTCard but maybe map listing items to NFT shape or create new card */}
              {activeListings.map((listing: any) => (
                <NFTCard
                  key={listing.id}
                  nft={{ ...listing.nft, price: listing.price, rentalPrice: listing.rentalPrice }}
                  status="listing"
                  onAction={handleAction}
                />
              ))}
            </div>
          ) : (
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
          )}
        </TabsContent>
      </Tabs>
      <RentListingModal
        isOpen={isRentModalOpen}
        onClose={() => setIsRentModalOpen(false)}
        nft={selectedNftForRent}
        onSuccess={() => {
          fetchUserData();
          setIsRentModalOpen(false);
          toast.success("Listing created successfully");
        }}
      />
    </div>
  );
};

export default MyNFTs;