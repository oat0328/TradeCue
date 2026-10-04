import Stripe from "stripe";
export function stripeClient() {
 const key=(process.env as Record<string,string|undefined>).STRIPE_SECRET_KEY;
 if(!key)throw new Error("Stripe billing is not connected.");
 return new Stripe(key,{maxNetworkRetries:2,timeout:15000});
}

