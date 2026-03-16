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

// 🛡️ Browser-Like Axios Instance with Timeouts to prevent Server Hangs/Crashes
const axiosClient = axios.create({
timeout: 15000, // 15 Seconds timeout
headers: {
"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
"Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,/;q=0.8,application/signed-exchange;v=b3;q=0.7",
"Accept-Language": "en-US,en;q=0.9",
"Accept-Encoding": "gzip, deflate, br",
"Connection": "keep-alive",
"Upgrade-Insecure-Requests": "1",
"Sec-Fetch-Dest": "document",
"Sec-Fetch-Mode": "navigate",
"Sec-Fetch-Site": "none",
"Sec-Fetch-User": "?1",
"Cache-Control": "max-age=0",
"Cookie": "xla=s4t"
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
// Start at boot and update every 2 hours to avoid cold start issues
updateDomains();
setInterval(updateDomains, 2 * 60 * 60 * 1000);

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
return title.replace(/.[a-zA-Z0-9]{2,4}$/, "")
.replace(/WEB[-. ]?DL/ig, "WEB-DL")
.replace(/WEB[-. ]?RIP/ig, "WEBRIP")
.replace(/H[ .]?265/ig, "H265")
.replace(/H[ .]?264/ig, "H264")
.replace(/DDP[ .]?([0-9].[0-9])/ig, "DDP$1");
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
const res = await axiosClient.get(${TMDB_PROXY}/${type}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=credits,external_ids);
return res.data;
} catch (e) {
return null; // Return null gracefully if TMDB fails
}
}

app.get('/api/home', async (req, res) => {
const page = req.query.page || 1;
const category = req.query.category || "";
const url = category ? ${DOMAINS.HDHUB4u}/${category}/page/${page}/ : ${DOMAINS.HDHUB4u}/page/${page}/;

try {  
    const { data } = await axiosClient.get(url);  
    const $ = cheerio.load(data);  
    const results =[];  

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

const searchUrl = `https://search.pingora.fyi/collections/post/documents/search?q=${encodeURIComponent(q)}&query_by=post_title,category&query_by_weights=4,2&sort_by=sort_by_date:desc&limit=15&use_cache=true&page=${page}`;  

try {  
    const { data } = await axiosClient.get(searchUrl, { headers: { referer: DOMAINS.HDHUB4u } });  
    if(!data.hits) return res.json({ success: true, results:[] });  

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

app.get('/api/details', async (req, res) => {
const { url } = req.query;
if (!url) return res.status(400).json({ error: "URL is required" });

try {  
    const { data } = await axiosClient.get(url);  
    const $ = cheerio.load(data);  

    const titleRaw = $(".page-body h2[data-ved], h2[data-ved]").first().text() || $("h1.page-title").text();  
    const seasonMatch = titleRaw.match(/Season\s*(\d+)/i);  
    const seasonNumber = seasonMatch ? parseInt(seasonMatch[1]) : null;  

    const image = $("meta[property=og:image]").attr("content");  
    const plot = $(".kno-rdesc .kno-rdesc").first().text() || $("div.page-body p").first().text();  
    const poster = $("main.page-body img.aligncenter").attr("src");  
    const trailer = $(".responsive-embed-container > iframe:nth-child(1)").attr("src")?.replace("/embed/", "/watch?v=");  
    const typeraw = $("h1.page-title span").text() || "";  
    const isMovie = typeraw.toLowerCase().includes("movie");  

    let tmdbId = "";  
    const tmdbHref = $("div span a[href*='themoviedb.org']").attr("href");  
    if (tmdbHref) {  
        const parts = tmdbHref.split("/");  
        const rawId = parts[parts.length - 1];  
        if(rawId) tmdbId = rawId.split("-")[0].split("?")[0];  
    }  

    let meta = { title: titleRaw, plot, poster, background: image, isMovie, trailer };  

    if (tmdbId) {  
        const tmdbData = await fetchTmdbDetails(tmdbId, !isMovie);  
        if (tmdbData) {  
            meta.title = tmdbData.name || tmdbData.title || titleRaw;  
            if (seasonNumber && !meta.title.toLowerCase().includes(`season ${seasonNumber}`)) {  
                meta.title += ` (Season ${seasonNumber})`;  
            }  
            meta.plot = tmdbData.overview || plot;  
            meta.year = (tmdbData.release_date || tmdbData.first_air_date || "").substring(0, 4);  
            meta.background = tmdbData.backdrop_path ? TMDB_BASE_IMG + tmdbData.backdrop_path : image;  
            meta.rating = tmdbData.vote_average;  
            meta.genres = tmdbData.genres?.map(g => g.name) ||[];  
            meta.actors = tmdbData.credits?.cast?.slice(0, 10).map(c => ({  
                name: c.name,  
                role: c.character,  
                image: c.profile_path ? TMDB_BASE_IMG + c.profile_path : null  
            })) ||[];  

            if (tmdbData.external_ids?.imdb_id) {  
                meta.imdbId = tmdbData.external_ids.imdb_id;  
                meta.logo = `https://live.metahub.space/logo/medium/${meta.imdbId}/img`;  
            }  
        }  
    }  

    let links =[];  
    if (isMovie) {  
        $("h3 a, h4 a, .page-body > div a").each((i, el) => {  
            const href = $(el).attr("href");  
            if (href && /(hdstream4u|hubstream|hubdrive|hubcloud|hubcdn|vidstack)/i.test(href)) {  
                links.push({ name: $(el).text().trim() || "Download", url: href });  
            }  
        });  
        // Removes exact duplicate objects  
        meta.links = links.filter((v, i, a) => a.findIndex(t => (t.url === v.url)) === i);  
    } else {  
        let episodes =[];  
        $("h3, h4").each((i, el) => {  
            const epText = $(el).text();  
            const epMatch = epText.match(/EPiSODE\s*(\d+)/i);  
            if (epMatch) {  
                const epNum = parseInt(epMatch[1]);  
                let epLinks =[];  
                let nextEl = $(el).next();  
                while (nextEl.length && nextEl[0].tagName !== 'hr' && !nextEl[0].tagName.match(/h3|h4/i)) {  
                    nextEl.find("a").each((j, aEl) => {  
                        const href = $(aEl).attr("href");  
                        if (href && /(hdstream4u|hubstream|hubdrive|hubcloud|hubcdn|vidstack)/i.test(href)) {  
                            epLinks.push(href);  
                        }  
                    });  
                    nextEl = nextEl.next();  
                }  
                if (epLinks.length > 0) {  
                    episodes.push({ episode: epNum, links: [...new Set(epLinks)] });  
                }  
            }  
        });  
        meta.episodes = episodes;  
    }  

    res.json({ success: true, data: meta });  
} catch (error) {  
    res.status(500).json({ error: error.message || "Failed to fetch details" });  
}

});

app.get('/api/extract', async (req, res) => {
const { url } = req.query;
if (!url) return res.status(400).json({ error: "URL is required" });

try {  
    const lowerUrl = url.toLowerCase();  

    if (lowerUrl.includes("vidstack.io") || lowerUrl.includes("hubstream")) {  
        const hash = url.split('#').pop().split('/').pop();  
        const baseUrl = new URL(url).origin;  
        const { data } = await axiosClient.get(`${baseUrl}/api/v1/video?id=${hash}`);  
          
        const decrypted = decryptVidstack(data.trim());  
        const match = decrypted.match(/"source":"(.*?)"/);  
          
        if (!match) throw new Error("Could not extract stream source from Vidstack");  
        const m3u8 = match[1].replace(/\\\//g, '/').replace(/^https:/, "http:");  
          
        return res.json({ stream: m3u8, type: "m3u8", host: "Vidstack" });  
    }  
    else if (lowerUrl.includes("hubcdn")) {  
        const { data } = await axiosClient.get(url);  
        const match = data.match(/reurl\s*=\s*"([^"]+)"/) || data.match(/r=([A-Za-z0-9+/=]+)/);  
          
        if (!match) throw new Error("Could not find encoded URL in HubCDN");  
          
        const decoded = Buffer.from(match[1].replace('?r=', ''), 'base64').toString('utf8');  
        return res.json({ stream: decoded.split("link=").pop(), type: "m3u8", host: "HUBCDN" });  
    }  
    else if (lowerUrl.includes("hubdrive")) {  
        const { data } = await axiosClient.get(url);  
        const $ = cheerio.load(data);  
        const href = $(".btn.btn-primary.btn-user.btn-success1.m-1").attr("href");  
          
        if (href && href.toLowerCase().includes("hubcloud")) {  
            return res.json({ redirect: href, action: "Call /api/extract with this redirect URL" });  
        }  
        return res.json({ error: "Could not resolve Hubdrive to Hubcloud" });  
    }  
    else if (lowerUrl.includes("hubcloud")) {  
        let { data } = await axiosClient.get(url);  
        let $ = cheerio.load(data);  
        let downloadHref = $("#download").attr("href");  
          
        if (downloadHref) {  
            let realUrl = downloadHref.startsWith("http") ? downloadHref : new URL(downloadHref, url).href;  
            let downloadPage = await axiosClient.get(realUrl);  
            $ = cheerio.load(downloadPage.data);  
        }  

        let streams =[]; // ⚠️ Fixed: Initialized streams as empty Array  

        $("a.btn").each((i, el) => {  
            let link = $(el).attr("href");  
            let text = $(el).text().trim();  
            if(!text) text = "Download";  
            let label = text.toLowerCase();  

            if (!link) return;  

            if (label.includes("fsl server") || label.includes("s3 server") || label.includes("fslv2") || label.includes("mega server") || label.includes("download file")) {  
                streams.push({ name: text, url: link });  
            }  
            else if (label.includes("buzzserver")) {  
                streams.push({ name: "BuzzServer", url: `${link}/download`, type: "buzz_redirect" });  
            }  
            else if (label.includes("pixeldra") || label.includes("pixel server") || label.includes("pixeldrain")) {  
                try {  
                    let base = new URL(link).origin;  
                    let finalUrl = link.includes("download") ? link : `${base}/api/file/${link.split('/').pop()}?download`;  
                    streams.push({ name: "Pixeldrain", url: finalUrl });  
                } catch (e) {  
                    streams.push({ name: "Pixeldrain", url: link });  
                }  
            }  
        });  

        return res.json({ streams, host: "HubCloud" });  
    }  
    else {  
        return res.json({ error: "No matching extractor found for this host.", url });  
    }  
} catch (error) {  
    return res.status(500).json({ error: error.message || "Extraction failed" });  
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
      
    const dlink = resp.headers["hx-redirect"] || resp.headers["HX-Redirect"];  
      
    if (dlink) {  
        return res.json({ redirect: dlink });  
    }  
    return res.json({ error: "No redirect found for BuzzServer" });  
} catch (error) {  
    return res.status(500).json({ error: error.message || "Failed to resolve Buzz redirect" });  
}

});

// 🛡️ Global Error Handlers (Prevents Server Crash on Unhandled Promise/Exceptions)
process.on('uncaughtException', (err) => {
console.error('🔥 Critical Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
console.error('🔥 Unhandled Promise Rejection at:', promise, 'reason:', reason);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
console.log(🚀 Server is running on port ${PORT});
});
