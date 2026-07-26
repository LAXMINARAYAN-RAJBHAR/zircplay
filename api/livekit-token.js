const { AccessToken } = require("livekit-server-sdk");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { room, identity, canPublish } = req.query;

  if (!room || !identity) {
    return res.status(400).json({ error: "room and identity are required" });
  }

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const livekitUrl = process.env.LIVEKIT_URL;

  if (!apiKey || !apiSecret || !livekitUrl) {
    return res.status(500).json({ error: "LiveKit env vars not configured" });
  }

  try {
    const at = new AccessToken(apiKey, apiSecret, { identity });
    at.addGrant({
      room,
      roomJoin: true,
      canPublish: canPublish === "true",
      canSubscribe: true,
    });

    const token = await at.toJwt();
    res.status(200).json({ token, url: livekitUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};