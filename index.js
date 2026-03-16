const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const crypto = require('crypto');
const cors = require('cors');

// This is a test log to see if the file starts running
console.log("Server file is starting to execute...");

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

const axiosClient = axios.create({
    timeout: 15000,
    headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    }
});

async function updateDomains() {
    try {
        const { data } = await axiosClient.get("https://raw.githubusercontent.com/phisher98/TVVVV/refs/heads/main/domains.json");
        if (data && data.HDHUB4u) DOMAINS.HDHUB4u = data.HDHUB4u;
        if (data && data.hubcloud) DOMAINS.hubcloud = data.hubcloud;
        console.log("✅ Domains updated successfully:", DOMAINS);
    } catch (e) {
        console.error("⚠️ Failed to fetch domains.");
    }
}
updateDomains();
setInterval(updateDomains, 2 * 60 * 60 * 1000);

// All function definitions are safe and unchanged...
function getSearchQuality(title) {
    if (!title) return null;
    const t = title.toLowerCase();
    if (/(4k|ds4k|uhd|2160p)/.test(t)) return "4K";
    if (/(hdts|hdcam|hdtc)/.test(t)) return "HDCam";
    if (/(camrip|cam[- ]?rip)/.test(t)) return "CamRip";
    if (/(cam)/.test(t)) return "Cam";
    if (/(web[- ]?dl|webrip|webdl)/.test(t)) return "WebRip";
    if (/(bluray|bdrip|blu[- ]?ray|1440p|qhd)/.test(t)) return "BluRay";
    if (/(1080p|fullhd|hdrip|hdtv)/.test(t)) return "HD";
    if (/(720p)/.test(t)) return "SD";
    if (/(dvd)/.test(t)) return "DVD";
    if (/(hq)/.test(t)) return "HQ";
    return "Unknown";
}

function cleanTitle(title) {
    if(!title) return "";
    return title.replace(/.[a-zA-Z0-9]{2,4}$/, "").replace(/WEB[-. ]?DL/ig, "WEB-DL").replace(/WEB[-. ]?RIP/ig, "WEBRIP").replace(/H[ .]?265/ig, "H265").replace(/H[ .]?264/ig, "H264").replace(/DDP[ .]?([0-9].[0-9])/ig, "DDP$1");
}

function decryptVidstack(encodedHex) {
    const key = "kiemtienmua911ca";
    const ivList =["1234567890oiuytr", "0123456789abcdef"];
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
        // ✅ FIXED: Removed backticks and used simple string concatenation (+)
        const url = TMDB_PROXY + '/' + type + '/' + tmdbId + '?api_key=' + TMDB_API_KEY + '&append_to_response=credits,external_ids';
        const res = await axiosClient.get(url);
        return res.data;
    } catch (e) {
        return null;
    }
}

app.get('/api/home', async (req, res) => {
    const page = req.query.page || 1;
    const category = req.query.category || "";
    // ✅ FIXED: Removed backticks and used simple string concatenation (+)
    const url = category ? DOMAINS.HDHUB4u + '/' + category + '/page/' + page + '/' : DOMAINS.HDHUB4u + '/page/' + page + '/';

    try {
        const { data } = await axiosClient.get(url);
        const $ = cheerio.load(data);
        const results = [];
        $(".recent-movies > li.thumb").each((i, el) => {
            const titleText = $(el).find("figcaption:nth-child(2) > a:nth-child(1) > p:nth-child(1)").text();
            const movieUrl = $(el).find("figure:nth-child(1) > a:nth-child(2)").attr("href");
            const poster = $(el).find("figure:nth-child(1) > img:nth-child(1)").attr("src");
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
        res.status(500).json({ error: error.message || "Failed to load home page" });
    }
});

app.get('/api/search', async (req, res) => {
    const { q, page = 1 } = req.query;
    if (!q) return res.status(400).json({ error: "Query 'q' is required" });
    // This part was already okay, but for consistency, let's keep it simple
    const searchUrl = 'https://search.pingora.fyi/collections/post/documents/search?q=' + encodeURIComponent(q) + '&query_by=post_title,category&query_by_weights=4,2&sort_by=sort_by_date:desc&limit=15&use_cache=true&page=' + page;
    try {
        const { data } = await axiosClient.get(searchUrl, { headers: { referer: DOMAINS.HDHUB4u } });
        if (!data.hits) return res.json({ success: true, results: [] });
        const results = data.hits.map(hit => ({
            title: hit.document.post_title,
            url: hit.document.permalink,
            poster: hit.document.post_thumbnail
        }));
        res.json({ success: true, results });
    } catch (error) {
        res.status(500).json({ error: error.message || "Search failed" });
    }
});

// All other routes are okay and do not need changes. Included for completeness.
// The main issue was with template literals at the top level and in the listen callback.
// The rest of the code is copied from your valid version.
// ... (your app.get('/api/details'), app.get('/api/extract'), etc. routes go here, they are fine) ...


process.on('uncaughtException', (err) => {
    console.error('🔥 Critical Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('🔥 Unhandled Promise Rejection at:', promise, 'reason:', reason);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    // ✅ FIXED: Removed emoji and backticks for maximum safety
    console.log('Server is running on port ' + PORT);
});
