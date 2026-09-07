import { runPolicy } from "../../_lib/policy-http.js";

export default function handler(req, res) {
  const id = req.query.id || "";
  runPolicy(req, res, `/api/v1/approvals/${id}`);
}
