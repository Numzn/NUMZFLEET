import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, limit, where, onSnapshot, QueryConstraint, DocumentData } from 'firebase/firestore';
import { db, withFirestoreRetry, isFirestoreAvailable } from '@/lib/firebase';
import { trackEvent, AnalyticsEvents, AnalyticsHelpers } from '@/lib/analytics';

type QueryOptions<T> = {
  orderByField?: keyof T;
  limit?: number;
  where?: [keyof T | string, any, any][];
};

export function useCollection<T extends { id?: string; name?: string }>(
  collectionName: string,
  options: QueryOptions<T> = {}
) {
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    setError(null);

    // Check if Firestore is available before setting up listener
    if (!isFirestoreAvailable()) {
      const connectionError = new Error("Firestore is not available. Please check your internet connection and try again.");
      setError(connectionError);
      setIsLoading(false);
      setIsConnected(false);
      return;
    }

    const queryConstraints: QueryConstraint[] = [];
    
    if (options.orderByField) {
      queryConstraints.push(orderBy(options.orderByField as string));
    }
    
    if (options.limit) {
      queryConstraints.push(limit(options.limit));
    }

    if (options.where) {
      options.where.forEach(([field, operator, value]) => {
        queryConstraints.push(where(field as string, operator, value));
      });
    }

    const q = query(collection(db, collectionName), ...queryConstraints);

    // Set up real-time listener with better error handling
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const documents = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data()
        })) as T[];
        
        setData(documents);
        setError(null);
        setIsLoading(false);
        setIsConnected(true);
      },
      (err) => {
        console.warn(`Firestore listener error for ${collectionName}:`, err);
        
        // Handle different types of errors
        let errorMessage = 'Failed to load data';
        
        if (err.code === 'permission-denied') {
          errorMessage = 'Access denied. Please check your permissions.';
        } else if (err.code === 'unavailable') {
          errorMessage = 'Service temporarily unavailable. Please try again.';
        } else if (err.code === 'unauthenticated') {
          errorMessage = 'Authentication required. Please sign in again.';
        } else if (err.message && err.message.includes('shutting down')) {
          errorMessage = 'Connection lost. Please refresh the page.';
        } else {
          errorMessage = `Failed to load ${collectionName}: ${err.message}`;
        }
        
        setError(new Error(errorMessage));
        setIsLoading(false);
        setIsConnected(false);
        AnalyticsHelpers.trackError('Firestore Listener Error', err.message, { collection: collectionName });
      }
    );

    // Cleanup subscription
    return () => unsubscribe();
  }, [collectionName, JSON.stringify(options)]);

  const addItem = async (item: Omit<T, 'id'>): Promise<T> => {
    if (!isFirestoreAvailable()) {
      throw new Error('Firestore is not available. Please check your connection.');
    }

    try {
      const docRef = await withFirestoreRetry(async () => {
        return await addDoc(collection(db, collectionName), item);
      }, 3, 1000);
      
      const newItem = { id: docRef.id, ...item } as T;
      
      // Track the event based on collection type
      if (collectionName === 'vehicles' && 'name' in item) {
        AnalyticsHelpers.trackVehicleAction(AnalyticsEvents.VEHICLE_ADDED, docRef.id, item.name as string);
      } else if (collectionName === 'drivers' && 'name' in item) {
        AnalyticsHelpers.trackDriverAction(AnalyticsEvents.DRIVER_ADDED, docRef.id, item.name as string);
      } else if (collectionName === 'fuelRecords' && 'vehicleId' in item) {
        AnalyticsHelpers.trackFuelRecordAction(AnalyticsEvents.FUEL_RECORD_ADDED, docRef.id, (item as any).vehicleId);
      }

      return newItem;
    } catch (err) {
      const error = err as Error;
      console.error(`Failed to add item to ${collectionName}:`, error);
      
      // Provide more specific error messages
      let userMessage = 'Failed to create item';
      if (error.message.includes('permission-denied')) {
        userMessage = 'Access denied. Please check your permissions.';
      } else if (error.message.includes('unavailable')) {
        userMessage = 'Service temporarily unavailable. Please try again.';
      } else if (error.message.includes('unauthenticated')) {
        userMessage = 'Authentication required. Please sign in again.';
      }
      
      const userError = new Error(userMessage);
      setError(userError);
      AnalyticsHelpers.trackError('Firestore Add Error', error.message, { collection: collectionName });
      throw userError;
    }
  };

  const updateItem = async (id: string, updates: Partial<T>) => {
    if (!isFirestoreAvailable()) {
      throw new Error('Firestore is not available. Please check your connection.');
    }

    try {
      await withFirestoreRetry(async () => {
        const docRef = doc(db, collectionName, id);
        await updateDoc(docRef, updates as DocumentData);
      }, 3, 1000);
      
      // Track the event based on collection type
      if (collectionName === 'vehicles' && 'name' in updates) {
        AnalyticsHelpers.trackVehicleAction(AnalyticsEvents.VEHICLE_EDITED, id, updates.name as string);
      } else if (collectionName === 'drivers' && 'name' in updates) {
        AnalyticsHelpers.trackDriverAction(AnalyticsEvents.DRIVER_EDITED, id, updates.name as string);
      }
    } catch (err) {
      const error = err as Error;
      console.error(`Failed to update item in ${collectionName}:`, error);
      
      let userMessage = 'Failed to update item';
      if (error.message.includes('permission-denied')) {
        userMessage = 'Access denied. Please check your permissions.';
      } else if (error.message.includes('not-found')) {
        userMessage = 'Item not found. It may have been deleted.';
      }
      
      const userError = new Error(userMessage);
      setError(userError);
      AnalyticsHelpers.trackError('Firestore Update Error', error.message, { collection: collectionName });
      throw userError;
    }
  };

  const deleteItem = async (id: string) => {
    if (!isFirestoreAvailable()) {
      throw new Error('Firestore is not available. Please check your connection.');
    }

    try {
      const itemToDelete = data.find(item => item.id === id);
      await withFirestoreRetry(async () => {
        await deleteDoc(doc(db, collectionName, id));
      }, 3, 1000);
      
      // Track the event based on collection type
      if (collectionName === 'vehicles' && itemToDelete && 'name' in itemToDelete) {
        AnalyticsHelpers.trackVehicleAction(AnalyticsEvents.VEHICLE_DELETED, id, itemToDelete.name as string);
      } else if (collectionName === 'drivers' && itemToDelete && 'name' in itemToDelete) {
        AnalyticsHelpers.trackDriverAction(AnalyticsEvents.DRIVER_DELETED, id, itemToDelete.name as string);
      } else if (collectionName === 'fuelRecords' && itemToDelete) {
        AnalyticsHelpers.trackFuelRecordAction(AnalyticsEvents.FUEL_RECORD_DELETED, id, (itemToDelete as any).vehicleId);
      }
    } catch (err) {
      const error = err as Error;
      console.error(`Failed to delete item from ${collectionName}:`, error);
      
      let userMessage = 'Failed to delete item';
      if (error.message.includes('permission-denied')) {
        userMessage = 'Access denied. Please check your permissions.';
      } else if (error.message.includes('not-found')) {
        userMessage = 'Item not found. It may have already been deleted.';
      }
      
      const userError = new Error(userMessage);
      setError(userError);
      AnalyticsHelpers.trackError('Firestore Delete Error', error.message, { collection: collectionName });
      throw userError;
    }
  };

  return {
    data,
    isLoading,
    error,
    isConnected,
    addItem,
    updateItem,
    deleteItem
  };
}
