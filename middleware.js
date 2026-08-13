import { next, rewrite } from '@vercel/edge';

const BOT_UA_REGEX =
  /facebookexternalhit|Facebot|WhatsApp|Twitterbot|Slackbot|LinkedInBot|TelegramBot|Discordbot|Pinterest|SkypeUriPreview|Googlebot|bingbot|redditbot|Applebot|vkShare|Embedly|Iframely|W3C_Validator/i;

export const config = {
  matcher: ['/video/:path*', '/reels/:path*', '/feed'],
};

export default function middleware(request) {
  const ua = request.headers.get('user-agent') || '';

  // Not a known crawler/bot — let the request through to the normal SPA.
  if (!BOT_UA_REGEX.test(ua)) {
    return next();
  }

  const url = new URL(request.url);
  const { pathname, searchParams } = url;

  let type, id;

  if (pathname.startsWith('/video/')) {
    type = 'video';
    id = pathname.split('/')[2];
  } else if (pathname.startsWith('/reels/')) {
    type = 'reel';
    id = pathname.split('/')[2]?.replace(/^db_/, '');
  } else if (pathname === '/feed' && searchParams.has('post')) {
    type = 'post';
    id = searchParams.get('post');
  }

  // Couldn't determine type/id from this path — fall through to normal SPA.
  if (!type || !id) {
    return next();
  }

  const ogUrl = new URL('/api/og', url.origin);
  ogUrl.searchParams.set('type', type);
  ogUrl.searchParams.set('id', id);

  return rewrite(ogUrl);
}