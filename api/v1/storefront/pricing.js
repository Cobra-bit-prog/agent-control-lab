import { publicPricing } from "../../../js/pay-core.js";
import { CORS } from "../../_lib/http.js";

export default async function handler(req, res) {
  for (const [k, v] of Object.entries(CORS)) res.setHeader(k, v);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  res.status(200).json(publicPricing());
}
