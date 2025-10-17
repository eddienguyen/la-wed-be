# Wedding Guest Management Backend

Backend API for the personalized wedding invitation system.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- PostgreSQL database (Fly.io recommended)
- Fly.io account for deployment (https://fly.io)

### Setup Instructions

#### 1. Environment Setup

1. Copy environment variables:
```bash
cp .env.example .env
```

2. Setup PostgreSQL database:
   - For Fly.io deployment: Follow [Fly.io Migration Guide](MIGRATION-GUIDE-FLYIO.md)
   - For local development: Use Docker Compose (see below)

#### 2. Install Dependencies

```bash
npm install
```

#### 3. Database Setup

```bash
# Generate Prisma client
npm run prisma:generate

# Apply database migrations
npm run prisma:migrate

# Open Prisma Studio (optional)
npm run prisma:studio
```

#### 4. Start Development Server

```bash
npm run dev
```

The API will be available at `http://localhost:3000`

## 📋 API Endpoints

### Health Check
- `GET /api/health` - Server and database health status
- `GET /api/health/database` - Database connection status

### Root
- `GET /` - API information and available endpoints

## 🗄️ Database Schema

### Guest Model
```sql
CREATE TABLE guests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  secondary_note VARCHAR(200),
  venue VARCHAR NOT NULL CHECK (venue IN ('hue', 'hanoi')),
  invitation_url VARCHAR(255) NOT NULL,
  invitation_image_url VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_guests_venue ON guests(venue);
CREATE INDEX idx_guests_created_at ON guests(created_at);
```

## 🔧 Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with auto-reload
- `npm run prisma:generate` - Generate Prisma client
- `npm run prisma:migrate` - Run database migrations
- `npm run prisma:studio` - Open Prisma Studio
- `npm run prisma:reset` - Reset database

## 🌍 Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `DIRECT_URL` | Direct PostgreSQL connection | Same as DATABASE_URL |
| `PORT` | Server port | `8080` (Fly.io) or `3000` (local) |
| `NODE_ENV` | Environment | `development` or `production` |
| `CORS_ORIGIN` | Frontend URL for CORS | `http://localhost:5173` |
| `FRONTEND_URL` | Frontend URL for invitations | `https://ngocquanwd.com` |
| `LOG_LEVEL` | Logging level | `debug` or `info` |

## 🚀 Deployment

### Fly.io Deployment (Recommended)

For complete deployment instructions, see [Fly.io Migration Guide](MIGRATION-GUIDE-FLYIO.md).

**Quick Deploy:**
```bash
# Install flyctl CLI
brew install flyctl  # macOS
# or curl -L https://fly.io/install.sh | sh  # Linux

# Login
flyctl auth login

# Complete setup (database + app)
./scripts/deploy-flyio.sh setup

# Deploy application
./scripts/deploy-flyio.sh deploy

# Run migrations
./scripts/deploy-flyio.sh migrate
```

**Benefits over previous setup:**
- ✅ No cold starts (always-on)
- ✅ Better reliability (no instance failures)
- ✅ Integrated database with automatic backups
- ✅ Better monitoring and logging
- ✅ Geographic distribution support

### Local Development with Docker

```bash
# Start PostgreSQL database
docker-compose up -d db

# Update .env with local database URL
DATABASE_URL=postgres://postgres:postgres@localhost:5432/wedding_event
DIRECT_URL=postgres://postgres:postgres@localhost:5432/wedding_event

# Run migrations
npm run prisma:migrate

# Start development server
npm run dev
```

### Environment Variables for Production

See [.env.example](.env.example) for all available variables.

**Required:**
```env
NODE_ENV=production
DATABASE_URL=postgres://postgres:[PASSWORD]@[DB_HOST]:5432/[DB_NAME]
DIRECT_URL=postgres://postgres:[PASSWORD]@[DB_HOST]:5432/[DB_NAME]
PORT=8080
CORS_ORIGIN=https://ngocquanwd.com
FRONTEND_URL=https://ngocquanwd.com
LOG_LEVEL=info
```

**Optional (Cloudflare R2 for images):**
```env
R2_ENDPOINT=https://[ACCOUNT_ID].r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=[YOUR_ACCESS_KEY]
R2_SECRET_ACCESS_KEY=[YOUR_SECRET_KEY]
R2_BUCKET_NAME=[YOUR_BUCKET_NAME]
R2_PUBLIC_URL=https://images.ngocquanwd.com
```

## 🧪 Testing

### Manual Testing

1. **Health Check**:
```bash
curl http://localhost:3000/api/health
```

2. **Database Health**:
```bash
curl http://localhost:3000/api/health/database
```

### Expected Responses

**Healthy Server**:
```json
{
  "success": true,
  "data": {
    "message": "Server is healthy",
    "server": {
      "status": "running",
      "uptime": 123.456,
      "timestamp": "2025-10-12T10:30:00Z",
      "nodeVersion": "v22.15.0",
      "environment": "development"
    },
    "database": {
      "status": "connected",
      "latency": "15ms",
      "timestamp": "2025-10-12T10:30:00Z"
    }
  }
}
```

## 🔍 Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Verify database URL in `.env` or Fly.io secrets
   - Check database is running: `flyctl status --app la-wed-database`
   - Ensure database is accessible

2. **Prisma Client Not Generated**
   - Run `npm run prisma:generate`
   - Check schema.prisma syntax
   - Verify database connection

3. **CORS Errors**
   - Update `CORS_ORIGIN` in `.env` or Fly.io secrets
   - Check frontend URL matches

4. **Port Already in Use**
   - Change `PORT` in `.env`
   - Kill existing processes on port: `lsof -ti:3000 | xargs kill`

## 📚 Documentation

- [Fly.io Migration Guide](MIGRATION-GUIDE-FLYIO.md) - Complete migration instructions
- [Archive: Supabase/Render.com Setup](ARCHIVE-SUPABASE-RENDER-SETUP.md) - Historical reference

## 📚 Next Steps

1. **Complete Migration**: Follow [Fly.io Migration Guide](MIGRATION-GUIDE-FLYIO.md)
2. **Setup Monitoring**: Configure alerts and metrics
3. **Implement Features**: Continue with guest management features
4. **Optimize Performance**: Fine-tune database and app resources

## 🛠️ Technology Stack

- **Framework**: Express.js
- **Database**: PostgreSQL (Fly.io)
- **ORM**: Prisma
- **Language**: JavaScript (ES Modules)
- **Hosting**: Fly.io
- **Image Storage**: Cloudflare R2 (optional)
- **Development**: Nodemon

## 📖 Learning Resources

- [Express.js Documentation](https://expressjs.com/)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [Fly.io Documentation](https://fly.io/docs/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)