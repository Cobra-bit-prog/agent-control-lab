import { runPolicy } from "../_lib/policy-http.js";

export default function handler(req, res) {
  runPolicy(req, res, "/api/v1/jobs");
}
