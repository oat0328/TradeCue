import { z } from "zod";
import { readApiResponse } from "../../helpers/apiClient";

export const schema=z.object({accountId:z.string().min(1).max(100)});
export type OutputType={
  orders:Array<{
    clientOrderId:string;
    orderId:string|null;
    symbol:string;
    side:string;
    orderType:string;
    quantity:string|null;
    filledQuantity:string|null;
    limitPrice:string|null;
    status:string;
    createdAt:string|null;
  }>;
};

export async function getPaperOrders(accountId:string):Promise<OutputType>{
  const r=await fetch("/_api/webull/orders?"+new URLSearchParams({accountId}),{credentials:"include"});
  return readApiResponse<OutputType>(r,"Unable to load paper orders");
}

