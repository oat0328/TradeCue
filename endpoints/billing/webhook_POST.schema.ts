import {z}from "zod";export const schema=z.unknown();export type OutputType={received:boolean}; // Stripe calls this endpoint with its signed raw JSON body.
