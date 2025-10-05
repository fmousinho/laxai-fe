import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { statusEnum } from '../lib/db';

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.POSTGRES_URL!);
const db = drizzle(sql);

async function setupDatabase() {
  console.log('Setting up database...');
  
  try {
    // Create the status enum
    await sql`CREATE TYPE status AS ENUM ('active', 'inactive', 'archived')`;
    console.log('✓ Created status enum');
  } catch (error: any) {
    if (error.message.includes('already exists')) {
      console.log('✓ Status enum already exists');
    } else {
      console.error('Error creating status enum:', error);
    }
  }

  try {
    // Create the products table
    await sql`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        image_url TEXT NOT NULL,
        name TEXT NOT NULL,
        status status NOT NULL,
        price NUMERIC(10, 2) NOT NULL,
        stock INTEGER NOT NULL,
        available_at TIMESTAMP NOT NULL
      )
    `;
    console.log('✓ Created products table');
  } catch (error) {
    console.error('Error creating products table:', error);
  }

  // Insert some sample data
  try {
    const sampleProducts = [
      {
        imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300',
        name: 'Vintage Watch',
        status: 'active' as const,
        price: '299.99',
        stock: 15,
        availableAt: new Date()
      },
      {
        imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=300',
        name: 'Wireless Headphones',
        status: 'active' as const,
        price: '199.99',
        stock: 25,
        availableAt: new Date()
      },
      {
        imageUrl: 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=300',
        name: 'Smart Watch',
        status: 'inactive' as const,
        price: '399.99',
        stock: 0,
        availableAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    ];

    for (const product of sampleProducts) {
      await sql`
        INSERT INTO products (image_url, name, status, price, stock, available_at)
        VALUES (${product.imageUrl}, ${product.name}, ${product.status}, ${product.price}, ${product.stock}, ${product.availableAt})
        ON CONFLICT DO NOTHING
      `;
    }
    console.log('✓ Added sample products');
  } catch (error) {
    console.error('Error inserting sample data:', error);
  }

  console.log('Database setup complete!');
}

setupDatabase().catch(console.error);