// Thin wrapper around Giphy's REST API (works fine with an SDK-tier key —
// the "SDK vs API" distinction only affects which official client
// libraries/UI kits you're allowed to use, not the underlying HTTP
// endpoints, which is what we call directly here to avoid pulling in an
// extra dependency).
//
// Reads the key from REACT_APP_GIPHY_API_KEY (Create React App). If your
// project uses Vite instead, change the line below to:
//   const GIPHY_API_KEY = import.meta.env.VITE_GIPHY_API_KEY || "";
// and rename the .env variable to VITE_GIPHY_API_KEY.
const GIPHY_API_KEY = process.env.REACT_APP_GIPHY_API_KEY || "";

const BASE_URL = "https://api.giphy.com/v1";

async function giphyRequest(path, params = {}) {
  if (!GIPHY_API_KEY) {
    throw new Error(
      "Missing Giphy API key. Add REACT_APP_GIPHY_API_KEY to your .env file and restart the dev server.",
    );
  }

  const query = new URLSearchParams({
    api_key: GIPHY_API_KEY,
    limit: "24",
    rating: "pg-13",
    ...params,
  });

  const res = await fetch(`${BASE_URL}${path}?${query.toString()}`);
  if (!res.ok) {
    throw new Error(`Giphy request failed (${res.status})`);
  }
  const json = await res.json();

  return (json.data || []).map((item) => ({
    id: item.id,
    title: item.title || "",
    previewUrl:
      item.images?.fixed_width_small?.url ||
      item.images?.fixed_width?.url ||
      item.images?.original?.url,
    sendUrl:
      item.images?.fixed_width?.url ||
      item.images?.downsized?.url ||
      item.images?.original?.url,
  }));
}

export const searchGifs = (query) => giphyRequest("/gifs/search", { q: query });
export const trendingGifs = () => giphyRequest("/gifs/trending");

export const searchStickers = (query) =>
  giphyRequest("/stickers/search", { q: query });
export const trendingStickers = () => giphyRequest("/stickers/trending");