// Flue generates Worker/DO exports; HTTP exposes no routes. Use private RPC.
export default {
  fetch() { return new Response('Not found', { status: 404 }) },
}
