import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type PurchasedItem = {
  id: number;
  name: string;
  price?: number;
};

export default function Purchases() {
  const [items, setItems] = React.useState<PurchasedItem[]>([]);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem("spg_purchases");
      const parsed = raw ? JSON.parse(raw) : [];
      setItems(Array.isArray(parsed) ? parsed : []);
    } catch {
      setItems([]);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>My Purchases</CardTitle>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <div className="text-sm text-muted-foreground">No purchases yet.</div>
            ) : (
              <div className="space-y-2">
                {items.map((it) => (
                  <div key={it.id} className="flex items-center justify-between border rounded-md p-3">
                    <div>
                      <div className="font-medium">{it.name}</div>
                      <div className="text-xs text-green-600">Unlocked</div>
                    </div>
                    <Button size="sm" onClick={() => window.history.back()}>Open</Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


