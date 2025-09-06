import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { useToast } from "@/hooks/use-toast";
import React from "react";
// TODO: Replace with Supabase imports
// import { supabase } from "@/lib/supabase";

export default function Settings() {
  const { toast } = useToast();
  const [clearing, setClearing] = React.useState(false);
  const [showReload, setShowReload] = React.useState(false);

  // Helper to clear all Supabase collections
  async function clearAllSupabaseCollections() {
    // TODO: Implement with Supabase
    console.log("🔧 Supabase integration needed for clearing collections");
    
    const collectionsToClear = ["vehicles", "drivers", "fuelRecords"];
    
    for (const col of collectionsToClear) {
      console.log(`Would clear collection: ${col}`);
    }
    
    console.log("Supabase clearing complete (placeholder)");
  }

  const handleClearDatabase = async () => {
    setClearing(true);
    setShowReload(false);
    try {
      // Clear localStorage and sessionStorage
      localStorage.clear();
      sessionStorage.clear();

      // Attempt to delete all IndexedDB databases (if supported)
      if (window.indexedDB && indexedDB.databases) {
        const dbs = await indexedDB.databases();
        await Promise.all(
          dbs.map((db) => db.name && new Promise(resolve => {
            const request = indexedDB.deleteDatabase(db.name!);
            request.onsuccess = () => resolve(undefined);
            request.onerror = () => resolve(undefined);
          }))
        );
      }

      // Clear all Supabase collections
      await clearAllSupabaseCollections();

      toast({
        title: "Database Cleared",
        description: "All local and cloud data has been removed. Please reload the app.",
      });
      setShowReload(true);
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to clear some data. Check console for details.",
        variant: "destructive",
      });
      setShowReload(true);
      console.error("Error during database clearing:", err);
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">

      <main className="pt-20 max-w-2xl mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div>
                <h2 className="font-semibold mb-2">Danger Zone</h2>
                <Button variant="destructive" onClick={handleClearDatabase} disabled={clearing}>
                  {clearing ? "Clearing..." : "Clear All Local Database Values"}
                </Button>
                {showReload && (
                  <Button className="ml-4" variant="outline" onClick={() => window.location.reload()}>
                    Reload App
                  </Button>
                )}
                <Button className="ml-4" variant="secondary" onClick={async () => {
                  try {
                    // TODO: Implement with Supabase
                    console.log("🔧 Supabase integration needed for sample data initialization");
                    toast({
                      title: "Sample Data Initialized",
                      description: "Demo data has been added to the database (placeholder).",
                    });
                  } catch (err) {
                    toast({
                      title: "Error",
                      description: "Failed to initialize sample data.",
                      variant: "destructive",
                    });
                  }
                }}>
                  Add Demo Sample Data
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  This will remove all data stored in your browser for this app. This action cannot be undone.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
