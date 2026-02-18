import { Link } from "react-router-dom";

const Footer = () => {
    return (
        <footer className="mt-auto border-t border-white/10 bg-zinc-900 text-white">
            <div className="container-wide px-6 py-16">
                {/* Top Section */}
                <div className="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-4">

                    {/* Brand */}
                    <div className="space-y-5">
                        <Link to="/" className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-blue-600">
                                <div className="h-4 w-4 rounded-sm bg-white" />
                            </div>
                            <span className="text-xl font-bold tracking-tight font-heading">
                                RentableNFT
                            </span>
                        </Link>

                        <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
                            A decentralized marketplace enabling secure renting and lending
                            of NFTs. Built on transparency, security, and community ownership.
                        </p>
                    </div>

                    {/* Marketplace */}
                    <div>
                        <h4 className="mb-5 text-sm font-semibold uppercase tracking-wide text-white">
                            Marketplace
                        </h4>
                        <ul className="space-y-3 text-sm text-muted-foreground">
                            <li>
                                <Link to="/marketplace" className="hover:text-primary transition-colors">
                                    Explore NFTs
                                </Link>
                            </li>
                            <li>
                                <Link to="/marketplace?category=art" className="hover:text-primary transition-colors">
                                    Art
                                </Link>
                            </li>
                            <li>
                                <Link to="/marketplace?category=gaming" className="hover:text-primary transition-colors">
                                    Gaming
                                </Link>
                            </li>
                            <li>
                                <Link to="/marketplace?category=utility" className="hover:text-primary transition-colors">
                                    Utility
                                </Link>
                            </li>
                        </ul>
                    </div>

                    {/* Account */}
                    <div>
                        <h4 className="mb-5 text-sm font-semibold uppercase tracking-wide text-white">
                            Account
                        </h4>
                        <ul className="space-y-3 text-sm text-muted-foreground">
                            <li>
                                <Link to="/my-nfts" className="hover:text-primary transition-colors">
                                    My Collection
                                </Link>
                            </li>
                            <li>
                                <Link to="/login" className="hover:text-primary transition-colors">
                                    Connect Wallet
                                </Link>
                            </li>
                            <li>
                                <Link to="/settings" className="hover:text-primary transition-colors">
                                    Settings
                                </Link>
                            </li>
                        </ul>
                    </div>

                    {/* Legal */}
                    <div>
                        <h4 className="mb-5 text-sm font-semibold uppercase tracking-wide text-white">
                            Legal
                        </h4>
                        <ul className="space-y-3 text-sm text-muted-foreground">
                            <li>
                                <a href="#" className="hover:text-primary transition-colors">
                                    Privacy Policy
                                </a>
                            </li>
                            <li>
                                <a href="#" className="hover:text-primary transition-colors">
                                    Terms of Service
                                </a>
                            </li>
                            <li>
                                <a href="#" className="hover:text-primary transition-colors">
                                    Cookie Policy
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Bottom Section */}
                <div className="mt-16 flex flex-col gap-6 border-t border-white/5 pt-8 md:flex-row md:items-center md:justify-between">
                    <p className="text-xs text-muted-foreground">
                        © {new Date().getFullYear()} RentableNFT DAO. All rights reserved.
                    </p>

                    <div className="flex gap-9 text-xs text-muted-foreground -ml-4">
                        <a
                            href="https://github.com/YashBhardwaj21/nft"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-white transition-colors"
                        >
                            Github
                        </a>
                    </div>

                </div>
            </div>
        </footer>
    );
};

export default Footer;
