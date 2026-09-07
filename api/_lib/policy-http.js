import { handleRequest } from "../../lib/policy.js";

export function applyPolicyCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
}

export function runPolicy(req, res, urlPath) {
  applyPolicyCors(res);
  const result = handleRequest({
    method: req.method,
    url: urlPath,
    headers: req.headers,
    body: req.body,
  });
  if (result.status === 204) {
    res.status(204).end();
    return;
  }
  res.status(result.status).json(result.body);
}
