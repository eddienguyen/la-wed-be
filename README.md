# Wedding Guest Management Backend

Backend API for the personalized wedding invitation system.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- Supabase account (free tier)
- Render.com account for deployment (free tier)

### Setup Instructions

#### 1. Environment Setup

1. Copy environment variables:
```bash
cp .env.example .env
```

2. Create a Supabase project:
   - Go to https://supabase.com
   - Create a new project
   - Go to Settings > Database
   - Copy the connection string and update `.env`

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
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment | `development` |
| `CORS_ORIGIN` | Frontend URL for CORS | `http://localhost:5173` |
| `LOG_LEVEL` | Logging level | `debug` |

## 🚀 Deployment

### Render.com Deployment

For complete deployment instructions, see [Render Deployment Guide](../docs/feature/32-render-deployment-guide.md).

**Quick Steps:**
1. Create Render.com account
2. Create new "Web Service"
3. Connect GitHub repository (la-wed-be)
4. Configure:
   - Root Directory: `backend`
   - Build Command: `npm install && npm run prisma:generate`
   - Start Command: `npm start`
5. Add environment variables (see guide)
6. Deploy

### Environment Variables for Production
```env
NODE_ENV=production
DATABASE_URL=postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
DIRECT_URL=postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres
PORT=3000
CORS_ORIGIN=https://ngocquanwd.com
LOG_LEVEL=info
```

**Post-Deployment:**
- Run migrations via Render Shell: `npm run prisma:migrate:deploy`
- Test health endpoint: `https://[your-app].onrender.com/api/health`

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
   - Verify Supabase credentials in `.env`
   - Check database URL format
   - Ensure database is running

2. **Prisma Client Not Generated**
   - Run `npm run prisma:generate`
   - Check schema.prisma syntax
   - Verify database connection

3. **CORS Errors**
   - Update `CORS_ORIGIN` in `.env`
   - Check frontend URL matches

4. **Port Already in Use**
   - Change `PORT` in `.env`
   - Kill existing processes on port

## 📚 Next Steps

1. **Story #33**: Implement Guest CRUD API endpoints
2. **Story #34**: Setup image processing service
3. **Story #35**: Build admin panel frontend

## 🛠️ Technology Stack

- **Framework**: Express.js
- **Database**: PostgreSQL (Supabase)
- **ORM**: Prisma
- **Language**: JavaScript (ES Modules)
- **Hosting**: Render.com
- **Development**: Nodemon

## 📖 Learning Resources

- [Express.js Documentation](https://expressjs.com/)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [Supabase Documentation](https://supabase.com/docs)
- [Render Documentation](https://render.com/docs)