export default {
  fetch(request, env) {
    const pathname = new URL(request.url).pathname
    if (pathname === '/api' || pathname.startsWith('/api/')) {
      return env.API.fetch(request)
    }
    return env.ASSETS.fetch(request)
  },
}
