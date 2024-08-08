export default {
	async fetch(request) {
		const corsHeaders = {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET,HEAD,POST,OPTIONS',
			'Access-Control-Max-Age': '86400',
		};

		// The URL for the remote third party API you want to fetch from
		// but does not implement CORS
		const API_URL = 'https://www.youtube.com/@EricTendian/live';

		// The endpoint you want the CORS reverse proxy to be on
		const PROXY_ENDPOINT = '/youtubelive/';

		async function handleRequest(originalRequest) {
			// Rewrite request to point to API URL. This also makes the request mutable
			// so you can add the correct Origin header to make the API server think
			// that this request is not cross-site.
			request = new Request(API_URL, originalRequest);
			request.headers.set('Origin', new URL(API_URL).origin);
			let response = await fetch(request, {
				cf: {
					cacheTtl: 3600,
					cacheEverything: true,
				},
			});
			// Recreate the response so you can modify the headers

			response = new Response(response.body, response);
			// Set CORS headers

			response.headers.set('Access-Control-Allow-Origin', originalRequest.headers.get('Origin'));

			// Append to/Add Vary header so browser will cache response correctly
			response.headers.append('Vary', 'Origin');

			return response;
		}

		async function handleOptions(request) {
			if (
				request.headers.get('Origin') !== null &&
				request.headers.get('Access-Control-Request-Method') !== null &&
				request.headers.get('Access-Control-Request-Headers') !== null
			) {
				// Handle CORS preflight requests.
				return new Response(null, {
					headers: {
						...corsHeaders,
						'Access-Control-Allow-Headers': request.headers.get('Access-Control-Request-Headers'),
					},
				});
			} else {
				// Handle standard OPTIONS request.
				return new Response(null, {
					headers: {
						Allow: 'GET, HEAD, POST, OPTIONS',
					},
				});
			}
		}

		const url = new URL(request.url);
		if (url.pathname.startsWith(PROXY_ENDPOINT)) {
			if (request.method === 'OPTIONS') {
				// Handle CORS preflight requests
				return handleOptions(request);
			} else if (request.method === 'GET' || request.method === 'HEAD' || request.method === 'POST') {
				// Handle requests to the API server
				return handleRequest(request);
			} else {
				return new Response(null, {
					status: 405,
					statusText: 'Method Not Allowed',
				});
			}
		} else {
			return new Response(null, {
				status: 404,
				statusText: 'Page Not Found',
			});
		}
	},
};
