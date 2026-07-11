import { Redis } from "@upstash/redis";

// The Vercel Marketplace "Upstash" integration injects env vars.
// Depending on how you name the integration these usually land as either:
//   KV_REST_API_URL / KV_REST_API_TOKEN
// or
//   UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
// Check your Vercel project's Environment Variables tab after installing
// the integration and adjust the two lines below if the names differ.
const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL!;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN!;

export const redis = new Redis({ url, token });

export const BETS_KEY = "golf-bet-board:bets";
export const MAPPING_KEY = "golf-bet-board:mapping";
export const SYNC_LOCK_KEY = "golf-bet-board:last-sync-at";
