-- Consultar el último JSON enviado al sistema contable
SELECT 
  order_id,
  payload::text as payload_json,
  response_status,
  response_body,
  success,
  created_at,
  accounting_url
FROM accounting_webhook_logs 
ORDER BY created_at DESC 
LIMIT 1;
