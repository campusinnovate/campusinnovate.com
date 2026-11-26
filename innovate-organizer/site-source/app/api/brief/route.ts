import { env } from 'cloudflare:workers';
import { handleBrief } from '../../../worker/leads.mjs';
export function POST(request: Request) { return handleBrief(request, env); }
export function GET(request: Request) { return handleBrief(request, env); }
