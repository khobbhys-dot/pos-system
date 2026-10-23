import Dexie, { Table } from 'dexie';

export interface Product { 
  id: string; 
  name: string; 
  price: number; 
  stock: number; 
}

export interface Sale { 
  id?: number; 
  total: number; 
  items: any; 
  created_at: string; 
  synced: boolean;
}

export class POSDatabase extends Dexie {
  products!: Table<Product>;
  sales!: Table<Sale>;
  
  constructor() {
    super('POSDatabase');
    this.version(1).stores({
      products: 'id',
      sales: '++id'
    });
  }
}

export const db = new POSDatabase();