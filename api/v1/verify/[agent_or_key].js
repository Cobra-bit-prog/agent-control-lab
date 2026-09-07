import { runPolicy } from "../../_lib/policy-http.js";

export default function handler(req, res) {
  const id = req.query.agent_or_key || "";
  runPolicy(req, res, `/api/v1/verify/${id}`);
}
