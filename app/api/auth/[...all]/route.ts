import { toNextJsHandler } from "better-auth/next-js";
import { serverDeps } from "@/infra/server";

const handler = () => toNextJsHandler(serverDeps().betterAuth);

export const GET = (req: Request) => handler().GET(req);
export const POST = (req: Request) => handler().POST(req);
