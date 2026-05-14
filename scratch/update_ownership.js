const { query } = require('../src/db');
(async() => {
    try {
        await query(
            "UPDATE listings SET seller_id = $1, auction_end = NOW() + INTERVAL '2 hours 5 minutes' WHERE id = $2",
            ['fdce3b5f-4d0a-48fb-807c-c8986338d77f', '49e08c15-cb43-4f56-8d38-a625e59270a3']
        );
        console.log(`Updated ownership and timer to +2h5min from Postgres NOW()`);
    } catch(err) {
        console.error(err);
    }
    process.exit(0);
})()
