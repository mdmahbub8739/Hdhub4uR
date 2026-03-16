const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const crypto = require('crypto');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

let DOMAINS = {
    HDHUB4u: "https://hdstream4u.com",
    hubcloud: "https://hubcloud.foo"
};

const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";
const TMDB_BASE_IMG = "https://image.tmdb.org/t/p/original";
const TMDB_PROXY = "https://wild-surf-4a0d.phisher1.workers.dev";

// 🛡️ Browser-Like Axios Instance with Timeouts
const axiosClient = axios.create({
    timeout: 15000,
    headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "Accept-Language": "en-US,en;q=0.9"
    }
});

async function updateDomains() {
    try {
        const { data } = await axiosClient.get("https://raw.githubusercontent.com/phisher98/TVVVV/refs/heads/main/domains.json");
        if (data && data.HDHUB4u) DOMAINS.HDHUB4u = data.HDHUB4u;
        if (data && data.hubcloud) DOMAINS.hubcloud = data.hubcloud;
        console.log("✅ Domains updated successfully:", DOMAINS);
    } catch (e) {
        console.error("⚠️ Failed to fetch domains, using default domains.");
    }
}
updateDomains();
setInterval(updateDomains, 2 * 60 * 60 * 1000);

function getSearchQuality(title) {
    if (!title) return "Unknown";
    const t = title.toLowerCase();
    if (/(4k|ds4k|uhd|2160p)/.test(t)) return "4K";
    if (/(web[- ]?dl|webrip|webdl)/.test(t)) return "WebRip";
    if (/(bluray|bdrip|blu[- ]?ray)/.test(t)) return "BluRay";
    if (/(1080p|fullhd|hdrip|hdtv)/.test(t)) return "HD";
    if (/(720p)/.test(t)) return "SD";
    if (/(hdts|hdcam|hdtc)/.test(t)) return "HDCam";
    return "Unknown";
}

function cleanTitle(title) {
    if (!title) return "";
    return title.replace(/\.[a-zA-Z0-9]{2,4}$/, "")
        .replace(/WEB[-. ]?DL/ig, "WEB-DL")
        .replace(/WEB[-. ]?RIP/ig, "WEBRIP");
}

function decryptVidstack(encodedHex) {
    const key = "kiemtienmua911ca";
    const ivList = ["1234567890oiuytr", "0123456789abcdef"];
    for (const iv of ivList) {
        try {
            const decipher = crypto.createDecipheriv('aes-128-cbc', Buffer.from(key), Buffer.from(iv));
            return decipher.update(encodedHex, 'hex', 'utf8') + decipher.final('utf8');
        } catch (e) { continue; }
    }
    throw new Error("Failed to decrypt Vidstack");
}

async function fetchTmdbDetails(tmdbId, isTv) {
    try {
        const type = isTv ? "tv" : "movie";
        // ✅ FIXED: Added backticks (`) for template literal
        const url = `${TMDB_PROXY}/${type}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=credits,external_ids`;
        const { data } = await axiosClient.get(url);
        return data;
    } catch (e) {
        return null;
    }
}

// ✨ ADDED: Health check route for Render and UptimeRobot
app.get('/', (req, res) => {
    res.json({ status: "ok", message: "API is running!" });
});

app.get('/api/home', async (req, res) => {
    const page = req.query.page || 1;
    const category = req.query.category || "";
    // ✅ FIXED: Added backticks (`) for template literal
    const url = category ? `${DOMAINS.HDHUB4u}/${category}/page/${page}/` : `${DOMAINS.HDHUB4u}/page/${page}/`;

    try {
        const { data } = await axiosClient.get(url);
        const $ = cheerio.load(data);
        const results = [];
        $(".recent-movies > li.thumb").each((i, el) => {
            const titleText = $(el).find("figcaption > a > p").text();
            const movieUrl = $(el).find("figure > a").attr("href");
            const poster = $(el).find("figure > img").attr("src");
            if (titleText && movieUrl) {
                results.push({
                    title: cleanTitle(titleText),
                    url: movieUrl,
                    poster,
                    quality: getSearchQuality(titleText)
                });
            }
        });
        res.json({ success: true, results });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/search', async (req, res) => {
    const { q, page = 1 } = req.query;
    if (!q) return res.status(400).json({ error: "Query 'q' is required" });
    const searchUrl = `https://search.pingora.fyi/collections/post/documents/search?q=${encodeURIComponent(q)}&query_by=post_title,category&sort_by=sort_by_date:desc&limit=15&page=${page}`;
    try {
        const { data } = await axiosClient.get(searchUrl, { headers: { referer: DOMAINS.HDHUB4u } });
        const results = data.hits?.map(hit => ({
            title: hit.document.post_title,
            url: hit.document.permalink,
            poster: hit.document.post_thumbnail
        })) || [];
        res.json({ success: true, results });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Other routes (details, extract, buzz-redirect) remain the same as your correct implementation...
// All routes from your previous code are correct, only the template literals were the issue.
// I've included the full, correct code for all routes below for completeness.

app.get('/api/details', async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: "URL is required" });
    try {
        const { data } = await axiosClient.get(url);
        const $ = cheerio.load(data);
        const titleRaw = $(".page-body h2[data-ved]").first().text() || $("h1.page-title").text();
        const seasonMatch = titleRaw.match(/Season\s*(\d+)/i);
        const seasonNumber = seasonMatch ? parseInt(seasonMatch) : null;
        const image = $("meta[property=og:image]").attr("content");
        const plot = $(".kno-rdesc .kno-rdesc").first().text() || $("div.page-body p").first().text();
        const poster = $("main.page-body img.aligncenter").attr("src");
        const trailer = $(".responsive-embed-container > iframe").attr("src")?.replace("/embed/", "/watch?v=");
        const isMovie = ($("h1.page-title span").text() || "").toLowerCase().includes("movie");
        let tmdbId = "";
        const tmdbHref = $("div span a[href*='themoviedb.org']").attr("href");
        if (tmdbHref) {
            tmdbId = tmdbHref.split("/").pop().split("-");
        }
        let meta = { title: cleanTitle(titleRaw), plot, poster, background: image, isMovie, trailer };
        if (tmdbId) {
            const tmdbData = await fetchTmdbDetails(tmdbId, !isMovie);
            if (tmdbData) {
                meta.title = tmdbData.name || tmdbData.title || meta.title;
                if (seasonNumber) meta.title += ` (Season ${seasonNumber})`;
                meta.plot = tmdbData.overview || plot;
                meta.year = (tmdbData.release_date || tmdbData.first_air_date || "").substring(0, 4);
                meta.background = tmdbData.backdrop_path ? TMDB_BASE_IMG + tmdbData.backdrop_path : image;
                meta.rating = tmdbData.vote_average;
                meta.genres = tmdbData.genres?.map(g => g.name);
                if (tmdbData.external_ids?.imdb_id) meta.imdbId = tmdbData.external_ids.imdb_id;
            }
        }
        if (isMovie) {
            let links = [];
            $("h3 a, h4 a, .page-body > div a").each((i, el) => {
                const href = $(el).attr("href");
                if (href && /(hubstream|hubdrive|hubcloud|hubcdn|vidstack)/i.test(href)) {
                    links.push({ name: $(el).text().trim() || "Download", url: href });
                }
            });
            meta.links = [...new Map(links.map(item => [item['url'], item])).values()];
        } else {
            let episodes = [];
            $("h3, h4").each((i, el) => {
                const epMatch = $(el).text().match(/EPiSODE\s*(\d+)/i);
                if (epMatch) {
                    let epLinks = [];
                    let nextEl = $(el).nextUntil('hr, h3, h4');
                    nextEl.find("a").each((j, aEl) => {
                        const href = $(aEl).attr("href");
                        if (href && /(hubstream|hubdrive|hubcloud|hubcdn|vidstack)/i.test(href)) epLinks.push(href);
                    });
                    if (epLinks.length > 0) episodes.push({ episode: parseInt(epMatch), links: [...new Set(epLinks)] });
                }
            });
            meta.episodes = episodes;
        }
        res.json({ success: true, data: meta });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/extract', async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: "URL is required" });
    try {
        const lowerUrl = url.toLowerCase();
        if (lowerUrl.includes("vidstack") || lowerUrl.includes("hubstream")) {
            const hash = url.split('/').pop();
            const { data } = await axiosClient.get(`${new URL(url).origin}/api/v1/video?id=${hash}`);
            const decrypted = decryptVidstack(data.trim());
            const match = decrypted.match(/"source":"(.*?)"/);
            if (!match) throw new Error("Could not extract stream source");
            const m3u8 = match.replace(/\\\//g, '/');
            return res.json({ stream: m3u8, type: "m3u8", host: "Vidstack" });
        }
        if (lowerUrl.includes("hubcdn")) {
            const { data } = await axiosClient.get(url);
            const match = data.match(/reurl\s*=\s*"([^"]+)"/);
            if (!match) throw new Error("Could not find encoded URL");
            const decoded = Buffer.from(match, 'base64').toString('utf8');
            return res.json({ stream: decoded.split("link=").pop(), type: "m3u8", host: "HUBCDN" });
        }
        if (lowerUrl.includes("hubdrive")) {
            const { data } = await axiosClient.get(url);
            const href = cheerio.load(data)(".btn.btn-primary").attr("href");
            if (href && href.includes("hubcloud")) return res.json({ redirect: href });
            return res.status(404).json({ error: "Could not resolve to Hubcloud" });
        }
        if (lowerUrl.includes("hubcloud")) {
            const { data } = await axiosClient.get(url);
            let $ = cheerio.load(data);
            const downloadHref = $("#download").attr("href");
            if (downloadHref) {
                const downloadPage = await axiosClient.get(new URL(downloadHref, url).href);
                $ = cheerio.load(downloadPage.data);
            }
            let streams = [];
            $("a.btn").each((i, el) => {
                const link = $(el).attr("href");
                const text = $(el).text().trim();
                if (link) streams.push({ name: text || "Download", url: link });
            });
            return res.json({ streams, host: "HubCloud" });
        }
        res.status(404).json({ error: "No matching extractor found" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/buzz-redirect', async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: "URL is required" });
    try {
        const resp = await axiosClient.get(url, {
            headers: { referer: url.replace('/download', '') },
            maxRedirects: 0,
            validateStatus: null
        });
        const dlink = resp.headers["hx-redirect"];
        if (dlink) return res.json({ redirect: dlink });
        res.status(404).json({ error: "No redirect found" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

process.on('uncaughtException', (err) => console.error('🔥 Uncaught Exception:', err));
process.on('unhandledRejection', (reason) => console.error('🔥 Unhandled Rejection:', reason));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    // ✅ FIXED: Added backticks (`) for template literal
    console.log(` Server is running on port ${PORT}`);
});
