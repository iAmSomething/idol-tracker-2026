import axios from "axios";
import * as cheerio from "cheerio";

async function run() {
    const url = "https://www.youtube.com/watch?v=is9J6Rn1F9w";
    const res = await axios.get(url, { headers: { "User-Agent": "Mozilla/5.0" }});
    const $ = cheerio.load(res.data);
    console.log($("title").text());
}
run();
