/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from "react";
import { salvarEntregasNoFirebase, carregarEntregasDoFirebase } from "./deliveryModel";

export function useDeliveriesViewModel(userId: string) {
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [deliveriesLoaded, setDeliveriesLoaded] = useState(false);

  useEffect(() => {
    async function loadDeliveries() {
      const entregasSalvas = await carregarEntregasDoFirebase(userId);
      if (entregasSalvas) setDeliveries(entregasSalvas);
      setDeliveriesLoaded(true);
    }
    if (userId) {
      loadDeliveries();
    }
  }, [userId]);

  useEffect(() => {
    if (userId && deliveriesLoaded) {
      salvarEntregasNoFirebase(userId, deliveries);
    }
  }, [deliveries, userId, deliveriesLoaded]);

  return {
    deliveries,
    setDeliveries,
    deliveriesLoaded,
  };
}