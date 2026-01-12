# NFT Rental Marketplace - Backend API

A comprehensive backend API for the NFT Rental Marketplace built with Node.js, Express, and TypeScript.

## 🚀 Features

- **NFT Management**: Complete CRUD operations for NFTs
- **Marketplace**: Listings, search, filtering, and trending NFTs
- **Rental System**: Create rentals, rent NFTs, return NFTs, and view rental history
- **User Dashboard**: User statistics, owned NFTs, rented NFTs, and listings
- **Type-Safe**: Built with TypeScript for better development experience
- **Mock Data**: Pre-populated with sample data for testing

## 📁 Project Structure

```
backend/
├── src/
│   ├── controllers/          # Request handlers
│   │   ├── nft.controller.ts
│   │   ├── marketplace.controller.ts
│   │   ├── rental.controller.ts
│   │   └── user.controller.ts
│   ├── routes/               # API routes
│   │   ├── nft.routes.ts
│   │   ├── marketplace.routes.ts
│   │   ├── rental.routes.ts
│   │   └── user.routes.ts
│   ├── middleware/           # Custom middleware
│   │   └── errorHandler.ts
│   ├── types/                # TypeScript types
│   │   └── index.ts
│   └── server.ts             # Main server file
├── package.json
├── tsconfig.json
└── .env.example
```

## 🛠️ Installation

1. **Navigate to the backend directory:**
   ```bash
   cd backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Create environment file:**
   ```bash
   cp .env.example .env
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```

The server will start on `http://localhost:5000`

## 📚 API Endpoints

### Health Check
- `GET /health` - Check if the API is running

### NFT Routes (`/api/nfts`)
- `GET /api/nfts` - Get all NFTs (supports filtering by status, collection, price range)
- `GET /api/nfts/:id` - Get NFT by ID
- `POST /api/nfts` - Create a new NFT
- `PUT /api/nfts/:id` - Update an NFT
- `DELETE /api/nfts/:id` - Delete an NFT
- `GET /api/nfts/user/:userId` - Get NFTs by user ID

### Marketplace Routes (`/api/marketplace`)
- `GET /api/marketplace` - Get all marketplace listings (with pagination)
- `GET /api/marketplace/search` - Search and filter listings
- `GET /api/marketplace/trending` - Get trending NFTs
- `GET /api/marketplace/stats` - Get marketplace statistics
- `POST /api/marketplace/listings` - Create a new listing
- `DELETE /api/marketplace/listings/:id` - Delete a listing

### Rental Routes (`/api/rentals`)
- `GET /api/rentals` - Get all rentals (supports filtering)
- `GET /api/rentals/:id` - Get rental by ID
- `POST /api/rentals` - Create a new rental listing
- `POST /api/rentals/:id/rent` - Rent an NFT
- `PUT /api/rentals/:id/return` - Return a rented NFT
- `GET /api/rentals/active/list` - Get active rentals
- `GET /api/rentals/history/list` - Get rental history

### User Routes (`/api/users`)
- `GET /api/users/:id/stats` - Get user statistics
- `GET /api/users/:id/owned` - Get user's owned NFTs
- `GET /api/users/:id/rented` - Get user's rented NFTs
- `GET /api/users/:id/listings` - Get user's active listings
- `GET /api/users/:id/profile` - Get user profile
- `PUT /api/users/:id/profile` - Update user profile

## 📝 Example Requests

### Get All NFTs
```bash
curl http://localhost:5000/api/nfts
```

### Create a New NFT
```bash
curl -X POST http://localhost:5000/api/nfts \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My NFT #001",
    "description": "A beautiful NFT",
    "image": "https://example.com/image.jpg",
    "owner": "user1",
    "collection": "My Collection",
    "creator": "Artist",
    "price": "1.5",
    "rentalPrice": "0.05",
    "currency": "ETH"
  }'
```

### Search Marketplace
```bash
curl "http://localhost:5000/api/marketplace/search?query=cosmic&sortBy=price_asc"
```

### Rent an NFT
```bash
curl -X POST http://localhost:5000/api/rentals/1/rent \
  -H "Content-Type: application/json" \
  -d '{
    "renterId": "user3",
    "duration": 7
  }'
```

### Get User Stats
```bash
curl http://localhost:5000/api/users/user1/stats
```

## 🔧 Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

## 📦 Response Format

All API responses follow this format:

**Success Response:**
```json
{
  "status": "success",
  "data": { ... },
  "message": "Optional success message"
}
```

**Error Response:**
```json
{
  "status": "error",
  "error": "Error message"
}
```

## 🔜 Future Enhancements

- Database integration (MongoDB/PostgreSQL)
- JWT authentication
- Input validation with express-validator
- Rate limiting
- File upload for NFT images
- WebSocket for real-time updates
- Blockchain integration

## 📄 License

MIT
