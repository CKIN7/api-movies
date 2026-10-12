async function test() {
    try {
        const r = await fetch('http://localhost:7700/indexes/movies/search?q=The%20Batman&attributesToSearchOn=%5B%22title%22%5D&typoTolerance=%7B%22enabled%22%3Afalse%7D');
        const j = await r.json();
        console.log('full:', JSON.stringify(j, null, 2));
    } catch (e) {
        console.log('ERR:', e.message);
    }
}

test();